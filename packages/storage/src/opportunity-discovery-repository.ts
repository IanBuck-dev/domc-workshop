import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { dump, load } from "js-yaml";
import { z } from "zod";
import {
  assertOpportunityScenarioReferences,
  assertOpportunityDiscoveryTransition,
  createOpportunityProcessSnapshot,
  normalizeOpportunityScenarioScope,
  selectScenarioHypotheses,
  opportunityContractManifestSchema,
  opportunityDiscoveryConfigSchema,
  opportunityDiscoveryRecordSchema,
  opportunityHypothesisResultSchema,
  type OpportunityContractSnapshot,
  type OpportunityDiscoveryConfig,
  type OpportunityDiscoveryRecord,
  type OpportunityDiscoveryState,
  type OpportunityHypothesisResult,
} from "../../domain/src/opportunity-discovery.ts";
import {
  aiTraceSchema,
  type AiTrace,
  type ProcessCaptureRecord,
} from "../../domain/src/process-understanding.ts";
import { atomicWrite } from "./atomic-write.ts";
import { audit } from "./audit-log.ts";

const metadataSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^OPP-PROC-\d{4}$/),
    processId: z.string().regex(/^PROC-\d{4}$/),
    state: z.enum([
      "hypotheses_queued",
      "hypotheses_running",
      "hypotheses_failed",
      "no_supported_hypotheses",
      "scenarios_running",
      "scenarios_failed",
      "completed",
    ]),
    sourceProcessHash: z.string().regex(/^[a-f0-9]{64}$/),
    configHash: z.string().regex(/^[a-f0-9]{64}$/),
    contractManifest: opportunityContractManifestSchema,
    lastError: z
      .object({
        phase: z.enum(["hypotheses", "scenarios"]),
        message: z.string().trim().min(1).max(500),
        cancelled: z.boolean(),
        at: z.string().datetime(),
      })
      .strict()
      .nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
const auditEntrySchema = z.object({
  at: z.string().datetime(),
  event: z.string().min(1),
  detail: z.unknown(),
});

const contractFiles = {
  basePrompt: "opportunity-base.md",
  hypothesesPrompt: "opportunity-hypotheses.md",
  scenariosPrompt: "opportunity-scenarios.md",
  hypothesesSchema: "opportunity-hypotheses.schema.json",
  scenariosSchema: "opportunity-scenarios.schema.json",
} as const;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function hash(value: unknown) {
  const content = typeof value === "string" ? value : canonical(value);
  return createHash("sha256").update(content).digest("hex");
}
function manifest(contracts: OpportunityContractSnapshot) {
  return opportunityContractManifestSchema.parse({
    basePrompt: hash(contracts.basePrompt),
    hypothesesPrompt: hash(contracts.hypothesesPrompt),
    scenariosPrompt: hash(contracts.scenariosPrompt),
    hypothesesSchema: hash(contracts.hypothesesSchema),
    scenariosSchema: hash(contracts.scenariosSchema),
  });
}
function allHypotheses(result: OpportunityHypothesisResult | null) {
  return result?.stepAnalyses.flatMap((analysis) => analysis.hypotheses) ?? [];
}

export class OpportunityDiscoveryNotFoundError extends Error {
  constructor() {
    super("KI-Potenzialanalyse nicht gefunden.");
    this.name = "OpportunityDiscoveryNotFoundError";
  }
}

export class OpportunityDiscoveryRepository {
  constructor(public root: string) {}

  dir(processId: string) {
    if (!/^PROC-\d{4}$/.test(processId))
      throw new Error("Ungültige Prozess-ID.");
    return join(
      this.root,
      "process-captures",
      processId,
      "opportunity-discovery",
    );
  }

