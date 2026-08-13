import { mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { dump, load } from "js-yaml";
import { z } from "zod";
import {
  agenticAssessmentContractManifestSchema,
  agenticPotentialAssessmentConfigSchema,
  agenticPotentialAssessmentRecordSchema,
  agenticAssessmentRevision,
  assertAgenticAssessmentTransition,
  createAgenticAssessmentSourceSnapshot,
  hashAgenticAssessment,
  normalizeAgenticAssessment,
  type AgenticAssessmentSourceSnapshot,
  type AgenticPotentialAssessmentRecord,
} from "../../domain/src/agentic-potential-assessment.ts";
import { opportunityDiscoveryRecordSchema } from "../../domain/src/opportunity-discovery.ts";
import type { ProcessCaptureRecord } from "../../domain/src/process-understanding.ts";
import { atomicWrite } from "./atomic-write.ts";
import { audit } from "./audit-log.ts";

const metadataSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string(),
    processId: z.string(),
    state: z.enum(["queued", "running", "completed", "failed"]),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    configHash: z.string().regex(/^[a-f0-9]{64}$/),
    contractManifest: agenticAssessmentContractManifestSchema,
    assessmentRevision: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    lastError: z
      .object({
        message: z.string(),
        cancelled: z.boolean(),
        at: z.string().datetime(),
      })
      .nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
const files = {
  prompt: "agentic-potential-assessment.md",
  schema: "agentic-potential-assessment.schema.json",
} as const;
export interface AgenticAssessmentContracts {
  prompt: string;
  schema: object;
}
const manifest = (contracts: AgenticAssessmentContracts) =>
  agenticAssessmentContractManifestSchema.parse({
    prompt: hashAgenticAssessment(contracts.prompt),
    schema: hashAgenticAssessment(contracts.schema),
  });
function freezeContractsForSource(
  contracts: AgenticAssessmentContracts,
  source: AgenticAssessmentSourceSnapshot,
): AgenticAssessmentContracts {
  const schema = structuredClone(contracts.schema) as Record<string, unknown>;
  const properties = schema.properties as Record<string, unknown> | undefined;
  const criteria = properties?.criteria as Record<string, unknown> | undefined;
  const items = criteria?.items as Record<string, unknown> | undefined;
  const variants = items?.oneOf;
  if (!Array.isArray(variants) || variants.length !== 2)
    throw new Error("Das JSON-Schema der Bewertung ist unvollständig.");
  const evidenceIds = source.opportunity.understanding.evidence.map(
    (item) => item.id,
  );
  const hypothesisIds = source.hypotheses.map((item) => item.id);
  for (const variant of variants) {
    const variantProperties = (variant as Record<string, unknown>)
      .properties as Record<string, unknown> | undefined;
    const evidence = variantProperties?.evidenceIds as
      Record<string, unknown> | undefined;
    const hypotheses = variantProperties?.hypothesisIds as
      Record<string, unknown> | undefined;
    if (!evidence || !hypotheses)
      throw new Error("Das JSON-Schema der Referenzen ist unvollständig.");
    evidence.items = { type: "string", enum: evidenceIds };
    hypotheses.items = { type: "string", enum: hypothesisIds };
  }
  return { prompt: contracts.prompt, schema };
}
export class AgenticPotentialAssessmentNotFoundError extends Error {
  constructor() {
    super("Agentische Potenzialbewertung nicht gefunden.");
    this.name = "AgenticPotentialAssessmentNotFoundError";
  }
}
export class AgenticPotentialAssessmentRepository {
  constructor(public root: string) {}
  dir(processId: string) {
    if (!/^PROC-\d{4}$/.test(processId))
      throw new Error("Ungültige Prozess-ID.");
    return join(
      this.root,
      "process-captures",
      processId,
      "opportunity-discovery",
      "agentic-assessment",
    );
  }
  async get(
    processId: string,
  ): Promise<AgenticPotentialAssessmentRecord | null> {
    try {
      const dir = this.dir(processId);
      const [metadata, sourceSnapshot, configSnapshot, result] =
        await Promise.all([
          readFile(join(dir, "metadata.yaml"), "utf8").then((text) =>
            metadataSchema.parse(load(text)),
          ),
          Bun.file(join(dir, "source-snapshot.json")).json(),
          Bun.file(join(dir, "config-snapshot.json")).json(),
          Bun.file(join(dir, "result.json")).json(),
        ]);
      if (hashAgenticAssessment(sourceSnapshot) !== metadata.sourceHash)
        throw new Error("Der Bewertungssnapshot wurde verändert.");
      if (hashAgenticAssessment(configSnapshot) !== metadata.configHash)
        throw new Error("Der Bewertungskatalog wurde verändert.");
      const record = agenticPotentialAssessmentRecordSchema.parse({
        ...metadata,
        sourceSnapshot,
        configSnapshot,
        result: metadata.state === "completed" ? result : null,
      });
      if (
        record.state === "completed" &&
        agenticAssessmentRevision(
          record.sourceSnapshot,
          record.configSnapshot,
          record.contractManifest,
          record.result,
        ) !== record.assessmentRevision
      )
        throw new Error("Das gespeicherte Bewertungsergebnis wurde verändert.");
      return record;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  async required(processId: string) {
    const record = await this.get(processId);
    if (!record) throw new AgenticPotentialAssessmentNotFoundError();
    return record;
  }
  async create(
    process: ProcessCaptureRecord,
    opportunityInput: unknown,
    configInput: unknown,
    contracts: AgenticAssessmentContracts,
  ) {
    const opportunity =
      opportunityDiscoveryRecordSchema.parse(opportunityInput);
    if (await this.get(process.id))
      throw new Error(
        "Für diesen Prozess existiert bereits eine agentische Potenzialbewertung.",
      );
    const configSnapshot =
      agenticPotentialAssessmentConfigSchema.parse(configInput);
    const sourceSnapshot = createAgenticAssessmentSourceSnapshot(
      opportunity,
      configSnapshot,
    );
    const frozenContracts = freezeContractsForSource(contracts, sourceSnapshot);
    const now = new Date().toISOString();
    const record = agenticPotentialAssessmentRecordSchema.parse({
      schemaVersion: 1,
      id: `APA-${process.id}`,
      processId: process.id,
      state: "queued",
      sourceHash: hashAgenticAssessment(sourceSnapshot),
      configHash: hashAgenticAssessment(configSnapshot),
      contractManifest: manifest(frozenContracts),
      sourceSnapshot,
      configSnapshot,
      result: null,
      lastError: null,
      assessmentRevision: null,
      createdAt: now,
      updatedAt: now,
    });
    const target = this.dir(process.id);
    const temporary = join(
      this.root,
      "process-captures",
      process.id,
      "opportunity-discovery",
      `.agentic-assessment-${crypto.randomUUID()}.tmp`,
    );
    await mkdir(join(temporary, "contracts"), { recursive: true });
    try {
      await Promise.all([
        atomicWrite(
          join(temporary, "metadata.yaml"),
          dump(this.metadata(record)),
        ),
        atomicWrite(
          join(temporary, "source-snapshot.json"),
          JSON.stringify(sourceSnapshot, null, 2) + "\n",
        ),
        atomicWrite(
          join(temporary, "config-snapshot.json"),
          JSON.stringify(configSnapshot, null, 2) + "\n",
        ),
        atomicWrite(
          join(temporary, "contract-manifest.json"),
          JSON.stringify(record.contractManifest, null, 2) + "\n",
        ),
        atomicWrite(join(temporary, "result.json"), "null\n"),
        atomicWrite(
          join(temporary, "contracts", files.prompt),
          frozenContracts.prompt,
        ),
        atomicWrite(
          join(temporary, "contracts", files.schema),
          JSON.stringify(frozenContracts.schema, null, 2) + "\n",
        ),
        atomicWrite(join(temporary, "operations.jsonl"), ""),
        atomicWrite(join(temporary, "history.jsonl"), ""),
      ]);
      await audit(
        join(temporary, "history.jsonl"),
        "agentic-assessment-created",
        {
          sourceHash: record.sourceHash,
          configHash: record.configHash,
          contractManifest: record.contractManifest,
        },
      );
      await rename(temporary, target);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
    return this.required(process.id);
  }
  async contracts(processId: string): Promise<AgenticAssessmentContracts> {
    const record = await this.required(processId);
    const dir = join(this.dir(processId), "contracts");
    const contracts = {
      prompt: await readFile(join(dir, files.prompt), "utf8"),
      schema: JSON.parse(await readFile(join(dir, files.schema), "utf8")),
    };
    if (
      JSON.stringify(manifest(contracts)) !==
      JSON.stringify(record.contractManifest)
    )
      throw new Error("Der gespeicherte KI-Vertrag wurde verändert.");
    return contracts;
  }
  async markRunning(processId: string) {
    const record = await this.required(processId);
    if (record.state !== "queued")
      throw new Error("Die Bewertung kann in diesem Zustand nicht starten.");
    return this.transition(
      record,
      "running",
      null,
      null,
      "agentic-assessment-started",
      {},
    );
  }
  async saveResult(processId: string, input: unknown, trace: unknown) {
    const record = await this.required(processId);
    if (record.state !== "running")
      throw new Error(
        "Die Bewertung kann in diesem Zustand nicht gespeichert werden.",
      );
    const result = normalizeAgenticAssessment(input, record.sourceSnapshot);
    const revision = agenticAssessmentRevision(
      record.sourceSnapshot,
      record.configSnapshot,
      record.contractManifest,
      result,
    );
    await this.writeJson(processId, "result.json", result);
    await audit(
      join(this.dir(processId), "operations.jsonl"),
      "agentic-potential-assessment",
      { state: "completed", trace },
    );
    return this.transition(
      record,
      "completed",
      result,
      revision,
      "agentic-assessment-completed",
      { assessmentRevision: revision, trace },
    );
  }
  async markFailed(processId: string, message: string, cancelled = false) {
    const record = await this.required(processId);
    if (record.state !== "running")
      throw new Error("Die Bewertung ist nicht aktiv.");
    return this.transition(
      record,
      "failed",
      null,
      null,
      "agentic-assessment-failed",
      { message, cancelled },
    );
  }
  async prepareTechnicalRetry(processId: string) {
    const record = await this.required(processId);
    if (record.state !== "failed")
      throw new Error(
        "Nur eine fehlgeschlagene Bewertung kann erneut gestartet werden.",
      );
    return this.transition(
      record,
      "queued",
      null,
      null,
      "agentic-assessment-retry-started",
      {},
    );
  }
  async recoverInterrupted() {
    const root = join(this.root, "process-captures");
    const ids = await readdir(root).catch(() => [] as string[]);
    for (const processId of ids.filter((id) => /^PROC-\d{4}$/.test(id))) {
      const record = await this.get(processId);
      if (record?.state === "queued") {
        await this.markRunning(processId);
        await this.markFailed(
          processId,
          "Die Verarbeitung wurde durch einen Serverneustart unterbrochen.",
        );
      } else if (record?.state === "running")
        await this.markFailed(
          processId,
          "Die Verarbeitung wurde durch einen Serverneustart unterbrochen.",
        );
    }
  }
  isStale(record: AgenticPotentialAssessmentRecord, opportunityInput: unknown) {
    try {
      const opportunity =
        opportunityDiscoveryRecordSchema.parse(opportunityInput);
      return (
        opportunity.sourceProcessHash !==
          record.sourceSnapshot.sourceProcessHash ||
        opportunity.state !== "completed"
      );
    } catch {
      return true;
    }
  }
  async recordExport(processId: string, detail: unknown) {
    await audit(
      join(this.dir(processId), "history.jsonl"),
      "agentic-assessment-exported",
      detail,
    );
  }
  private async transition(
    record: AgenticPotentialAssessmentRecord,
    state: AgenticPotentialAssessmentRecord["state"],
    result: AgenticPotentialAssessmentRecord["result"],
    revision: string | null,
    event: string,
    detail: unknown,
  ) {
    assertAgenticAssessmentTransition(record.state, state);
    const next = {
      ...record,
      state,
      result,
      assessmentRevision: revision,
      lastError:
        state === "failed"
          ? {
              message: z
                .string()
                .trim()
                .min(1)
                .max(500)
                .parse((detail as { message: string }).message),
              cancelled: Boolean((detail as { cancelled?: boolean }).cancelled),
              at: new Date().toISOString(),
            }
          : null,
      updatedAt: new Date().toISOString(),
    };
    await atomicWrite(
      join(this.dir(record.processId), "metadata.yaml"),
      dump(this.metadata(next)),
    );
    await audit(
      join(this.dir(record.processId), "history.jsonl"),
      event,
      detail,
    );
    return this.required(record.processId);
  }
  private metadata(record: AgenticPotentialAssessmentRecord) {
    return metadataSchema.parse({
      schemaVersion: record.schemaVersion,
      id: record.id,
      processId: record.processId,
      state: record.state,
      sourceHash: record.sourceHash,
      configHash: record.configHash,
      contractManifest: record.contractManifest,
      assessmentRevision: record.assessmentRevision,
      lastError: record.lastError,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
  private writeJson(processId: string, name: string, value: unknown) {
    return atomicWrite(
      join(this.dir(processId), name),
      JSON.stringify(value, null, 2) + "\n",
    );
  }
}
