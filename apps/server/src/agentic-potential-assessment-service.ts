import { toAgenticPotentialAssessmentPublicRecord } from "../../../packages/domain/src/agentic-potential-assessment.ts";
import type { AgenticPotentialAssessmentAiAdapter } from "../../../packages/claude/src/agentic-potential-assessment-adapter.ts";
import type { OpportunityDiscoveryRepository } from "../../../packages/storage/src/opportunity-discovery-repository.ts";
import type { AgenticPotentialAssessmentRepository } from "../../../packages/storage/src/agentic-potential-assessment-repository.ts";
import type { ProcessCaptureRepository } from "../../../packages/storage/src/process-capture-repository.ts";
import {
  dismissFailedProcessOperations,
  enqueueProcessOperation,
  hasActiveProcessOperation,
} from "./process-operation-manager.ts";
import { publishProcessChanged } from "./process-events.ts";
import { loadAgenticAssessmentDefaults } from "./agentic-assessment-defaults.ts";

export class AgenticPotentialAssessmentService {
  constructor(
    readonly processes: ProcessCaptureRepository,
    readonly opportunities: OpportunityDiscoveryRepository,
    readonly assessments: AgenticPotentialAssessmentRepository,
    readonly ai: AgenticPotentialAssessmentAiAdapter,
    private readonly defaultsRoot?: string,
  ) {}
  enqueue(processId: string) {
    return enqueueProcessOperation(
      processId,
      "agentic-potential-assessment",
      async (signal) => {
        try {
          let record = await this.assessments.required(processId);
          const contracts = await this.assessments.contracts(processId);
          if (record.state !== "queued") return;
          record = await this.assessments.markRunning(processId);
          publishProcessChanged(processId);
          const result = await this.ai.assess({
            processId,
            configHash: record.configHash,
            model: {
              model: "opus",
              effort: "high",
              timeoutMs: record.configSnapshot.ai.timeoutMs,
              maxOutputTokens: record.configSnapshot.ai.maxOutputTokens,
              maxInputCharacters: record.configSnapshot.ai.maxInputCharacters,
              maxBudgetUsd: record.configSnapshot.ai.maxBudgetUsd,
            },
            sourceSnapshot: record.sourceSnapshot,
            contracts,
            signal,
          });
          await this.assessments.saveResult(
            processId,
            result.value,
            result.trace,
          );
          publishProcessChanged(processId);
        } catch (error) {
          const record = await this.assessments.get(processId);
          if (record?.state === "running")
            await this.assessments.markFailed(
              processId,
              "Die agentische Potenzialbewertung konnte nicht abgeschlossen werden.",
              signal.aborted,
            );
          publishProcessChanged(processId);
          throw error;
        }
      },
      async () => {
        const record = await this.assessments.get(processId);
        if (record?.state !== "queued") return;
        await this.assessments.markRunning(processId);
        await this.assessments.markFailed(
          processId,
          "Die Verarbeitung wurde abgebrochen.",
          true,
        );
        publishProcessChanged(processId);
      },
    );
  }
  async start(processId: string) {
    const process = await this.processes.required(processId);
    const opportunity = await this.opportunities.required(processId);
    if (process.state !== "confirmed")
      throw new Error(
        "Bitte bestätigen Sie zuerst das vollständige Prozessbild.",
      );
    if (opportunity.state !== "completed" || !opportunity.scenarios)
      throw new Error("Die Szenarioanalyse muss abgeschlossen sein.");
    if (this.opportunities.isStale(opportunity, process))
      throw new Error(
        "Das Prozessbild wurde nach der Szenarioanalyse geändert. Eine Bewertung ist erst nach einer aktuellen Analyse möglich.",
      );
    if (hasActiveProcessOperation(processId))
      throw new Error("Für diesen Prozess läuft bereits eine KI-Aktion.");
    const existing = await this.assessments.get(processId);
    if (existing) {
      if (existing.state !== "queued")
        throw new Error(
          "Für diesen Prozess existiert bereits eine agentische Potenzialbewertung.",
        );
      return {
        record: toAgenticPotentialAssessmentPublicRecord(existing),
        ...this.enqueue(processId),
      };
    }
    const defaults = await loadAgenticAssessmentDefaults(this.defaultsRoot);
    const record = await this.assessments.create(
      process,
      opportunity,
      defaults.config,
      defaults.contracts,
    );
    return {
      record: toAgenticPotentialAssessmentPublicRecord(record),
      ...this.enqueue(processId),
    };
  }
  async retry(processId: string) {
    const process = await this.processes.required(processId);
    const opportunity = await this.opportunities.required(processId);
    const record = await this.assessments.required(processId);
    if (record.state !== "failed")
      throw new Error(
        "Nur eine fehlgeschlagene Bewertung kann erneut gestartet werden.",
      );
    if (this.opportunities.isStale(opportunity, process))
      throw new Error(
        "Das Prozessbild ist nicht mehr aktuell. Ein technischer Retry ist nicht möglich.",
      );
    if (hasActiveProcessOperation(processId))
      throw new Error("Für diesen Prozess läuft bereits eine KI-Aktion.");
    dismissFailedProcessOperations(processId);
    await this.assessments.prepareTechnicalRetry(processId);
    return this.enqueue(processId);
  }
}