  async get(processId: string): Promise<OpportunityDiscoveryRecord | null> {
    try {
      const dir = this.dir(processId);
      const [metadata, sourceProcess, configSnapshot, hypotheses, scenarios] =
        await Promise.all([
          readFile(join(dir, "metadata.yaml"), "utf8").then((text) =>
            metadataSchema.parse(load(text)),
          ),
          Bun.file(join(dir, "source-process.json")).json(),
          Bun.file(join(dir, "config-snapshot.json")).json(),
          Bun.file(join(dir, "hypotheses.json")).json(),
          Bun.file(join(dir, "scenarios.json")).json(),
        ]);
      const record = opportunityDiscoveryRecordSchema.parse({
        ...metadata,
        sourceProcess,
        configSnapshot,
        hypotheses,
        scenarios,
      });
      if (hash(record.sourceProcess) !== record.sourceProcessHash)
        throw new Error("Der Prozesssnapshot wurde verändert.");
      if (hash(record.configSnapshot) !== record.configHash)
        throw new Error("Der Konfigurationssnapshot wurde verändert.");
      return record;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async required(processId: string) {
    const record = await this.get(processId);
    if (!record) throw new OpportunityDiscoveryNotFoundError();
    return record;
  }

  async create(
    process: ProcessCaptureRecord,
    configInput: unknown,
    contracts: OpportunityContractSnapshot,
  ) {
    const target = this.dir(process.id);
    try {
      await access(target);
      throw new Error(
        "Für diesen Prozess existiert bereits eine KI-Potenzialanalyse.",
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const sourceProcess = createOpportunityProcessSnapshot(process);
    const configSnapshot = opportunityDiscoveryConfigSchema.parse(configInput);
    const contractManifest = manifest(contracts);
    const now = new Date().toISOString();
    const record = opportunityDiscoveryRecordSchema.parse({
      schemaVersion: 1,
      id: `OPP-${process.id}`,
      processId: process.id,
      state: "hypotheses_queued",
      sourceProcessHash: hash(sourceProcess),
      configHash: hash(configSnapshot),
      sourceProcess,
      configSnapshot,
      contractManifest,
      hypotheses: null,
      scenarios: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    });
    const temporary = join(
      this.root,
      "process-captures",
      process.id,
      `.opportunity-discovery-${crypto.randomUUID()}.tmp`,
    );
    try {
      await mkdir(join(temporary, "contracts"), { recursive: true });
      await Promise.all([
        atomicWrite(join(temporary, "metadata.yaml"), this.metadata(record)),
        atomicWrite(
          join(temporary, "source-process.json"),
          JSON.stringify(sourceProcess, null, 2) + "\n",
        ),
        atomicWrite(
          join(temporary, "config-snapshot.json"),
          JSON.stringify(configSnapshot, null, 2) + "\n",
        ),
        atomicWrite(
          join(temporary, "contract-manifest.json"),
          JSON.stringify(contractManifest, null, 2) + "\n",
        ),
        atomicWrite(join(temporary, "hypotheses.json"), "null\n"),
        atomicWrite(join(temporary, "scenarios.json"), "null\n"),
        ...Object.entries(contractFiles).map(([key, name]) => {
          const value = contracts[key as keyof OpportunityContractSnapshot];
          return atomicWrite(
            join(temporary, "contracts", name),
            typeof value === "string"
              ? value
              : JSON.stringify(value, null, 2) + "\n",
          );
        }),
        atomicWrite(join(temporary, "operations.jsonl"), ""),
        atomicWrite(join(temporary, "history.jsonl"), ""),
      ]);
      await audit(
        join(temporary, "history.jsonl"),
        "opportunity-discovery-created",
        {
          sourceProcessHash: record.sourceProcessHash,
          configHash: record.configHash,
          contractManifest,
        },
      );
      await rename(temporary, target);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
    return this.required(process.id);
  }

  async contracts(processId: string): Promise<OpportunityContractSnapshot> {
    const record = await this.required(processId);
    const dir = join(this.dir(processId), "contracts");
    const values = await Promise.all(
      Object.values(contractFiles).map((name) =>
        readFile(join(dir, name), "utf8"),
      ),
    );
    const contracts: OpportunityContractSnapshot = {
      basePrompt: values[0]!,
      hypothesesPrompt: values[1]!,
      scenariosPrompt: values[2]!,
      hypothesesSchema: JSON.parse(values[3]!),
      scenariosSchema: JSON.parse(values[4]!),
    };
    if (
      JSON.stringify(manifest(contracts)) !==
      JSON.stringify(record.contractManifest)
    )
      throw new Error("Der gespeicherte KI-Vertrag wurde verändert.");
    return contracts;
  }

  async markHypothesesRunning(processId: string) {
    const record = await this.required(processId);
    if (record.state !== "hypotheses_queued")
      throw new Error(
        "Die Hypothesenphase kann in diesem Zustand nicht starten.",
      );
    return this.transition(
      record,
      "hypotheses_running",
      null,
      "hypotheses-started",
      {},
    );
  }

  async saveHypotheses(
    processId: string,
    resultInput: unknown,
    trace: AiTrace,
  ) {
    const record = await this.required(processId);
    if (record.state !== "hypotheses_running")
      throw new Error(
        "Die Hypothesen können in diesem Zustand nicht gespeichert werden.",
      );
    const result = opportunityHypothesisResultSchema.parse(resultInput);
    const high = allHypotheses(result).filter(
      (hypothesis) => hypothesis.confidenceLevel === "high",
    );
    const medium = allHypotheses(result).filter(
      (hypothesis) => hypothesis.confidenceLevel === "medium",
    );
    const selection = selectScenarioHypotheses(result);
    await this.writeJson(processId, "hypotheses.json", result);
    await this.recordOperation(processId, "opportunity-hypotheses", trace);
    const state = selection.basis
      ? "scenarios_running"
      : "no_supported_hypotheses";
    return this.transition(record, state, null, "hypotheses-completed", {
      count: allHypotheses(result).length,
      highConfidenceCount: high.length,
      mediumConfidenceCount: medium.length,
      scenarioBasis: selection.basis,
      selectedHypothesisIds: selection.hypotheses.map(
        (hypothesis) => hypothesis.id,
      ),
      trace,
    });
  }

  async saveScenarios(processId: string, resultInput: unknown, trace: AiTrace) {
    const record = await this.required(processId);
    if (record.state !== "scenarios_running" || !record.hypotheses)
      throw new Error(
        "Die Szenarien können in diesem Zustand nicht gespeichert werden.",
      );
    const selection = selectScenarioHypotheses(record.hypotheses);
    if (!selection.basis)
      throw new Error("Die Evidenzbasis für Szenarien ist nicht ausreichend.");
    const referenceContext = {
      scenarioBasis: selection.basis,
      scenarioHypotheses: selection.hypotheses.map(
        ({ id, processStepId, confidenceLevel }) => ({
          id,
          processStepId,
          confidenceLevel,
        }),
      ),
      processStepIds: record.sourceProcess.understanding.steps.map(
        (step) => step.id,
      ),
      evidenceIds: record.sourceProcess.understanding.evidence.map(
        (item) => item.id,
      ),
    };
    const normalizedResult = normalizeOpportunityScenarioScope(
      resultInput,
      referenceContext,
    );
    const result = assertOpportunityScenarioReferences(
      normalizedResult,
      referenceContext,
    );
    await this.writeJson(processId, "scenarios.json", result);
    await this.recordOperation(processId, "opportunity-scenarios", trace);
    return this.transition(record, "completed", null, "scenarios-completed", {
      trace,
      count: result.scenarios.length,
    });
  }

  async markPhaseFailed(
    processId: string,
    phase: "hypotheses" | "scenarios",
    message: string,
    cancelled = false,
  ) {
    const record = await this.required(processId);
    const expected =
      phase === "hypotheses" ? "hypotheses_running" : "scenarios_running";
    if (record.state !== expected)
      throw new Error("Die aktive Phase stimmt nicht mit dem Fehler überein.");
    const error = {
      phase,
      message: z.string().trim().min(1).max(500).parse(message),
      cancelled,
      at: new Date().toISOString(),
    };
    return this.transition(
      record,
      phase === "hypotheses" ? "hypotheses_failed" : "scenarios_failed",
      error,
      `${phase}-failed`,
      error,
    );
  }

  async prepareTechnicalRetry(processId: string) {
    const record = await this.required(processId);
    if (record.state === "hypotheses_failed")
      return this.transition(
        record,
        "hypotheses_queued",
        null,
        "technical-retry-started",
        { phase: "hypotheses" },
      );
    if (record.state === "scenarios_failed")
      return this.transition(
        record,
        "scenarios_running",
        null,
        "technical-retry-started",
        { phase: "scenarios" },
      );
    throw new Error(
      "Nur eine fehlgeschlagene Phase kann erneut gestartet werden.",
    );
  }

  async recoverInterrupted() {
    const processRoot = join(this.root, "process-captures");
    const ids = await readdir(processRoot).catch(() => []);
    let recovered = 0;
    for (const processId of ids.filter((id) => /^PROC-\d{4}$/.test(id))) {
      const processDir = join(processRoot, processId);
      const children = await readdir(processDir, { withFileTypes: true }).catch(
        () => [],
      );
      await Promise.all(
        children
          .filter(
            (entry) =>
              entry.isDirectory() &&
              /^\.opportunity-discovery-[a-f0-9-]+\.tmp$/.test(entry.name),
          )
          .map((entry) =>
            rm(join(processDir, entry.name), { recursive: true, force: true }),
          ),
      );
      const record = await this.get(processId);
      if (!record) continue;
      if (["hypotheses_queued", "hypotheses_running"].includes(record.state)) {
        const running =
          record.state === "hypotheses_queued"
            ? await this.transition(
                record,
                "hypotheses_running",
                null,
                "hypotheses-started",
                { recovered: true },
              )
            : record;
        await this.markPhaseFailed(
          running.processId,
          "hypotheses",
          "Die Verarbeitung wurde durch einen Serverneustart unterbrochen.",
        );
        recovered += 1;
      } else if (record.state === "scenarios_running") {
        await this.markPhaseFailed(
          record.processId,
          "scenarios",
          "Die Verarbeitung wurde durch einen Serverneustart unterbrochen.",
        );
        recovered += 1;
      }
    }
    return recovered;
  }

  isStale(record: OpportunityDiscoveryRecord, process: ProcessCaptureRecord) {
    try {
      return (
        hash(createOpportunityProcessSnapshot(process)) !==
        record.sourceProcessHash
      );
    } catch {
      return true;
    }
  }

  summary(record: OpportunityDiscoveryRecord, process: ProcessCaptureRecord) {
    const hypotheses = allHypotheses(record.hypotheses);
    return {
      processId: record.processId,
      state: record.state,
      isStale: this.isStale(record, process),
      hypothesisCount: hypotheses.length,
      highConfidenceHypothesisCount: hypotheses.filter(
        (item) => item.confidenceLevel === "high",
      ).length,
      scenarioCount: record.scenarios ? (3 as const) : (0 as const),
      updatedAt: record.updatedAt,
    };
  }

  async history(processId: string) {
    await this.required(processId);
    return (await readFile(join(this.dir(processId), "history.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((line) => auditEntrySchema.parse(JSON.parse(line)))
      .reverse();
  }

  private async transition(
    record: OpportunityDiscoveryRecord,
    state: OpportunityDiscoveryState,
    lastError: OpportunityDiscoveryRecord["lastError"],
    event: string,
    detail: unknown,
  ) {
    assertOpportunityDiscoveryTransition(record.state, state);
    const next = {
      ...record,
      state,
      lastError,
      updatedAt: new Date().toISOString(),
    };
    await this.writeMetadata(next);
    await audit(
      join(this.dir(record.processId), "history.jsonl"),
      event,
      detail,
    );
    return this.required(record.processId);
  }

  private async recordOperation(
    processId: string,
    operationName: string,
    traceInput: AiTrace,
  ) {
    const trace = aiTraceSchema.parse(traceInput);
    await audit(join(this.dir(processId), "operations.jsonl"), operationName, {
      operationName,
      state: "completed",
      trace,
    });
  }

  private async writeMetadata(record: OpportunityDiscoveryRecord) {
    await atomicWrite(
      join(this.dir(record.processId), "metadata.yaml"),
      this.metadata(record),
    );
  }

  private metadata(record: OpportunityDiscoveryRecord) {
    const value = metadataSchema.parse({
      schemaVersion: record.schemaVersion,
      id: record.id,
      processId: record.processId,
      state: record.state,
      sourceProcessHash: record.sourceProcessHash,
      configHash: record.configHash,
      contractManifest: record.contractManifest,
      lastError: record.lastError,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
    return dump(value, { lineWidth: 140, noRefs: true });
  }

  private async writeJson(processId: string, name: string, value: unknown) {
    await atomicWrite(
      join(this.dir(processId), name),
      JSON.stringify(value, null, 2) + "\n",
    );
  }
}

export function opportunityConfigHash(config: OpportunityDiscoveryConfig) {
  return hash(opportunityDiscoveryConfigSchema.parse(config));
}
