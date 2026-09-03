import { join } from "node:path";
import { loadAgenticAssessmentDefaults } from "../apps/server/src/agentic-assessment-defaults.ts";
import { loadOpportunityDefaults } from "../apps/server/src/opportunity-defaults.ts";
import {
  agenticPotentialScore,
  assessableCriterionIds,
} from "../packages/domain/src/agentic-potential-assessment.ts";
import {
  opportunityHypothesisResultSchema,
  opportunityScenarioResultSchema,
  scenarioLevels,
  type OpportunityHypothesisResult,
  type OpportunityScenario,
  type ScenarioLevel,
} from "../packages/domain/src/opportunity-discovery.ts";
import type {
  AiTrace,
  ProcessCaptureRecord,
} from "../packages/domain/src/process-understanding.ts";
import { AgenticPotentialAssessmentRepository } from "../packages/storage/src/agentic-potential-assessment-repository.ts";
import { OpportunityDiscoveryRepository } from "../packages/storage/src/opportunity-discovery-repository.ts";
import type { ShowcaseJourneyFixture } from "./showcase-journey-fixtures.ts";

const trace = (): AiTrace => ({
  operationId: crypto.randomUUID(),
  sessionId: null,
  model: "deterministischer-demo-seed",
  durationMs: 0,
  inputTokens: 0,
  outputTokens: 0,
  sandboxed: true,
});

function hypotheses(
  process: ProcessCaptureRecord,
  fixture: ShowcaseJourneyFixture,
): OpportunityHypothesisResult {
  if (!process.understanding)
    throw new Error("Der Showcase-Prozess besitzt kein Prozessbild.");
  const byOrder = new Map(
    process.understanding.steps.map((step) => [step.order, step]),
  );
  const byStep = new Map<
    number,
    OpportunityHypothesisResult["stepAnalyses"][number]["hypotheses"]
  >();
  fixture.hypotheses.forEach((content, index) => {
    const step = byOrder.get(content.stepOrder);
    if (!step)
      throw new Error(
        `Showcase-Journey „${fixture.slug}" verweist auf den fehlenden Schritt ${content.stepOrder}.`,
      );
    const evidenceIds = step.evidenceIds.length
      ? step.evidenceIds
      : [process.understanding!.evidence[0]!.id];
    byStep.set(content.stepOrder, [
      {
        id: `HYP-${String(index + 1).padStart(3, "0")}`,
        provenance: "ai_inferred",
        processStepId: step.id,
        title: content.title,
        currentSituation: content.currentSituation,
        aiContribution: content.aiContribution,
        aiCapabilities: content.aiCapabilities,
        expectedChange: content.expectedChange,
        supportingDeterministicAutomation: content.deterministicAutomation,
        requiredInformationAndSystemAccess: content.requiredAccess,
        expectedHumanRole: content.humanRole,
        potentialLevel: content.potentialLevel,
        potentialRationale: content.potentialRationale,
        confidenceLevel: content.confidenceLevel,
        confidenceRationale: content.confidenceRationale,
        evidenceIds,
        assumptions: content.assumptions.map((text) => ({
          text,
          material: true,
        })),
        openQuestions: content.openQuestions,
      },
    ]);
  });
  return opportunityHypothesisResultSchema.parse({
    schemaVersion: 1,
    stepAnalyses: process.understanding.steps.map((step) => {
      const items = byStep.get(step.order) ?? [];
      return {
        processStepId: step.id,
        summary: items.length
          ? "Der Schritt enthält ein belegtes, abgegrenztes KI-Potenzial."
          : "Der Schritt wurde geprüft; ein eigenes Potenzial würde das Szenario unnötig aufteilen.",
        noPotentialRationale: items.length
          ? null
          : "Die Verbesserung wird durch die übergreifenden Potenziale oder klassische Automation abgedeckt.",
        hypotheses: items,
      };
    }),
  });
}

