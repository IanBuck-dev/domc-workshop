import {
  normalizeOpportunityHypotheses,
  selectScenarioHypotheses,
  toOpportunityDiscoveryPublicRecord,
} from "../../../packages/domain/src/opportunity-discovery.ts";
import type { ProcessCaptureRepository } from "../../../packages/storage/src/process-capture-repository.ts";
import type { OpportunityDiscoveryRepository } from "../../../packages/storage/src/opportunity-discovery-repository.ts";
import type { OpportunityAiAdapter } from "../../../packages/claude/src/opportunity-ai-contracts.ts";
import {
  dismissFailedProcessOperations,
  enqueueProcessOperation,
  hasActiveProcessOperation,
} from "./process-operation-manager.ts";
import { publishProcessChanged } from "./process-events.ts";
import { loadOpportunityDefaults } from "./opportunity-defaults.ts";

function publicFailure() {
  return "Die KI-Potenzialanalyse konnte nicht abgeschlossen werden. Die bereits verfügbaren Ergebnisse bleiben erhalten.";
}

export class OpportunityDiscoveryService {
  constructor(
    readonly processes: ProcessCaptureRepository,
    readonly opportunities: OpportunityDiscoveryRepository,
    private readonly ai: OpportunityAiAdapter,
    private readonly defaultsRoot?: string,
  ) {}

  enqueue(processId: string) {
    return enqueueProcessOperation(
      processId,
      "opportunity-discovery",
      async (signal) => {
        try {
          let record = await this.opportunities.required(processId);
          const contracts = await this.opportunities.contracts(processId);
          const model = {
            model: "claude-opus-4-8",
            effort: "high",
            timeoutMs: record.configSnapshot.ai.timeoutMs,
            maxOutputTokens: record.configSnapshot.ai.maxOutputTokens,
            maxInputCharacters: record.configSnapshot.ai.maxInputCharacters,
            maxBudgetUsd: record.configSnapshot.ai.maxBudgetUsd,
          } as const;
          if (record.state === "hypotheses_queued") {
            record = await this.opportunities.markHypothesesRunning(processId);
            publishProcessChanged(processId);
            const result = await this.ai.discoverHypotheses({
              processId,
              configHash: record.configHash,
              model,
              sourceProcess: record.sourceProcess,
              contracts,
              instructions: record.configSnapshot.instructions.hypotheses,
              signal,
            });
            record = await this.opportunities.saveHypotheses(
              processId,
              normalizeOpportunityHypotheses(
                result.value,
                record.sourceProcess,
              ),
              result.trace,
            );
            publishProcessChanged(processId);
          }
          if (record.state !== "scenarios_running") return;
          const selection = selectScenarioHypotheses(record.hypotheses);
          if (!selection.basis)
            throw new Error(
              "Die Evidenzbasis für die Szenarienphase ist nicht ausreichend.",
            );
          const result = await this.ai.createScenarios({
            processId,
            configHash: record.configHash,
            model,
            sourceProcess: record.sourceProcess,
            contracts,
            instructions: record.configSnapshot.instructions.scenarios,
            scenarioBasis: selection.basis,
            scenarioHypotheses: selection.hypotheses,
            signal,
          });
          await this.opportunities.saveScenarios(
            processId,
            result.value,
            result.trace,
          );
          publishProcessChanged(processId);
        } catch (error) {
          const record = await this.opportunities.get(processId);
          if (
            record &&
            ["hypotheses_running", "scenarios_running"].includes(record.state)
          )
            await this.opportunities.markPhaseFailed(
              processId,
              record.state === "hypotheses_running"
                ? "hypotheses"
                : "scenarios",
              publicFailure(),
              signal.aborted,
            );
          publishProcessChanged(processId);
          throw error;
        }
      },
      async () => {
        const record = await this.opportunities.get(processId);
        if (record?.state !== "hypotheses_queued") return;
        await this.opportunities.markHypothesesRunning(processId);
        await this.opportunities.markPhaseFailed(
          processId,
          "hypotheses",
          publicFailure(),
          true,
        );
        publishProcessChanged(processId);
      },
    );
  }

  async start(processId: string) {
    const process = await this.processes.required(processId);
    if (process.state !== "confirmed")
      throw new Error(
        "Bitte bestätigen Sie zuerst das vollständige Prozessbild.",
      );
    if (process.profile.version !== 2)
      throw new Error(
        "Diese ältere Prozessaufnahme enthält noch nicht die erforderlichen Arbeitsmerkmale.",
      );
    const existing = await this.opportunities.get(processId);
    if (existing) {
      if (existing.state !== "hypotheses_queued")
        throw new Error(
          "Für diesen Prozess existiert bereits eine KI-Potenzialanalyse.",
        );
      if (hasActiveProcessOperation(processId))
        throw new Error("Für diesen Prozess läuft bereits eine KI-Aktion.");
      return {
        record: toOpportunityDiscoveryPublicRecord(existing),
        ...this.enqueue(processId),
      };
    }
    if (hasActiveProcessOperation(processId))
      throw new Error("Für diesen Prozess läuft bereits eine KI-Aktion.");
    const defaults = await loadOpportunityDefaults(this.defaultsRoot);
    const record = await this.opportunities.create(
      process,
      defaults.config,
      defaults.contracts,
    );
    return {
      record: toOpportunityDiscoveryPublicRecord(record),
      ...this.enqueue(processId),
    };
  }

  async retry(processId: string) {
    const process = await this.processes.required(processId);
    const record = await this.opportunities.required(processId);
    if (this.opportunities.isStale(record, process))
      throw new Error(
        "Das Prozessbild wurde nach dem Start dieser Analyse geändert. Ein technischer Retry ist deshalb nicht möglich.",
      );
    if (hasActiveProcessOperation(processId))
      throw new Error("Für diesen Prozess läuft bereits eine KI-Aktion.");
    dismissFailedProcessOperations(processId);
    await this.opportunities.prepareTechnicalRetry(processId);
    return this.enqueue(processId);
  }
}
