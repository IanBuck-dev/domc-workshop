import { join } from "node:path";
import { loadAgenticAssessmentDefaults } from "../apps/server/src/agentic-assessment-defaults.ts";
import {
  assessableCriterionIds,
  type AgenticPotentialAssessmentRecord,
} from "../packages/domain/src/agentic-potential-assessment.ts";
import type { ProcessCaptureRecord } from "../packages/domain/src/process-understanding.ts";
import type { AgenticPotentialAssessmentRepository } from "../packages/storage/src/agentic-potential-assessment-repository.ts";
import type { OpportunityDiscoveryRepository } from "../packages/storage/src/opportunity-discovery-repository.ts";
import {
  aiTrace,
  normalizedHypotheses,
  opportunityDefaults,
  scenarioResult,
} from "./opportunity-fixtures.ts";

export async function completedOpportunity(
  process: ProcessCaptureRecord,
  opportunities: OpportunityDiscoveryRepository,
) {
  const defaults = await opportunityDefaults();
  await opportunities.create(process, defaults.config, defaults.contracts);
  await opportunities.markHypothesesRunning(process.id);
  await opportunities.saveHypotheses(
    process.id,
    normalizedHypotheses(),
    aiTrace(),
  );
  return opportunities.saveScenarios(process.id, scenarioResult(), aiTrace());
}

export function assessmentAiResult(
  status: "scored" | "insufficient_evidence" = "scored",
) {
  return {
    schemaVersion: 1 as const,
    criteria: assessableCriterionIds.map((criterionId) =>
      status === "scored"
        ? {
            status: "scored" as const,
            criterionId,
            score: 2 as const,
            confidenceLevel: "high" as const,
            rationale: "Prozessbild und Hypothese belegen dieses Kriterium.",
            evidenceIds: ["flow-roles"],
            hypothesisIds: ["HYP-001"],
            assumptions: [],
            openQuestions: [],
          }
        : {
            status: "insufficient_evidence" as const,
            criterionId,
            score: null,
            confidenceLevel: "medium" as const,
            rationale: "Für eine belastbare Einstufung fehlen Informationen.",
            evidenceIds: [],
            hypothesisIds: ["HYP-001"],
            assumptions: ["Die technische Anbindung ist noch ungeklärt."],
            openQuestions: ["Welche Schnittstelle steht bereit?"],
          },
    ),
  };
}

export async function assessmentDefaults() {
  return loadAgenticAssessmentDefaults(join(import.meta.dir, "..", "defaults"));
}

export async function completedAssessment(
  process: ProcessCaptureRecord,
  opportunity: unknown,
  assessments: AgenticPotentialAssessmentRepository,
): Promise<AgenticPotentialAssessmentRecord> {
  const defaults = await assessmentDefaults();
  await assessments.create(
    process,
    opportunity,
    defaults.config,
    defaults.contracts,
  );
  await assessments.markRunning(process.id);
  return assessments.saveResult(process.id, assessmentAiResult(), aiTrace());
}
