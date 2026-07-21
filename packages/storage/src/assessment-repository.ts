import { createHash } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { dump, load } from "js-yaml";
import { unzipSync } from "fflate";
import { z } from "zod";
import {
  assessmentConfigSchema,
  assessmentMetricsSchema,
  assessmentRecordSchema,
  calculatedResultsSchema,
  coverSchema,
  criterionValueSchema,
  emptyCriterionValues,
  gatewayAssessmentSchema,
  interactionModeSchema,
  reviewRecordSchema,
  uploadRecordSchema,
  validateCriterionValue,
  type AiOperationMetadata,
  type AssessmentConfig,
  type AssessmentMetrics,
  type AssessmentRecord,
  type AssessmentState,
  type CriterionValue,
  type GatewayAssessment,
  type ReviewRecord,
} from "../../domain/src/assessment.ts";
import { calculateAssessmentResults } from "../../domain/src/scoring.ts";
import { atomicWrite } from "./atomic-write.ts";
import { audit } from "./audit-log.ts";

const metadataSchema = assessmentRecordSchema.pick({
  schemaVersion: true,
  id: true,
  comparisonGroupId: true,
  mode: true,
  state: true,
  configHash: true,
  metrics: true,
  confirmedAt: true,
  createdAt: true,
  updatedAt: true,
});
const auditEntrySchema = z.object({
  at: z.string().datetime(),
  event: z.string().min(1).max(200),
  detail: z.unknown(),
});
const chatEntrySchema = auditEntrySchema.extend({
  detail: z
    .object({
      role: z.enum(["user", "assistant"]).optional(),
      content: z.string().optional(),
      askFollowUp: z.boolean().optional(),
      sectionId: z.string().optional(),
      criterionDiscussion: z.boolean().optional(),
    })
    .passthrough(),
});
const supportedMediaTypes: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
  ],
  ".csv": ["text/csv", "text/plain", "application/vnd.ms-excel"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ],
  ".txt": ["text/plain"],
  ".md": ["text/markdown", "text/plain"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function assessmentConfigHash(config: AssessmentConfig) {
  return createHash("sha256")
    .update(canonicalJson(assessmentConfigSchema.parse(config)))
    .digest("hex");
}

export class AssessmentRepository {
  constructor(public root: string) {}

  dir(id: string) {
    if (!/^ASSESS-\d{4}$/.test(id)) throw new Error("Ungültige Bewertungs-ID.");
    return join(this.root, "assessments", id);
  }

  async list(): Promise<AssessmentRecord[]> {
    let names: string[];
    try {
      names = await readdir(join(this.root, "assessments"));
    } catch {
      return [];
    }
    const records = await Promise.all(
      names
        .filter((name) => /^ASSESS-\d{4}$/.test(name))
        .map((id) => this.get(id)),
    );
    return records
      .filter((item): item is AssessmentRecord => item !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<AssessmentRecord | null> {
    try {
      const dir = this.dir(id);
      const [
        metadata,
        cover,
        configSnapshot,
        gateway,
        criteria,
        results,
        review,
        uploadNames,
      ] = await Promise.all([
        readFile(join(dir, "metadata.yaml"), "utf8").then((text) =>
          metadataSchema.parse(load(text)),
        ),
        readFile(join(dir, "cover.yaml"), "utf8").then((text) =>
          coverSchema.parse(load(text)),
        ),
        readFile(join(dir, "config-snapshot.json"), "utf8").then((text) =>
          assessmentConfigSchema.parse(JSON.parse(text)),
        ),
        readFile(join(dir, "gateway.json"), "utf8").then((text) =>
          gatewayAssessmentSchema.parse(JSON.parse(text)),
        ),
        readFile(join(dir, "criteria.json"), "utf8").then((text) =>
          z.array(criterionValueSchema).length(28).parse(JSON.parse(text)),
        ),
        readFile(join(dir, "calculated-results.json"), "utf8").then((text) =>
          calculatedResultsSchema.nullable().parse(JSON.parse(text)),
        ),
        readFile(join(dir, "review.json"), "utf8").then((text) =>
          reviewRecordSchema.nullable().parse(JSON.parse(text)),
        ),
        readdir(join(dir, "uploads")),
      ]);
      const uploads = await Promise.all(
        uploadNames
          .filter((name) => name.endsWith(".meta.json"))
          .map(async (name) =>
            uploadRecordSchema.parse(
              JSON.parse(await readFile(join(dir, "uploads", name), "utf8")),
            ),
          ),
      );
      if (assessmentConfigHash(configSnapshot) !== metadata.configHash)
        throw new Error("Der gespeicherte Konfigurations-Hash ist ungültig.");
      return assessmentRecordSchema.parse({
        ...metadata,
        cover,
        configSnapshot,
        gateway,
        criteria,
        calculatedResults: results,
        review,
        uploads,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async create(input: {
    cover: unknown;
    mode: unknown;
    config: unknown;
    comparisonGroupId?: string | null;
  }) {
    const cover = coverSchema.parse(input.cover);
    const mode = interactionModeSchema.parse(input.mode);
    const config = assessmentConfigSchema.parse(input.config);
    const existing = await this.list();
    const number =
      Math.max(0, ...existing.map((item) => Number(item.id.slice(7)))) + 1;
    const id = `ASSESS-${String(number).padStart(4, "0")}`;
    const now = new Date().toISOString();
    const record: AssessmentRecord = {
      schemaVersion: 1,
      id,
      comparisonGroupId: input.comparisonGroupId ?? null,
      mode,
      state: "gateway_in_progress",
      cover,
      configSnapshot: config,
      configHash: assessmentConfigHash(config),
      gateway: gatewayAssessmentSchema.parse({}),
      criteria: emptyCriterionValues(config),
      calculatedResults: null,
      review: null,
      uploads: [],
      metrics: assessmentMetricsSchema.parse({}),
      confirmedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await mkdir(join(this.dir(id), "uploads"), { recursive: true });
    await this.writeRecord(record);
    await atomicWrite(
      join(this.dir(id), "chat.jsonl"),
      JSON.stringify({
        at: now,
        event: "chat-message",
        detail: {
          role: "assistant",
          content: config.openingMessage,
          deterministic: true,
        },
      }) + "\n",
    );
    await audit(join(this.dir(id), "history.jsonl"), "assessment-created", {
      mode,
      configHash: record.configHash,
      comparisonGroupId: record.comparisonGroupId,
    });
    return record;
  }

  async duplicateForComparison(id: string) {
    const source = await this.required(id);
    const comparisonGroupId = source.comparisonGroupId ?? crypto.randomUUID();
    if (!source.comparisonGroupId) {
      await this.writeMetadata({
        ...source,
        comparisonGroupId,
        updatedAt: new Date().toISOString(),
      });
      await audit(
        join(this.dir(id), "history.jsonl"),
        "comparison-group-assigned",
        { comparisonGroupId },
      );
    }
    return this.create({
      cover: source.cover,
      mode: source.mode === "form" ? "chat" : "form",
      config: source.configSnapshot,
      comparisonGroupId,
    });
  }

  async saveGatewayElicitation(
    id: string,
    elicitation: NonNullable<GatewayAssessment["elicitation"]>,
    selectedUploadIds: string[],
  ) {
    const record = await this.required(id);
    if (record.mode !== "chat" || record.state !== "gateway_in_progress")
      throw new Error(
        "Die adaptive Prozessaufnahme ist in diesem Status nicht verfügbar.",
      );
    if (record.gateway.elicitation)
      throw new Error("Die Einstiegsfragen wurden bereits vorbereitet.");
    const gateway = gatewayAssessmentSchema.parse({
      ...record.gateway,
      elicitation,
      selectedUploadIds,
    });
    await this.writeJson(id, "gateway.json", gateway);
    await this.writeMetadata({
      ...record,
      metrics: addOperationMetrics(record.metrics, elicitation.operation),
      updatedAt: new Date().toISOString(),
    });
    await audit(
      join(this.dir(id), "history.jsonl"),
      "gateway-elicitation-prepared",
      {
        questionIds: elicitation.questions.map(
          (question) => question.questionId,
        ),
        selectedUploadIds,
        operation: elicitation.operation,
        configHash: record.configHash,
      },
    );
    return await this.required(id);
  }

  async saveGateway(
    id: string,
    gateway: z.input<typeof gatewayAssessmentSchema>,
  ) {
    const record = await this.required(id);
    if (record.state !== "gateway_in_progress")
      throw new Error("Die KI-Potenzialprüfung ist bereits abgeschlossen.");
    const value = gatewayAssessmentSchema.parse(gateway);
    let state: AssessmentState = record.state;
    if (value.final)
      state = value.hasClearAiSignal
        ? "criteria_in_progress"
        : "submitted_without_clear_ai_signal";
    await this.writeJson(id, "gateway.json", value);
    await this.writeMetadata({
      ...record,
      state,
      metrics: addOperationMetrics(record.metrics, value.operation),
      updatedAt: new Date().toISOString(),
    });
    await audit(
      join(this.dir(id), "history.jsonl"),
      value.final ? "gateway-finalized" : "gateway-evaluated",
      {
        decisions: value.decisions,
        followUpsUsed: value.followUpsUsed,
        operation: value.operation,
        configHash: record.configHash,
      },
    );
    return await this.required(id);
  }

  async applyAiCriteria(
    id: string,
    proposals: CriterionValue[],
    operation?: AiOperationMetadata,
  ) {
    const record = await this.required(id);
    this.assertCriteriaEditable(record);
    const byId = new Map(
      record.criteria.map((item) => [item.criterionId, item]),
    );
    let populated = 0;
    for (const raw of proposals) {
      const proposal = criterionValueSchema.parse(raw);
      validateCriterionValue(
        record.configSnapshot,
        proposal.criterionId,
        proposal.value!,
      );
      const previous = byId.get(proposal.criterionId);
      if (!previous) throw new Error("Unbekanntes Kriterium.");
      if (previous.confirmation === "confirmed") continue;
      byId.set(proposal.criterionId, {
        ...proposal,
        source: "ai",
        confirmation: "pending",
        updatedBy: "ai",
        updatedAt: new Date().toISOString(),
      });
      if (previous.value === null) populated++;
    }
    const criteria = record.criteria.map((item) => byId.get(item.criterionId)!);
    await this.persistCriteria(record, criteria, {
      ...addOperationMetrics(record.metrics, operation),
      aiPopulatedBeforeHuman: record.metrics.aiPopulatedBeforeHuman + populated,
    });
    await audit(join(this.dir(id), "history.jsonl"), "criteria-ai-proposed", {
      proposals,
      operation,
      configHash: record.configHash,
    });
    return this.required(id);
  }

  async setCriterion(
    id: string,
    criterionId: string,
    value: number | boolean | null,
    detail: { rationale?: string; evidence?: string[] } = {},
  ) {
    const record = await this.required(id);
    this.assertCriteriaEditable(record);
    const previous = record.criteria.find(
      (item) => item.criterionId === criterionId,
    );
    if (!previous) throw new Error("Unbekanntes Kriterium.");
    if (value !== null)
      validateCriterionValue(record.configSnapshot, criterionId, value);
    const next: CriterionValue =
      value === null
        ? {
            criterionId,
            value: null,
            source: "none",
            confirmation: "empty",
            rationale: "",
            evidence: [],
            assumptions: [],
            confidence: null,
            updatedBy: "human",
            updatedAt: new Date().toISOString(),
          }
        : {
            criterionId,
            value,
            source: "human",
            confirmation: "confirmed",
            rationale: detail.rationale ?? previous.rationale,
            evidence: detail.evidence ?? previous.evidence,
            assumptions: previous.assumptions,
            confidence: null,
            updatedBy: "human",
            updatedAt: new Date().toISOString(),
          };
    const metrics = {
      ...record.metrics,
      humanOverrideCount:
        record.metrics.humanOverrideCount +
        (previous.source === "ai" && previous.value !== value ? 1 : 0),
    };
    await this.persistCriteria(
      record,
      record.criteria.map((item) =>
        item.criterionId === criterionId ? next : item,
      ),
      metrics,
    );
    await audit(
      join(this.dir(id), "history.jsonl"),
      value === null ? "criterion-human-cleared" : "criterion-human-updated",
      { criterionId, previous, next },
    );
    return this.required(id);
  }

  async confirmCriterion(id: string, criterionId: string) {
    const record = await this.required(id);
    this.assertCriteriaEditable(record);
    const previous = record.criteria.find(
      (item) => item.criterionId === criterionId,
    );
    if (!previous || previous.value === null)
      throw new Error("Für dieses Kriterium liegt kein Vorschlag vor.");
    if (previous.confirmation === "confirmed") return record;
    const next = {
      ...previous,
      confirmation: "confirmed" as const,
      updatedBy: "human" as const,
      updatedAt: new Date().toISOString(),
    };
    await this.persistCriteria(
      record,
      record.criteria.map((item) =>
        item.criterionId === criterionId ? next : item,
      ),
      record.metrics,
    );
    await audit(
      join(this.dir(id), "history.jsonl"),
      record.mode === "form" ? "criterion-confirmed" : "chat-proposal-accepted",
      {
        criterionId,
        value: next.value,
      },
    );
    return this.required(id);
  }

  async saveReview(id: string, review: ReviewRecord) {
    const record = await this.required(id);
    if (!this.criteriaReady(record))
      throw new Error("Bitte vervollständigen Sie zuerst alle Kriterien.");
    const value = reviewRecordSchema.parse(review);
    await this.writeJson(id, "review.json", value);
    const blocking = [...value.deterministicWarnings, ...value.findings].some(
      (finding) => finding.severity === "blocking" && !finding.acknowledgedAt,
    );
    await this.writeMetadata({
      ...record,
      state: blocking ? "review_changes_required" : "ready_for_confirmation",
      metrics: addOperationMetrics(record.metrics, value.operation),
      updatedAt: new Date().toISOString(),
    });
    await audit(join(this.dir(id), "history.jsonl"), "review-completed", {
      review: value,
      configHash: record.configHash,
    });
    return this.required(id);
  }

  async acknowledgeFinding(id: string, findingId: string) {
    const record = await this.required(id);
    if (!record.review || record.review.status !== "current")
      throw new Error("Es liegt keine aktuelle Prüfung vor.");
    const target = [
      ...record.review.deterministicWarnings,
      ...record.review.findings,
    ].find((item) => item.id === findingId);
    if (!target) throw new Error("Prüfhinweis nicht gefunden.");
    if (target.severity === "blocking")
      throw new Error(
        "Blockierende Hinweise müssen durch eine Korrektur und erneute Prüfung gelöst werden.",
      );
    const update = (finding: ReviewRecord["findings"][number]) =>
      finding.id === findingId
        ? { ...finding, acknowledgedAt: new Date().toISOString() }
        : finding;
    const review = reviewRecordSchema.parse({
      ...record.review,
      deterministicWarnings: record.review.deterministicWarnings.map(update),
      findings: record.review.findings.map(update),
    });
    await this.writeJson(id, "review.json", review);
    const blocking = [...review.deterministicWarnings, ...review.findings].some(
      (item) => item.severity === "blocking" && !item.acknowledgedAt,
    );
    await this.writeMetadata({
      ...record,
      state: blocking ? "review_changes_required" : "ready_for_confirmation",
      updatedAt: new Date().toISOString(),
    });
    await audit(
      join(this.dir(id), "history.jsonl"),
      "review-finding-acknowledged",
      { findingId },
    );
    return this.required(id);
  }

  async confirmAssessment(id: string) {
    const record = await this.required(id);
    if (
      record.state !== "ready_for_confirmation" ||
      !record.review ||
      record.review.status !== "current"
    )
      throw new Error(
        "Die Bewertung benötigt eine aktuelle, abgeschlossene Prüfung.",
      );
    const findings = [
      ...record.review.deterministicWarnings,
      ...record.review.findings,
    ];
    if (
      findings.some(
        (item) => item.severity === "blocking" && !item.acknowledgedAt,
      )
    )
      throw new Error("Es gibt noch blockierende Prüfhinweise.");
    if (
      findings.some(
        (item) => item.severity === "warning" && !item.acknowledgedAt,
      )
    )
      throw new Error("Bitte bestätigen Sie alle verbleibenden Warnungen.");
    if (!this.criteriaReady(record))
      throw new Error("Bitte vervollständigen Sie alle Kriterien.");
    const now = new Date().toISOString();
    const criteria =
      record.mode === "chat"
        ? record.criteria.map((item) => ({
            ...item,
            confirmation: "confirmed" as const,
            updatedAt: now,
          }))
        : record.criteria;
    if (criteria.some((item) => item.confirmation !== "confirmed"))
      throw new Error("Bitte bestätigen Sie jedes Kriterium einzeln.");
    const results = calculateAssessmentResults(record.configSnapshot, criteria);
    await this.writeJson(id, "criteria.json", criteria);
    await this.writeJson(id, "calculated-results.json", results);
    await this.writeMetadata({
      ...record,
      state: "confirmed",
      metrics: {
        ...record.metrics,
        userElapsedMs: Math.max(
          0,
          Date.parse(now) - Date.parse(record.createdAt),
        ),
      },
      confirmedAt: now,
      updatedAt: now,
    });
    await audit(join(this.dir(id), "history.jsonl"), "assessment-confirmed", {
      mode: record.mode,
      confirmation:
        record.mode === "chat"
          ? {
              type: "batch",
              criterionIds: criteria.map((item) => item.criterionId),
            }
          : { type: "final-submission" },
      results,
      configHash: record.configHash,
    });
    return this.required(id);
  }

  async saveUpload(
    id: string,
    originalName: string,
    mediaType: string,
    bytes: Uint8Array,
  ) {
    const record = await this.required(id);
    const normalizedMediaType = mediaType
      .split(";", 1)[0]!
      .trim()
      .toLowerCase();
    if (bytes.byteLength > record.configSnapshot.uploads.maxFileBytes)
      throw new Error("Die Datei überschreitet die konfigurierte Höchstgröße.");
    const total = record.uploads.reduce((sum, item) => sum + item.size, 0);
    if (
      total + bytes.byteLength >
      record.configSnapshot.uploads.maxAssessmentBytes
    )
      throw new Error(
        "Alle Dateien zusammen überschreiten die konfigurierte Höchstgröße.",
      );
    const extension = extname(originalName).toLowerCase();
    if (
      !record.configSnapshot.uploads.allowedExtensions.includes(
        extension.slice(1) as never,
      ) ||
      !supportedMediaTypes[extension]?.includes(normalizedMediaType) ||
      !matchesFileSignature(extension, bytes)
    )
      throw new Error(
        "Dateiendung und Inhaltstyp passen nicht zu einem unterstützten Dateiformat.",
      );
    const safeBase =
      basename(originalName, extension)
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+/, "")
        .slice(0, 100) || "datei";
    const upload = uploadRecordSchema.parse({
      id: crypto.randomUUID(),
      name: `${safeBase}${extension}`,
      mediaType: normalizedMediaType,
      size: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      createdAt: new Date().toISOString(),
    });
    const storedName = `${upload.id}-${upload.name}`;
    await atomicWrite(join(this.dir(id), "uploads", storedName), bytes);
    await atomicWrite(
      join(this.dir(id), "uploads", `${storedName}.meta.json`),
      JSON.stringify(upload, null, 2) + "\n",
    );
    await audit(join(this.dir(id), "history.jsonl"), "file-uploaded", upload);
    return upload;
  }

  async appendChat(id: string, entry: unknown) {
    const record = await this.required(id);
    await audit(join(this.dir(id), "chat.jsonl"), "chat-message", entry);
    await audit(join(this.dir(id), "history.jsonl"), "chat-message", entry);
    const detail = entry as {
      role?: string;
      followUp?: boolean;
      criterionDiscussion?: boolean;
    };
    if (detail.role === "user" && !detail.criterionDiscussion) {
      await this.writeMetadata({
        ...record,
        metrics: {
          ...record.metrics,
          mainChatTurns:
            record.metrics.mainChatTurns + (detail.followUp ? 0 : 1),
          followUpChatTurns:
            record.metrics.followUpChatTurns + (detail.followUp ? 1 : 0),
        },
        updatedAt: new Date().toISOString(),
      });
    }
  }

  uploadPath(id: string, uploadId: string, name: string) {
    if (!/^[0-9a-f-]{36}$/.test(uploadId))
      throw new Error("Ungültige Datei-ID.");
    return join(this.dir(id), "uploads", `${uploadId}-${basename(name)}`);
  }

  async chatMessages(id: string) {
    await this.required(id);
    try {
      return (await readFile(join(this.dir(id), "chat.jsonl"), "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => chatEntrySchema.parse(JSON.parse(line)))
        .map((entry) => ({ ...entry.detail, at: entry.at }))
        .filter(
          (
            entry,
          ): entry is {
            role: "user" | "assistant";
            content: string;
            at: string;
            askFollowUp?: boolean;
            sectionId?: string;
            criterionDiscussion?: boolean;
          } =>
            (entry?.role === "user" || entry?.role === "assistant") &&
            typeof entry.content === "string",
        );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async chatEvidence(id: string) {
    return (await this.chatMessages(id)).map(({ role, content }) => ({
      role,
      content,
    }));
  }

  async reviewChatEvidence(id: string) {
    const entries = await this.history(id);
    return entries.flatMap((entry) => {
      if (entry.event !== "review-chat-message") return [];
      const detail = entry.detail as {
        userMessage?: unknown;
        assistantMessage?: unknown;
      };
      if (
        typeof detail.userMessage !== "string" ||
        typeof detail.assistantMessage !== "string"
      )
        return [];
      return [
        { role: "user" as const, content: detail.userMessage },
        { role: "assistant" as const, content: detail.assistantMessage },
      ];
    });
  }

  async recordReviewChat(
    id: string,
    userMessage: string,
    assistantMessage: string,
    operation: AiOperationMetadata,
  ) {
    const record = await this.required(id);
    if (!record.review || record.review.status !== "current")
      throw new Error("Es liegt keine aktuelle Prüfung vor.");
    if (
      record.review.chatMessagesUsed >=
      record.configSnapshot.ai.reviewerChatLimit
    )
      throw new Error(
        "Die maximale Zahl an Rückfragen zur Prüfung ist erreicht.",
      );
    const review = reviewRecordSchema.parse({
      ...record.review,
      chatMessagesUsed: record.review.chatMessagesUsed + 1,
    });
    await this.writeJson(id, "review.json", review);
    await this.writeMetadata({
      ...record,
      metrics: addOperationMetrics(record.metrics, operation),
      updatedAt: new Date().toISOString(),
    });
    await audit(join(this.dir(id), "history.jsonl"), "review-chat-message", {
      userMessage,
      assistantMessage,
      operation,
      configHash: record.configHash,
    });
    return this.required(id);
  }

  async recordAiOperationError(
    id: string,
    operationName: string,
    error: unknown,
  ) {
    const record = await this.required(id);
    const detail =
      error instanceof Error
        ? {
            name: error.name.slice(0, 100),
            message: error.message.slice(0, 2_000),
          }
        : { name: "UnknownError", message: String(error).slice(0, 2_000) };
    await audit(join(this.dir(id), "history.jsonl"), "ai-operation-error", {
      operationName,
      error: detail,
      configHash: record.configHash,
    });
  }

  async history(id: string) {
    await this.required(id);
    return (await readFile(join(this.dir(id), "history.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((line) => auditEntrySchema.parse(JSON.parse(line)));
  }

  async saveFacilitatorRatings(
    id: string,
    ratings: NonNullable<AssessmentMetrics["facilitatorRatings"]>,
  ) {
    const record = await this.required(id);
    const parsed = z
      .object({
        completeness: z.number().int().min(1).max(5),
        plausibility: z.number().int().min(1).max(5),
        traceability: z.number().int().min(1).max(5),
        userEffort: z.number().int().min(1).max(5),
      })
      .parse(ratings);
    await this.writeMetadata({
      ...record,
      metrics: assessmentMetricsSchema.parse({
        ...record.metrics,
        facilitatorRatings: parsed,
      }),
      updatedAt: new Date().toISOString(),
    });
    await audit(
      join(this.dir(id), "history.jsonl"),
      "facilitator-ratings-saved",
      parsed,
    );
    return this.required(id);
  }

  private async required(id: string) {
    const record = await this.get(id);
    if (!record) throw new Error("Bewertung nicht gefunden.");
    return record;
  }

  private assertCriteriaEditable(record: AssessmentRecord) {
    if (
      ![
        "criteria_in_progress",
        "ready_for_review",
        "review_changes_required",
        "ready_for_confirmation",
      ].includes(record.state)
    )
      throw new Error(
        "Die Kriterien können in diesem Status nicht geändert werden.",
      );
  }

  private criteriaReady(record: AssessmentRecord) {
    return record.criteria.every(
      (item) =>
        item.value !== null &&
        (record.mode === "chat" || item.confirmation === "confirmed"),
    );
  }

  private async persistCriteria(
    record: AssessmentRecord,
    criteria: CriterionValue[],
    metrics: AssessmentMetrics,
  ) {
    const ready = criteria.every(
      (item) =>
        item.value !== null &&
        (record.mode === "chat" || item.confirmation === "confirmed"),
    );
    const review = record.review
      ? { ...record.review, status: "stale" as const }
      : null;
    await this.writeJson(
      record.id,
      "criteria.json",
      z.array(criterionValueSchema).length(28).parse(criteria),
    );
    await this.writeJson(
      record.id,
      "calculated-results.json",
      ready
        ? calculateAssessmentResults(record.configSnapshot, criteria)
        : null,
    );
    await this.writeJson(record.id, "review.json", review);
    await this.writeMetadata({
      ...record,
      state: ready ? "ready_for_review" : "criteria_in_progress",
      metrics,
      updatedAt: new Date().toISOString(),
    });
  }

  private async writeRecord(record: AssessmentRecord) {
    const value = assessmentRecordSchema.parse(record);
    await Promise.all([
      this.writeMetadata(value),
      atomicWrite(
        join(this.dir(value.id), "cover.yaml"),
        dump(value.cover, { lineWidth: 140, noRefs: true }),
      ),
      this.writeJson(value.id, "config-snapshot.json", value.configSnapshot),
      this.writeJson(value.id, "gateway.json", value.gateway),
      this.writeJson(value.id, "criteria.json", value.criteria),
      this.writeJson(
        value.id,
        "calculated-results.json",
        value.calculatedResults,
      ),
      this.writeJson(value.id, "review.json", value.review),
    ]);
  }

  private async writeMetadata(record: AssessmentRecord) {
    await atomicWrite(
      join(this.dir(record.id), "metadata.yaml"),
      dump(metadataSchema.parse(record), { lineWidth: 140, noRefs: true }),
    );
  }

  private async writeJson(id: string, name: string, value: unknown) {
    await atomicWrite(
      join(this.dir(id), name),
      JSON.stringify(value, null, 2) + "\n",
    );
  }
}

function matchesFileSignature(extension: string, bytes: Uint8Array) {
  const startsWith = (...signature: number[]) =>
    signature.every((value, index) => bytes[index] === value);
  if (extension === ".pdf") return startsWith(0x25, 0x50, 0x44, 0x46);
  if (extension === ".png")
    return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (extension === ".jpg" || extension === ".jpeg")
    return startsWith(0xff, 0xd8, 0xff);
  if (extension === ".xlsx" || extension === ".docx") {
    if (!startsWith(0x50, 0x4b)) return false;
    try {
      const requiredMain =
        extension === ".xlsx" ? "xl/workbook.xml" : "word/document.xml";
      let selectedBytes = 0;
      const archive = unzipSync(bytes, {
        filter: (file) => {
          const selected =
            file.name === "[Content_Types].xml" || file.name === requiredMain;
          if (selected) {
            selectedBytes += file.originalSize;
            if (selectedBytes > 5 * 1024 * 1024)
              throw new Error("Office validation content is too large.");
          }
          return selected;
        },
      });
      const contentTypes = archive["[Content_Types].xml"];
      const main = archive[requiredMain];
      if (!contentTypes || !main) return false;
      const xml = new TextDecoder("utf-8", { fatal: true }).decode(
        contentTypes,
      );
      return extension === ".xlsx"
        ? xml.includes("spreadsheetml.sheet.main+xml")
        : xml.includes("wordprocessingml.document.main+xml");
    } catch {
      return false;
    }
  }
  if (bytes.includes(0)) return false;
  if (![".csv", ".txt", ".md"].includes(extension)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

function addOperationMetrics(
  metrics: AssessmentMetrics,
  operation?: AiOperationMetadata | null,
): AssessmentMetrics {
  if (!operation) return metrics;
  return {
    ...metrics,
    aiProcessingMs: metrics.aiProcessingMs + operation.durationMs,
    inputTokens:
      operation.inputTokens === null
        ? metrics.inputTokens
        : (metrics.inputTokens ?? 0) + operation.inputTokens,
    outputTokens:
      operation.outputTokens === null
        ? metrics.outputTokens
        : (metrics.outputTokens ?? 0) + operation.outputTokens,
  };
}
