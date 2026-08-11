import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, unlink } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { dump, load } from "js-yaml";
import { z } from "zod";
import { unzipSync } from "fflate";
import {
  aiTraceSchema,
  assertExactlyFiveAnswers,
  assertUnderstandingReferences,
  assertWorkCharacteristicAnswers,
  coverSchema,
  followUpAnswerSchema,
  followUpQuestionSchema,
  previousQuestionReviewSchema,
  processCaptureConfigSchema,
  interactionModeSchema,
  processCaptureRecordSchema,
  processStateSchema,
  processUnderstandingStorageSchema,
  processUnderstandingSchema,
  topicAnswerSchema,
  uploadRecordSchema,
  validationInputSnapshotSchema,
  validationRunSchema,
  workCharacteristicAnswerSchema,
  type AiTrace,
  type FollowUpQuestion,
  type PreviousQuestionReview,
  type ProcessCaptureConfig,
  type ProcessCaptureRecord,
  type ProcessUnderstanding,
  type UploadRecord,
  type ValidationInputSnapshot,
  type WorkCharacteristicAnswer,
  normalizedProcessName,
} from "../../domain/src/process-understanding.ts";
import {
  processHistoryEventNameSchema,
  type ProcessHistoryEventName,
} from "../../domain/src/process-events.ts";
import { ChatCaptureRepository } from "./chat-capture-repository.ts";
import { atomicWrite } from "./atomic-write.ts";
import { audit } from "./audit-log.ts";

const metadataSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^PROC-\d{4}$/),
  state: processStateSchema,
  profile: z.object({
    id: z.literal("compact-v1"),
    version: z.union([z.literal(1), z.literal(2)]),
  }),
  configHash: z.string().regex(/^[a-f0-9]{64}$/),
  interactionMode: interactionModeSchema.default("form"),
  confirmationQuality: z
    .enum(["complete", "with_gaps"])
    .nullable()
    .default(null),
  confirmedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
/**
 * Dieselbe Regel wie bei `confirm()`: Wissenslücken oder Widersprüche machen eine
 * Bestätigung `with_gaps`, sonst ist sie `complete`. Ohne abgeleitetes
 * Verständnis bleibt nur `with_gaps` als ehrliche Aussage.
 */
function confirmationQualityOf(
  metadata: {
    state: string;
    confirmationQuality: "complete" | "with_gaps" | null;
  },
  understanding: { knowledgeGaps: unknown[]; conflicts: unknown[] } | null,
) {
  if (metadata.state !== "confirmed") return metadata.confirmationQuality;
  if (metadata.confirmationQuality) return metadata.confirmationQuality;
  if (!understanding) return "with_gaps";
  return understanding.knowledgeGaps.length || understanding.conflicts.length
    ? "with_gaps"
    : "complete";
}

const answersFileSchema = z.object({
  mainAnswers: z.array(topicAnswerSchema).max(5),
  workCharacteristicAnswers: z
    .array(workCharacteristicAnswerSchema)
    .max(4)
    .optional(),
  selectedUploadIds: z.array(z.string().uuid()).max(5),
});
const followUpsFileSchema = z.object({
  questions: z.array(followUpQuestionSchema).max(5),
  answers: z.array(followUpAnswerSchema).max(5),
  validationRuns: z.array(validationRunSchema).default([]),
});
const auditEntrySchema = z.object({
  at: z.string().datetime(),
  event: processHistoryEventNameSchema,
  detail: z.unknown(),
});
const operationEntrySchema = z.object({
  at: z.string().datetime(),
  operationName: z.string().min(1),
  state: z.enum(["completed", "failed", "cancelled"]),
  trace: aiTraceSchema.optional(),
  error: z.string().optional(),
});