function scenario(
  level: ScenarioLevel,
  process: ProcessCaptureRecord,
  fixture: ShowcaseJourneyFixture,
  result: OpportunityHypothesisResult,
): OpportunityScenario {
  const includedHypothesisIds = result.stepAnalyses.flatMap((analysis) =>
    analysis.hypotheses.map((hypothesis) => hypothesis.id),
  );
  const affectedProcessStepIds = result.stepAnalyses
    .filter((analysis) => analysis.hypotheses.length)
    .map((analysis) => analysis.processStepId);
  const evidenceIds = [
    ...new Set(
      result.stepAnalyses.flatMap((analysis) =>
        analysis.hypotheses.flatMap((hypothesis) => hypothesis.evidenceIds),
      ),
    ),
  ];
  const autonomous = level !== "assistive";
  const agentic = level === "agentic";
  const blueprint = fixture.scenario;
  const systemTarget = blueprint.systemTargets.join(", ");
  const actions: OpportunityScenario["actions"] = [
    ...(autonomous
      ? [
          {
            name: "Vorbereitung und Nachhaltung ausführen",
            description:
              "Der Agent verarbeitet neue Informationen, aktualisiert den Arbeitsstand und hält offene Routineaktionen innerhalb der Leitplanken nach.",
            processStepIds: affectedProcessStepIds,
            executionMode: "autonomous" as const,
            controls: [
              "Nur die im Szenario benannten Quellen verwenden",
              "Jeden Vorschlag mit seinem fachlichen Beleg verknüpfen",
            ],
            escalationTriggers: [],
          },
        ]
      : []),
    {
      name: "Fachliche Entscheidung freigeben",
      description:
        "Die zuständige Fachrolle prüft Vorschlag, Belege und Auswirkungen vor jeder kontrollpflichtigen Aktion.",
      processStepIds: affectedProcessStepIds,
      executionMode: "approval_required",
      controls: blueprint.humanOversight,
      escalationTriggers: agentic
        ? [
            "Widersprüchliche oder fehlende fachliche Evidenz",
            "Geringe Konfidenz oder ein Fall außerhalb der definierten Regeln",
          ]
        : [],
    },
  ];
  return {
    id: `SCN-${level}`,
    provenance: "ai_inferred",
    level,
    title: blueprint.titles[level],
    summary: blueprint.summaries[level],
    targetState: blueprint.targetStates[level],
    includedHypothesisIds,
    excludedHypotheses: [],
    affectedProcessStepIds,
    changesFromToday: blueprint.changesFromToday,
    aiResponsibilities: blueprint.aiResponsibilities,
    aiCapabilities: [
      ...new Set(
        result.stepAnalyses.flatMap((analysis) =>
          analysis.hypotheses.flatMap(
            (hypothesis) => hypothesis.aiCapabilities,
          ),
        ),
      ),
    ],
    deterministicAutomation: blueprint.deterministicAutomation,
    orchestration: blueprint.orchestration,
    humanResponsibilities: blueprint.humanResponsibilities,
    actions,
    humanOversight: blueprint.humanOversight,
    informationAndDocuments: blueprint.informationAndDocuments,
    systemAccess: [
      {
        target: systemTarget,
        accessModes: autonomous ? ["read", "write"] : ["read"],
        timing: autonomous ? "on_demand" : "manual",
        possibleMechanisms: autonomous ? ["api"] : ["manual"],
        assumptions: blueprint.assumptions,
      },
    ],
    prerequisites: blueprint.prerequisites,
    risksAndFailureModes: blueprint.risks,
    assumptions: blueprint.assumptions,
    openQuestions: blueprint.openQuestions,
    evidenceIds,
    confidenceLevel: blueprint.confidenceLevel,
    confidenceRationale: blueprint.confidenceRationale,
  };
}

function scenarios(
  process: ProcessCaptureRecord,
  fixture: ShowcaseJourneyFixture,
  result: OpportunityHypothesisResult,
) {
  return opportunityScenarioResultSchema.parse({
    schemaVersion: 1,
    scenarios: scenarioLevels.map((level) =>
      scenario(level, process, fixture, result),
    ),
  });
}

function assessment(
  process: ProcessCaptureRecord,
  fixture: ShowcaseJourneyFixture,
) {
  if (!process.understanding)
    throw new Error("Der Showcase-Prozess besitzt kein Prozessbild.");
  const evidenceIds = process.understanding.evidence.map((item) => item.id);
  const hypothesisIds = fixture.hypotheses.map(
    (_, index) => `HYP-${String(index + 1).padStart(3, "0")}`,
  );
  const scored = new Map(
    fixture.assessment.map((criterion) => [criterion.criterionId, criterion]),
  );
  return {
    schemaVersion: 1 as const,
    criteria: assessableCriterionIds.map((criterionId) => {
      const criterion = scored.get(criterionId);
      if (criterion)
        return {
          status: "scored" as const,
          criterionId,
          score: criterion.score,
          confidenceLevel: "high" as const,
          rationale: criterion.rationale,
          evidenceIds,
          hypothesisIds,
          assumptions: [],
          openQuestions: [],
        };
      return {
        status: "insufficient_evidence" as const,
        criterionId,
        score: null,
        confidenceLevel: "medium" as const,
        rationale:
          "Der bestätigte Ist-Prozess und das Szenario reichen für eine belastbare numerische Einstufung dieses Kriteriums noch nicht aus.",
        evidenceIds,
        hypothesisIds,
        assumptions: [
          "Betriebsmodell, Schnittstellen oder Zielkennzahlen sind noch nicht fachlich bestätigt.",
        ],
        openQuestions: [
          "Welche messbare Zielgröße und welcher bestätigte Ausgangswert gelten für dieses Kriterium?",
        ],
      };
    }),
  };
}

export async function seedShowcaseOpportunity(
  root: string,
  process: ProcessCaptureRecord,
  fixture: ShowcaseJourneyFixture,
) {
  if (!process.understanding || process.state !== "confirmed")
    throw new Error("Der Showcase-Prozess muss vollständig bestätigt sein.");

  const opportunities = new OpportunityDiscoveryRepository(root);
  const existing = await opportunities.get(process.id);
  if (existing) return existing;

  const defaultsRoot = join(import.meta.dir, "..", "defaults");
  const opportunityDefaults = await loadOpportunityDefaults(defaultsRoot);
  await opportunities.create(
    process,
    opportunityDefaults.config,
    opportunityDefaults.contracts,
  );
  await opportunities.markHypothesesRunning(process.id);
  const hypothesisResult = hypotheses(process, fixture);
  await opportunities.saveHypotheses(process.id, hypothesisResult, trace());
  const opportunity = await opportunities.saveScenarios(
    process.id,
    scenarios(process, fixture, hypothesisResult),
    trace(),
  );

  const assessments = new AgenticPotentialAssessmentRepository(root);
  const assessmentDefaults = await loadAgenticAssessmentDefaults(defaultsRoot);
  await assessments.create(
    process,
    opportunity,
    assessmentDefaults.config,
    assessmentDefaults.contracts,
  );
  await assessments.markRunning(process.id);
  const completed = await assessments.saveResult(
    process.id,
    assessment(process, fixture),
    trace(),
  );
  const score = completed.result
    ? agenticPotentialScore(completed.result)?.value
    : null;
  if (score !== fixture.expectedScore)
    throw new Error(
      `Showcase-Journey „${fixture.slug}" ergibt Score ${String(score)} statt ${fixture.expectedScore}.`,
    );
  return opportunity;
}
