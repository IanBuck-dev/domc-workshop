import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadOpportunityDefaults } from "../apps/server/src/opportunity-defaults.ts";
import type {
  OpportunityHypothesisAiResult,
  OpportunityHypothesisResult,
  OpportunityScenario,
  OpportunityScenarioResult,
  ScenarioLevel,
} from "../packages/domain/src/opportunity-discovery.ts";
import type { ProcessCaptureRecord } from "../packages/domain/src/process-understanding.ts";
import type { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";
import {
  answers,
  cover,
  processConfig,
  understanding,
  validationInputSnapshot,
  workCharacteristicAnswers,
} from "./process-fixtures.ts";

export const aiTrace = () => ({
  operationId: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  model: "claude-opus-4-8",
  durationMs: 10,
  inputTokens: 2,
  outputTokens: 4,
  sandboxed: true,
});

export async function confirmedProcess(
  repository: ProcessCaptureRepository,
): Promise<ProcessCaptureRecord> {
  let record = await repository.create(cover, await processConfig());
  record = await repository.saveMainAnswers(
    record.id,
    answers(),
    workCharacteristicAnswers(),
    [],
  );
  record = await repository.saveValidationRun(
    record.id,
    validationInputSnapshot(
      record.mainAnswers,
      record.workCharacteristicAnswers,
    ),
    [],
    [],
    aiTrace(),
  );
  record = await repository.saveUnderstanding(
    record.id,
    understanding(),
    aiTrace(),
  );
  return repository.confirm(record.id);
}

export async function opportunityDefaults() {
  return loadOpportunityDefaults(join(import.meta.dir, "..", "defaults"));
}

export function hypothesisAiResult(
  confidence: "high" | "medium" | "low" = "high",
  hypothesisCount = 1,
): OpportunityHypothesisAiResult {
  return {
    stepAnalyses: understanding().steps.map((step, index) => ({
      processStepId: step.id,
      summary: `Der Hauptschritt ${index + 1} wurde auf fachliches KI-Potenzial geprüft.`,
      noPotentialRationale:
        index === 0
          ? null
          : "Für diesen Schritt ist kein belastbares KI-Potenzial belegt.",
      hypotheses:
        index === 0
          ? Array.from({ length: hypothesisCount }, (_, hypothesisIndex) => ({
              processStepId: step.id,
              title: `Kontaktentwurf ${hypothesisIndex + 1} aus Falldaten vorbereiten`,
              currentSituation:
                "Informationen werden heute manuell zusammengeführt.",
              aiContribution:
                "KI interpretiert Falldaten und erstellt einen begründeten Entwurf.",
              aiCapabilities: ["interpretation", "generation"],
              expectedChange:
                "Der Mensch startet mit einem fachlich begründeten Entwurf.",
              supportingDeterministicAutomation: ["Freigabestatus prüfen"],
              requiredInformationAndSystemAccess: [
                "Lesender Zugriff auf CRM-Angaben",
              ],
              expectedHumanRole:
                "Fachliche Prüfung und Freigabe kritischer Fälle.",
              potentialLevel: "high",
              potentialRationale:
                "Der wiederkehrende Interpretations- und Formulierungsaufwand ist hoch.",
              confidenceLevel: confidence,
              confidenceRationale:
                "Der Prozessschritt und seine Quellen sind im Prozessbild dokumentiert.",
              evidenceIds: ["flow-roles"],
              assumptions:
                confidence === "high"
                  ? []
                  : [
                      {
                        text: "Die CRM-Daten sind vollständig.",
                        material: true,
                      },
                    ],
              openQuestions: [],
            }))
          : [],
    })),
  };
}

export function normalizedHypotheses(
  confidence: "high" | "medium" | "low" = "high",
  hypothesisCount = 1,
): OpportunityHypothesisResult {
  let sequence = 0;
  return {
    schemaVersion: 1,
    stepAnalyses: hypothesisAiResult(
      confidence,
      hypothesisCount,
    ).stepAnalyses.map((analysis) => ({
      ...analysis,
      hypotheses: analysis.hypotheses.map((hypothesis) => ({
        ...hypothesis,
        id: `HYP-${String(++sequence).padStart(3, "0")}`,
        provenance: "ai_inferred" as const,
      })),
    })),
  };
}

function scenario(
  level: ScenarioLevel,
  hypothesisCount: number,
): OpportunityScenario {
  const autonomous = level !== "assistive";
  return {
    id: `SCN-${level}`,
    provenance: "ai_inferred",
    level,
    title: `${level}es Zukunftsszenario`,
    summary: "Ein abgegrenztes Zukunftsbild mit klarer menschlicher Kontrolle.",
    targetState: "Der Kontaktentwurf wird risikogerecht unterstützt.",
    includedHypothesisIds: Array.from(
      { length: hypothesisCount },
      (_, index) => `HYP-${String(index + 1).padStart(3, "0")}`,
    ),
    excludedHypotheses: [],
    affectedProcessStepIds: ["step-1"],
    changesFromToday: ["Falldaten werden für einen Entwurf interpretiert."],
    aiResponsibilities: ["Informationen interpretieren und Entwurf erstellen"],
    aiCapabilities: ["interpretation", "generation"],
    deterministicAutomation: ["Freigabestatus prüfen"],
    orchestration: ["Prüfung und Entwurf koordinieren"],
    humanResponsibilities: ["Kritische Fälle fachlich freigeben"],
    actions: [
      ...(autonomous
        ? [
            {
              name: "Routinefall vorbereiten",
              description:
                "Die KI bereitet einen risikoarmen Routinefall innerhalb der Leitplanken vor.",
              processStepIds: ["step-1"],
              executionMode: "autonomous" as const,
              controls: ["Nur freigegebene Daten verwenden"],
              escalationTriggers: [],
            },
          ]
        : []),
      {
        name: "Ergebnis fachlich prüfen",
        description:
          "Ein Mensch prüft das Ergebnis vor einer kritischen Aktion.",
        processStepIds: ["step-1"],
        executionMode: "approval_required",
        controls: ["Fachliche Freigabe"],
        escalationTriggers:
          level === "agentic"
            ? ["Kritischer Kunde oder geringe Konfidenz"]
            : [],
      },
    ],
    humanOversight: ["Ergebnisse und Eskalationen überwachen"],
    informationAndDocuments: ["CRM-Angaben"],
    systemAccess: [
      {
        target: "Vertriebs-CRM",
        accessModes: ["read"],
        timing: autonomous ? "on_demand" : "manual",
        possibleMechanisms: autonomous ? ["api", "mcp"] : ["manual"],
        assumptions: ["Ein freigegebener Zugriff kann eingerichtet werden."],
      },
    ],
    prerequisites: ["Fachliche Leitplanken sind dokumentiert."],
    risksAndFailureModes: ["Ein unpassender Inhalt wird vorgeschlagen."],
    assumptions: ["Die benötigten Informationen sind verfügbar."],
    openQuestions: ["Welche Fälle benötigen eine Freigabe?"],
    evidenceIds: ["flow-roles"],
    confidenceLevel: "medium",
    confidenceRationale:
      "Potenzial ist belegt; technische Voraussetzungen sind offen.",
  };
}

export function scenarioResult(hypothesisCount = 1): OpportunityScenarioResult {
  return {
    schemaVersion: 1,
    scenarios: [
      scenario("assistive", hypothesisCount),
      scenario("delegated", hypothesisCount),
      scenario("agentic", hypothesisCount),
    ],
  };
}

export async function opportunityJsonSchema(name: string) {
  return JSON.parse(
    await readFile(
      join(import.meta.dir, "..", "defaults", "ai-schemas", name),
      "utf8",
    ),
  ) as object;
}