const mediaTypes: Record<string, string[]> = {
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
  ".pptx": [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
  ],
  ".txt": ["text/plain"],
  ".md": ["text/markdown", "text/plain"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function processConfigHash(config: ProcessCaptureConfig) {
  return createHash("sha256")
    .update(canonical(processCaptureConfigSchema.parse(config)))
    .digest("hex");
}
function safeName(name: string) {
  const safe = basename(name)
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^[-.]+/, "")
    .slice(0, 180);
  if (!safe) throw new Error("Ungültiger Dateiname.");
  return safe;
}
function normalizeMediaType(value: string) {
  return value.split(";", 1)[0]!.trim().toLowerCase();
}
function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((value, index) => bytes[index] === value);
}
function validateFileBytes(extension: string, bytes: Uint8Array) {
  if (!bytes.length) throw new Error("Die Datei ist leer.");
  if (extension === ".pdf" && !hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46]))
    throw new Error("Der Dateiinhalt ist kein gültiges PDF.");
  if (
    extension === ".png" &&
    !hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  )
    throw new Error("Der Dateiinhalt ist kein gültiges PNG-Bild.");
  if (
    [".jpg", ".jpeg"].includes(extension) &&
    !hasPrefix(bytes, [0xff, 0xd8, 0xff])
  )
    throw new Error("Der Dateiinhalt ist kein gültiges JPEG-Bild.");
  if ([".docx", ".xlsx", ".pptx"].includes(extension)) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(bytes);
    } catch {
      throw new Error("Die Office-Datei ist beschädigt oder ungültig.");
    }
    const required =
      extension === ".docx"
        ? ["[Content_Types].xml", "word/document.xml"]
        : extension === ".xlsx"
          ? ["[Content_Types].xml", "xl/workbook.xml"]
          : ["[Content_Types].xml", "ppt/presentation.xml"];
    if (required.some((name) => !entries[name]))
      throw new Error("Der Inhalt passt nicht zur angegebenen Office-Datei.");
    if (
      extension === ".pptx" &&
      !Object.keys(entries).some((name) =>
        /^ppt\/slides\/slide\d+\.xml$/.test(name),
      )
    )
      throw new Error(
        "Die Office-Datei enthält keine lesbare Präsentationsfolie.",
      );
  }
  if ([".txt", ".md", ".csv"].includes(extension) && bytes.includes(0))
    throw new Error("Die Textdatei enthält ungültige Binärdaten.");
}
const globalFactNames = [
  "purpose",
  "trigger",
  "outcome",
  "boundaries",
  "participants",
  "informationSources",
  "systems",
  "controls",
  "handoffs",
  "volumeAndTime",
  "painPoints",
  "improvementGoals",
] as const;

type CorrectionFact =
  | ProcessUnderstanding[(typeof globalFactNames)[number]]
  | ProcessUnderstanding["steps"][number];

function comparableFactValue(fact: CorrectionFact) {
  if ("value" in fact) return fact.value;
  const value = structuredClone(fact) as Record<string, unknown>;
  delete value.provenance;
  delete value.evidenceIds;
  delete value.confidence;
  delete value.assumptions;
  delete value.confirmed;
  return value;
}

function reconcileCorrectionFact(
  previous: CorrectionFact | undefined,
  next: CorrectionFact,
  correctionId: string,
) {
  const changed =
    !previous ||
    JSON.stringify(comparableFactValue(previous)) !==
      JSON.stringify(comparableFactValue(next));
  if (changed) {
    next.provenance = "user_confirmed";
    next.confirmed = true;
    next.confidence = null;
    next.assumptions = [];
    next.evidenceIds = [...new Set([...next.evidenceIds, correctionId])];
    return;
  }
  next.provenance = previous.provenance;
  next.confirmed = previous.confirmed;
  next.confidence = previous.confidence;
  next.assumptions = structuredClone(previous.assumptions);
  next.evidenceIds = structuredClone(previous.evidenceIds);
}

export class ProcessCaptureNotFoundError extends Error {
  constructor() {
    super("Prozess nicht gefunden.");
    this.name = "ProcessCaptureNotFoundError";
  }
}

export class ProcessUploadNotFoundError extends Error {
  constructor() {
    super("Datei nicht gefunden.");
    this.name = "ProcessUploadNotFoundError";
  }
}

export class ProcessUploadIntegrityError extends Error {
  constructor() {
    super("Die gespeicherte Datei konnte nicht sicher gelesen werden.");
    this.name = "ProcessUploadIntegrityError";
  }
}
export class DuplicateProcessNameError extends Error {
  constructor() {
    super("Ein aktiver Prozess mit diesem Namen existiert bereits.");
    this.name = "DuplicateProcessNameError";
  }
}

export class ProcessCaptureRepository {
  private createTail: Promise<void> = Promise.resolve();

  constructor(public root: string) {}

  private async withCreateMutex<T>(action: () => Promise<T>) {
    const previous = this.createTail;
    let release!: () => void;
    this.createTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous.catch(() => undefined);
    try {
      return await action();
    } finally {
      release();
    }
  }

  private processRoot() {
    return join(this.root, "process-captures");
  }
  dir(id: string) {
    if (!/^PROC-\d{4}$/.test(id)) throw new Error("Ungültige Prozess-ID.");
    return join(this.processRoot(), id);
  }
  uploadPath(id: string, uploadId: string, name: string) {
    if (!z.string().uuid().safeParse(uploadId).success)
      throw new Error("Ungültige Datei-ID.");
    return join(this.dir(id), "uploads", `${uploadId}-${safeName(name)}`);
  }

  async list() {
    let names: string[];
    try {
      names = await readdir(this.processRoot());
    } catch {
      return [];
    }
    const records = await Promise.all(
      names
        .filter((name) => /^PROC-\d{4}$/.test(name))
        .map((id) => this.get(id)),
    );
    return records
      .filter((record): record is ProcessCaptureRecord => record !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /** Für bounded Batch-Jobs darf eine beschädigte Aufnahme die übrigen nicht sperren. */
  async listSettled() {
    let names: string[];
    try {
      names = await readdir(this.processRoot());
    } catch {
      return { records: [] as ProcessCaptureRecord[], errors: [] as Error[] };
    }
    const values = await Promise.all(
      names
        .filter((name) => /^PROC-\d{4}$/.test(name))
        .map(async (id) => {
          try {
            return { record: await this.get(id), error: null };
          } catch (value) {
            return {
              record: null,
              error:
                value instanceof Error
                  ? value
                  : new Error("Die Prozessquelle konnte nicht gelesen werden."),
            };
          }
        }),
    );
    return {
      records: values
        .map((value) => value.record)
        .filter((record): record is ProcessCaptureRecord => record !== null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      errors: values
        .map((value) => value.error)
        .filter((error): error is Error => error !== null),
    };
  }

  /**
   * Prozesse, die vor der Einführung der Bestätigungsqualität bestätigt wurden,
   * haben das Feld nicht in ihrer `metadata.yaml`. Statt sie beim Lesen als
   * ungültig abzuweisen, wird die Qualität nach derselben Regel wie bei einer
   * frischen Bestätigung aus dem Prozessverständnis abgeleitet.
   */
  async get(id: string): Promise<ProcessCaptureRecord | null> {
    if (!/^PROC-\d{4}$/.test(id)) return null;
    try {
      const dir = this.dir(id);
      const [
        metadata,
        cover,
        configSnapshot,
        answers,
        followUps,
        rawUnderstandingText,
        uploadNames,
      ] = await Promise.all([
        readFile(join(dir, "metadata.yaml"), "utf8").then((text) =>
          metadataSchema.parse(load(text)),
        ),
        readFile(join(dir, "cover.yaml"), "utf8").then((text) =>
          coverSchema.parse(load(text)),
        ),
        readFile(join(dir, "config-snapshot.json"), "utf8").then((text) =>
          processCaptureConfigSchema.parse(JSON.parse(text)),
        ),
        readFile(join(dir, "answers.json"), "utf8").then((text) =>
          answersFileSchema.parse(JSON.parse(text)),
        ),
        readFile(join(dir, "follow-ups.json"), "utf8").then((text) =>
          followUpsFileSchema.parse(JSON.parse(text)),
        ),
        readFile(join(dir, "process-understanding.json"), "utf8"),
        readdir(join(dir, "uploads")),
      ]);
      if (processConfigHash(configSnapshot) !== metadata.configHash)
        throw new Error("Der Konfigurations-Hash ist ungültig.");
      const uploads = await Promise.all(
        uploadNames
          .filter((name) => name.endsWith(".meta.json"))
          .map((name) =>
            readFile(join(dir, "uploads", name), "utf8").then((text) =>
              uploadRecordSchema.parse(JSON.parse(text)),
            ),
          ),
      );
      const chat =
        metadata.interactionMode === "chat"
          ? new ChatCaptureRepository(this.root)
          : null;
      const chatState = chat ? await chat.state(id) : null;
      const understanding = chat
        ? metadata.state === "confirmed"
          ? z
              .union([processUnderstandingStorageSchema, z.null()])
              .parse(JSON.parse(rawUnderstandingText))
          : await chat.lastValid(id)
        : z
            .union([processUnderstandingStorageSchema, z.null()])
            .parse(JSON.parse(rawUnderstandingText));
      const record = processCaptureRecordSchema.parse({
        ...metadata,
        confirmationQuality: confirmationQualityOf(metadata, understanding),
        cover,
        configSnapshot,
        ...answers,
        selectedUploadIds:
          chatState?.selectedUploadIds ?? answers.selectedUploadIds,
        workCharacteristicAnswers: answers.workCharacteristicAnswers ?? [],
        followUps: followUps.questions,
        followUpAnswers: followUps.answers,
        validationRuns: followUps.validationRuns,
        understanding,
        uploads,
      });
      if (record.understanding)
        assertUnderstandingReferences(record, record.understanding, {
          allowHumanCorrections: true,
          chatMessageIds: chat
            ? new Set(
                (await chat.transcript(id))
                  .filter((item) => item.role === "user")
                  .map((item) => item.id),
              )
            : undefined,
        });
      return record;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async required(id: string) {
    const record = await this.get(id);
    if (!record) throw new ProcessCaptureNotFoundError();
    return record;
  }

  async create(
    coverInput: unknown,
    configInput: unknown,
    interactionModeInput: unknown = "form",
  ) {
    return this.withCreateMutex(() =>
      this.createUnlocked(coverInput, configInput, interactionModeInput),
    );
  }

  private async createUnlocked(
    coverInput: unknown,
    configInput: unknown,
    interactionModeInput: unknown,
  ) {
    const cover = coverSchema.parse(coverInput);
    const config = processCaptureConfigSchema.parse(configInput);
    const interactionMode = interactionModeSchema.parse(interactionModeInput);
    if (config.profile.version !== 2)
      throw new Error(
        "Neue Prozessaufnahmen benötigen die aktuelle Profilversion.",
      );
    if (
      (await this.list()).some(
        (record) =>
          normalizedProcessName(record.cover.processName) ===
          normalizedProcessName(cover.processName),
      )
    )
      throw new DuplicateProcessNameError();
    const [activeNames, historicalNames] = await Promise.all([
      readdir(this.processRoot()).catch(() => []),
      readdir(join(this.root, "trash", "process-captures")).catch(() => []),
    ]);
    const usedNumbers = [...activeNames, ...historicalNames]
      .map((name) => /^PROC-(\d{4})(?:$|-)/.exec(name)?.[1])
      .filter((value): value is string => Boolean(value))
      .map(Number);
    const next = Math.max(0, ...usedNumbers) + 1;
    if (next > 9_999) throw new Error("Der Prozessnummernbereich ist voll.");
    const id = `PROC-${String(next).padStart(4, "0")}`;
    const now = new Date().toISOString();
    const record = processCaptureRecordSchema.parse({
      schemaVersion: 1,
      id,
      state: "capture_in_progress",
      profile: config.profile,
      configHash: processConfigHash(config),
      interactionMode,
      confirmationQuality: null,
      cover,
      configSnapshot: config,
      mainAnswers: [],
      workCharacteristicAnswers: [],
      followUps: [],
      followUpAnswers: [],
      validationRuns: [],
      selectedUploadIds: [],
      understanding: null,
      uploads: [],
      confirmedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await mkdir(join(this.dir(id), "uploads"), { recursive: true });
    try {
      await this.writeRecord(record);
      if (interactionMode === "chat")
        await new ChatCaptureRepository(this.root).initialize(id);
      await atomicWrite(join(this.dir(id), "operations.jsonl"), "");
      await audit(join(this.dir(id), "history.jsonl"), "process-created", {
        profile: record.profile,
        configHash: record.configHash,
      });
    } catch (error) {
      await rm(this.dir(id), { recursive: true, force: true });
      throw error;
    }
    return record;
  }

  async saveMainAnswers(
    id: string,
    input: unknown,
    workCharacteristicInput: unknown,
    selectedUploadIds: string[],
  ) {
    const record = await this.required(id);
    if (
      ![
        "capture_in_progress",
        "follow_up_required",
        "synthesis_ready",
      ].includes(record.state)
    )
      throw new Error(
        "Die Hauptantworten können in diesem Status nicht geändert werden.",
      );
    const answers = assertExactlyFiveAnswers(input as never[]);
    const workCharacteristicAnswers = assertWorkCharacteristicAnswers(
      record.configSnapshot,
      workCharacteristicInput,
    );
    this.assertSelectedUploads(record, selectedUploadIds);
    let validationRuns = record.validationRuns;
    if (!validationRuns.length && record.followUps.length) {
      const baseline = validationRunSchema.parse({
        runNumber: 1,
        completedAt: record.updatedAt,
        inputSnapshot: this.validationInputSnapshot(record),
        questions: record.followUps,
        previousQuestionReviews: [],
        trace: null,
      });
      validationRuns = [baseline];
      await this.writeJson(id, "follow-ups.json", {
        questions: record.followUps,
        answers: record.followUpAnswers,
        validationRuns,
      });
    }
    const previousSnapshot = validationRuns.length
      ? this.validationInputSnapshot(record)
      : null;
    const nextSnapshot = validationInputSnapshotSchema.parse({
      mainAnswers: answers,
      workCharacteristicAnswers,
      selectedUploadIds,
    });
    await this.writeJson(id, "answers.json", {
      mainAnswers: answers,
      workCharacteristicAnswers,
      selectedUploadIds,
    });
    await this.touch(record);
    await audit(join(this.dir(id), "history.jsonl"), "main-answers-saved", {
      answers,
      workCharacteristicAnswers,
      selectedUploadIds,
    });
    if (
      validationRuns.length &&
      previousSnapshot &&
      canonical(previousSnapshot) !== canonical(nextSnapshot)
    )
      await audit(
        join(this.dir(id), "history.jsonl"),
        "validation-input-updated",
        { previous: previousSnapshot, next: nextSnapshot },
      );
    return this.required(id);
  }

  async saveValidationRun(
    id: string,
    inputSnapshotInput: ValidationInputSnapshot,
    previousQuestionReviewsInput: PreviousQuestionReview[],
    questionsInput: FollowUpQuestion[],
    trace: AiTrace,
  ) {
    const record = await this.required(id);
    if (
      ![
        "capture_in_progress",
        "follow_up_required",
        "synthesis_ready",
      ].includes(record.state) ||
      record.mainAnswers.length !== 5
    )
      throw new Error(
        "Die Rückfragen können in diesem Status nicht gespeichert werden.",
      );
    const questions = z
      .array(followUpQuestionSchema)
      .max(5)
      .parse(questionsInput);
    if (
      new Set(questions.map((question) => question.topicId)).size !==
      questions.length
    )
      throw new Error(
        "Pro Themenbereich ist höchstens eine Rückfrage zulässig.",
      );
    const inputSnapshot =
      validationInputSnapshotSchema.parse(inputSnapshotInput);
    const previousQuestionReviews = z
      .array(previousQuestionReviewSchema)
      .max(5)
      .parse(previousQuestionReviewsInput);
    const previousQuestions = record.validationRuns.at(-1)?.questions ?? [];
    const reviews = new Map(
      previousQuestionReviews.map((review) => [review.questionId, review]),
    );
    if (
      reviews.size !== previousQuestionReviews.length ||
      reviews.size !== previousQuestions.length ||
      previousQuestions.some(
        (question) => reviews.get(question.id)?.topicId !== question.topicId,
      )
    )
      throw new Error(
        "Jede Rückfrage der vorigen Prüfung muss genau einmal bewertet werden.",
      );
    const completedAt = new Date().toISOString();
    const validationRun = validationRunSchema.parse({
      runNumber: record.validationRuns.length + 1,
      completedAt,
      inputSnapshot,
      questions,
      previousQuestionReviews,
      trace,
    });
    await this.writeJson(id, "follow-ups.json", {
      questions,
      answers: record.followUpAnswers,
      validationRuns: [...record.validationRuns, validationRun],
    });
    await this.touch(
      record,
      questions.length ? "follow_up_required" : "synthesis_ready",
    );
    await this.recordAiOperation(id, "process-follow-ups", "completed", trace);
    await audit(
      join(this.dir(id), "history.jsonl"),
      "validation-run-completed",
      validationRun,
    );
    return this.required(id);
  }

  async acceptOpenQuestionsForSynthesis(id: string) {
    const record = await this.required(id);
    if (record.state !== "follow_up_required" || !record.followUps.length)
      throw new Error("Es sind keine offenen Rückfragen zu übernehmen.");
    await audit(
      join(this.dir(id), "history.jsonl"),
      "open-validation-questions-accepted",
      { questions: record.followUps },
    );
    await this.touch(record, "synthesis_ready");
    return this.required(id);
  }

  async saveUnderstanding(
    id: string,
    input: ProcessUnderstanding,
    trace: AiTrace,
  ) {
    const record = await this.required(id);
    if (record.state !== "synthesis_ready")
      throw new Error(
        "Das Prozessbild kann in diesem Status nicht gespeichert werden.",
      );
    const parsed = processUnderstandingSchema.parse(input);
    const answeredQuestionIds = new Set(
      record.validationRuns.length
        ? []
        : record.followUpAnswers.map((answer) => answer.questionId),
    );
    const unresolvedQuestions = record.followUps
      .filter((question) => !answeredQuestionIds.has(question.id))
      .map((question) => question.question);
    const understanding = assertUnderstandingReferences(
      record,
      processUnderstandingSchema.parse({
        ...parsed,
        knowledgeGaps: [
          ...parsed.knowledgeGaps,
          ...unresolvedQuestions.filter(
            (question) => !parsed.knowledgeGaps.includes(question),
          ),
        ],
      }),
    );
    await this.writeJson(id, "process-understanding.json", understanding);
    await this.touch(record, "review_required");
    await this.recordAiOperation(id, "process-synthesis", "completed", trace);
    await audit(
      join(this.dir(id), "history.jsonl"),
      "understanding-synthesized",
      { trace, steps: understanding.steps.length },
    );
    return this.required(id);
  }

  /**
   * Bei Chat-Aufnahmen stützt sich Evidenz auf Nachrichten des Anwenders. Ohne
   * deren Kennungen verwirft `assertUnderstandingReferences` jede Chat-Evidenz,
   * eine Korrektur an einem im Chat aufgenommenen Prozess wäre also unmöglich.
   */
  private async userChatMessageIds(record: ProcessCaptureRecord) {
    if (record.interactionMode !== "chat") return undefined;
    const transcript = await new ChatCaptureRepository(this.root).transcript(
      record.id,
    );
    return new Set(
      transcript.filter((item) => item.role === "user").map((item) => item.id),
    );
  }

  async correctUnderstanding(id: string, input: unknown, note: string) {
    const record = await this.required(id);
    if (
      !record.understanding ||
      !["review_required", "confirmed"].includes(record.state)
    )
      throw new Error("Es liegt kein bearbeitbares Prozessbild vor.");
    const next = processUnderstandingSchema.parse(input);
    const previousHumanEvidenceIds = new Set(
      record.understanding.evidence
        .filter((item) => item.kind === "human_correction")
        .map((item) => item.id),
    );
    if (
      next.evidence.some(
        (item) =>
          item.kind === "human_correction" &&
          !previousHumanEvidenceIds.has(item.id),
      )
    )
      throw new Error(
        "Korrektur-Evidenz wird ausschließlich vom System aufgezeichnet.",
      );
    const chatMessageIds = await this.userChatMessageIds(record);
    assertUnderstandingReferences(record, next, {
      allowHumanCorrections: true,
      chatMessageIds,
    });
    const correctionId = crypto.randomUUID();
    globalFactNames.forEach((name) =>
      reconcileCorrectionFact(
        record.understanding![name],
        next[name],
        correctionId,
      ),
    );
    const previousSteps = new Map(
      record.understanding.steps.map((step) => [step.id, step]),
    );
    next.steps.forEach((step) =>
      reconcileCorrectionFact(previousSteps.get(step.id), step, correctionId),
    );
    next.evidence.push({
      id: correctionId,
      kind: "human_correction",
      sourceId: correctionId,
      excerpt: note,
    });
    const value = processUnderstandingSchema.parse(next);
    assertUnderstandingReferences(record, value, {
      allowHumanCorrections: true,
      chatMessageIds,
    });
    await this.writeJson(id, "process-understanding.json", value);
    if (record.interactionMode === "chat")
      await new ChatCaptureRepository(this.root).publishCorrection(id, value);
    await this.touch(record, "review_required", null);
    await audit(
      join(this.dir(id), "history.jsonl"),
      "understanding-corrected",
      { note, previous: record.understanding, next: value },
    );
    return this.required(id);
  }

  async correctWorkCharacteristics(
    id: string,
    input: WorkCharacteristicAnswer[],
    reason: string,
  ) {
    const record = await this.required(id);
    if (
      record.profile.version !== 2 ||
      !["review_required", "confirmed"].includes(record.state)
    )
      throw new Error("Die Arbeitsmerkmale können hier nicht geändert werden.");
    const note = z.string().trim().min(1).max(2_000).parse(reason);
    const answers = assertWorkCharacteristicAnswers(
      record.configSnapshot,
      input,
    );
    await this.writeJson(id, "answers.json", {
      mainAnswers: record.mainAnswers,
      workCharacteristicAnswers: answers,
      selectedUploadIds: record.selectedUploadIds,
    });
    await this.touch(record, "review_required", null);
    await audit(
      join(this.dir(id), "history.jsonl"),
      "work-characteristics-corrected",
      {
        reason: note,
        previous: record.workCharacteristicAnswers,
        next: answers,
      },
    );
    return this.required(id);
  }

  async confirm(id: string) {
    const record = await this.required(id);
    if (record.state !== "review_required" || !record.understanding)
      throw new Error("Bitte prüfen Sie zuerst das Prozessbild.");
    const now = new Date().toISOString();
    const confirmationQuality =
      record.understanding.knowledgeGaps.length ||
      record.understanding.conflicts.length
        ? "with_gaps"
        : "complete";
    await this.writeMetadata({
      ...record,
      state: "confirmed",
      confirmedAt: now,
      confirmationQuality,
      updatedAt: now,
    });
    await audit(
      join(this.dir(id), "history.jsonl"),
      "understanding-confirmed",
      { confirmedAt: now, quality: confirmationQuality },
    );
    return this.required(id);
  }

  async finalizeChatCapture(
    id: string,
    understanding: ProcessUnderstanding,
    quality: "complete" | "with_gaps",
  ) {
    const record = await this.required(id);
    if (
      record.interactionMode !== "chat" ||
      record.state !== "capture_in_progress"
    )
      throw new Error("Dieser Chat kann nicht bestätigt werden.");
    const now = new Date().toISOString();
    await this.writeJson(id, "process-understanding.json", understanding);
    await this.writeMetadata({
      ...record,
      state: "confirmed",
      confirmedAt: now,
      confirmationQuality: quality,
      updatedAt: now,
    });
    await audit(
      join(this.dir(id), "history.jsonl"),
      "chat-understanding-confirmed",
      { confirmedAt: now, quality },
    );
    return this.required(id);
  }

  async saveUpload(id: string, file: File) {
    const record = await this.required(id);
    if (
      ![
        "capture_in_progress",
        "follow_up_required",
        "synthesis_ready",
      ].includes(record.state)
    )
      throw new Error("Dateien können nur vor der Analyse hochgeladen werden.");
    if (record.uploads.length >= record.configSnapshot.uploads.maxFiles)
      throw new Error("Es können höchstens fünf Dateien hochgeladen werden.");
    if (
      file.size <= 0 ||
      file.size > record.configSnapshot.uploads.maxFileBytes
    )
      throw new Error("Die Datei darf höchstens 20 MB groß sein.");
    const total =
      record.uploads.reduce((sum, upload) => sum + upload.size, 0) + file.size;
    if (total > record.configSnapshot.uploads.maxProcessBytes)
      throw new Error("Die Dateien überschreiten zusammen 100 MB.");
    const name = safeName(file.name);
    const extension = extname(name).toLowerCase();
    if (
      !(
        record.configSnapshot.uploads.allowedExtensions as readonly string[]
      ).includes(extension)
    )
      throw new Error("Dieser Dateityp wird nicht unterstützt.");
    const mediaType = normalizeMediaType(
      file.type || "application/octet-stream",
    );
    if (!mediaTypes[extension]?.includes(mediaType))
      throw new Error("Dateiendung und Medientyp passen nicht zusammen.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    validateFileBytes(extension, bytes);
    const upload: UploadRecord = uploadRecordSchema.parse({
      id: crypto.randomUUID(),
      name,
      mediaType,
      size: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      uploadedAt: new Date().toISOString(),
    });
    await atomicWrite(this.uploadPath(id, upload.id, upload.name), bytes);
    await this.writeJson(id, join("uploads", `${upload.id}.meta.json`), upload);
    await audit(join(this.dir(id), "history.jsonl"), "file-uploaded", upload);
    return upload;
  }

  async readUpload(id: string, uploadId: string) {
    const record = await this.required(id);
    const upload = record.uploads.find((item) => item.id === uploadId);
    if (!upload) throw new ProcessUploadNotFoundError();
    let bytes: Uint8Array;
    try {
      bytes = await readFile(
        this.uploadPath(record.id, upload.id, upload.name),
      );
    } catch {
      throw new ProcessUploadIntegrityError();
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (bytes.byteLength !== upload.size || sha256 !== upload.sha256)
      throw new ProcessUploadIntegrityError();
    return { upload, bytes };
  }

  async removeUpload(id: string, uploadId: string) {
    const record = await this.required(id);
    if (
      ![
        "capture_in_progress",
        "follow_up_required",
        "synthesis_ready",
      ].includes(record.state)
    )
      throw new Error("Dateien können nach der Analyse nicht entfernt werden.");
    const upload = record.uploads.find((item) => item.id === uploadId);
    if (!upload) throw new Error("Datei nicht gefunden.");
    await Promise.all([
      unlink(this.uploadPath(id, upload.id, upload.name)),
      unlink(join(this.dir(id), "uploads", `${upload.id}.meta.json`)),
    ]);
    if (record.selectedUploadIds.includes(uploadId))
      await this.writeJson(id, "answers.json", {
        mainAnswers: record.mainAnswers,
        workCharacteristicAnswers: record.workCharacteristicAnswers,
        selectedUploadIds: record.selectedUploadIds.filter(
          (selectedId) => selectedId !== uploadId,
        ),
      });
    if (
      record.validationRuns.length &&
      record.selectedUploadIds.includes(uploadId)
    )
      await audit(
        join(this.dir(id), "history.jsonl"),
        "validation-input-updated",
        {
          previous: this.validationInputSnapshot(record),
          next: validationInputSnapshotSchema.parse({
            mainAnswers: record.mainAnswers,
            workCharacteristicAnswers: record.workCharacteristicAnswers,
            selectedUploadIds: record.selectedUploadIds.filter(
              (selectedId) => selectedId !== uploadId,
            ),
          }),
        },
      );
    await this.touch(record);
    await audit(join(this.dir(id), "history.jsonl"), "file-removed", upload);
  }

  async recordAiOperation(
    id: string,
    operationName: string,
    state: "completed" | "failed" | "cancelled",
    trace?: AiTrace,
    error?: string,
  ) {
    const entry = operationEntrySchema.parse({
      at: new Date().toISOString(),
      operationName,
      state,
      trace,
      error,
    });
    await audit(join(this.dir(id), "operations.jsonl"), operationName, entry);
  }

  async history(id: string) {
    await this.required(id);
    return (await readFile(join(this.dir(id), "history.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((line) => auditEntrySchema.parse(JSON.parse(line)))
      .reverse();
  }

  async appendHistory(
    id: string,
    event: ProcessHistoryEventName,
    detail: unknown,
  ) {
    await this.required(id);
    await audit(join(this.dir(id), "history.jsonl"), event, detail);
  }

  async deleteCapture(id: string, active = false) {
    await this.required(id);
    if (active)
      throw new Error("Bitte warten Sie, bis die KI-Aktion abgeschlossen ist.");
    await rm(this.dir(id), { recursive: true });
    return { id, deleted: true as const };
  }

  private assertSelectedUploads(record: ProcessCaptureRecord, ids: string[]) {
    if (
      new Set(ids).size !== ids.length ||
      ids.length > 5 ||
      ids.some((id) => !record.uploads.some((upload) => upload.id === id))
    )
      throw new Error(
        "Mindestens eine ausgewählte Datei gehört nicht zu diesem Prozess.",
      );
  }
  private async touch(
    record: ProcessCaptureRecord,
    state = record.state,
    confirmedAt = record.confirmedAt,
  ) {
    await this.writeMetadata({
      ...record,
      state,
      confirmedAt,
      confirmationQuality:
        state === "confirmed" ? record.confirmationQuality : null,
      updatedAt: new Date().toISOString(),
    });
  }
  private async writeRecord(record: ProcessCaptureRecord) {
    await Promise.all([
      this.writeMetadata(record),
      atomicWrite(
        join(this.dir(record.id), "cover.yaml"),
        dump(record.cover, { lineWidth: 140, noRefs: true }),
      ),
      this.writeJson(record.id, "config-snapshot.json", record.configSnapshot),
      this.writeJson(record.id, "answers.json", {
        mainAnswers: record.mainAnswers,
        workCharacteristicAnswers: record.workCharacteristicAnswers,
        selectedUploadIds: record.selectedUploadIds,
      }),
      this.writeJson(record.id, "follow-ups.json", {
        questions: record.followUps,
        answers: record.followUpAnswers,
        validationRuns: record.validationRuns,
      }),
      this.writeJson(
        record.id,
        "process-understanding.json",
        record.understanding,
      ),
    ]);
  }
  private validationInputSnapshot(
    record: Pick<
      ProcessCaptureRecord,
      "mainAnswers" | "workCharacteristicAnswers" | "selectedUploadIds"
    >,
  ) {
    return validationInputSnapshotSchema.parse({
      mainAnswers: record.mainAnswers,
      workCharacteristicAnswers: record.workCharacteristicAnswers,
      selectedUploadIds: record.selectedUploadIds,
    });
  }
  private async writeMetadata(
    record: Pick<
      ProcessCaptureRecord,
      | "schemaVersion"
      | "id"
      | "state"
      | "profile"
      | "configHash"
      | "interactionMode"
      | "confirmationQuality"
      | "confirmedAt"
      | "createdAt"
      | "updatedAt"
    >,
  ) {
    const value = metadataSchema.parse(record);
    await atomicWrite(
      join(this.dir(value.id), "metadata.yaml"),
      dump(value, { lineWidth: 140, noRefs: true }),
    );
  }
  private async writeJson(id: string, name: string, value: unknown) {
    await atomicWrite(
      join(this.dir(id), name),
      JSON.stringify(value, null, 2) + "\n",
    );
  }
}
