import { describe, expect, test } from "bun:test";
import {
  assertOpportunityScenarioReferences,
  opportunityScenarioResultSchema,
  type OpportunityScenario,
  type OpportunityScenarioReferenceContext,
  type OpportunityScenarioResult,
  type ScenarioLevel,
} from "../packages/domain/src/opportunity-discovery.ts";

const context: OpportunityScenarioReferenceContext = {
  highConfidenceHypotheses: [
    { id: "HYP-001", processStepId: "step-1" },
    { id: "HYP-002", processStepId: "step-2" },
  ],
  processStepIds: ["step-1", "step-2"],
  evidenceIds: ["evidence-1", "evidence-2"],
};

function scenario(level: ScenarioLevel): OpportunityScenario {
  const actions: OpportunityScenario["actions"] =
    level === "assistive"
      ? [
          {
            name: "Entwurf prüfen und versenden",
            description:
              "Die KI erstellt einen Entwurf; der Mensch prüft und versendet ihn.",
            processStepIds: ["step-1"],
            executionMode: "approval_required",
            controls: ["Inhalt vor Versand prüfen"],
            escalationTriggers: [],
          },
        ]
      : [
          {
            name: "Routinefall vorbereiten",
            description:
              "Die KI bearbeitet einen risikoarmen Routinefall innerhalb der Leitplanken.",
            processStepIds: ["step-1"],
            executionMode: "autonomous",
            controls: ["Nur freigegebene Daten verwenden"],
            escalationTriggers: [],
          },
          {
            name: "Kritischen Fall freigeben",
            description:
              "Ein Mensch entscheidet vor einer fachlich kritischen Aktion.",
            processStepIds: ["step-1"],
            executionMode: "approval_required",
            controls: ["Vier-Augen-Freigabe"],
            escalationTriggers:
              level === "agentic"
                ? ["Enterprise-Kunde oder geringe Modellkonfidenz"]
                : [],
          },
        ];

  return {
    id: `SCN-${level}`,
    provenance: "ai_inferred",
    level,
    title: `${level} Szenario`,
    summary: "Nachvollziehbares fiktives Zukunftsszenario.",
    targetState:
      "Der Prozess wird mit klarer menschlicher Kontrolle unterstützt.",
    includedHypothesisIds: ["HYP-001"],
    excludedHypotheses: [
      {
        hypothesisId: "HYP-002",
        rationale: "Diese Hypothese gehört nicht zum kohärenten Umfang.",
      },
    ],
    affectedProcessStepIds: ["step-1"],
    changesFromToday: ["Informationen werden automatisch zusammengeführt."],
    aiResponsibilities: ["Informationen interpretieren"],
    aiCapabilities: ["interpretation", "generation"],
    deterministicAutomation: ["Freigabestatus prüfen"],
    orchestration: ["Eingabe, Entwurf und Freigabe koordinieren"],
    humanResponsibilities: ["Kritische Fälle freigeben"],
    actions,
    humanOversight: ["Ergebnisse und Eskalationen überwachen"],
    informationAndDocuments: ["Fiktive Kundendaten"],
    systemAccess: [
      {
        target: "Vertriebs-CRM",
        accessModes: ["read", "write"],
        timing: level === "assistive" ? "manual" : "on_demand",
        possibleMechanisms: level === "assistive" ? ["manual"] : ["api", "mcp"],
        assumptions: ["Ein freigegebener Zugriff kann geschaffen werden."],
      },
    ],
    prerequisites: ["Fachliche Leitplanken sind dokumentiert."],
    risksAndFailureModes: ["Unpassender Inhalt wird vorgeschlagen."],
    assumptions: ["Die benötigten Informationen sind verfügbar."],
    openQuestions: ["Welche Fälle benötigen eine Freigabe?"],
    evidenceIds: ["evidence-1"],
    confidenceLevel: "medium",
    confidenceRationale:
      "Das Potenzial ist belegt, einzelne Voraussetzungen sind noch offen.",
  };
}

function result(): OpportunityScenarioResult {
  return {
    schemaVersion: 1,
    scenarios: [
      scenario("assistive"),
      scenario("delegated"),
      scenario("agentic"),
    ],
  };
}

describe("opportunity scenario contract", () => {
  test("accepts exactly the three ordered oversight levels", () => {
    const parsed = assertOpportunityScenarioReferences(result(), context);
    expect(parsed.scenarios.map((item) => item.level)).toEqual([
      "assistive",
      "delegated",
      "agentic",
    ]);
    expect(parsed.scenarios.map((item) => item.id)).toEqual([
      "SCN-assistive",
      "SCN-delegated",
      "SCN-agentic",
    ]);
  });

  test("enforces the autonomy policy for every level", () => {
    const assistive = result();
    assistive.scenarios[0]!.actions[0]!.executionMode = "autonomous";
    expect(() => opportunityScenarioResultSchema.parse(assistive)).toThrow(
      "assistive scenario cannot contain autonomous",
    );

    const delegated = result();
    delegated.scenarios[1]!.actions = delegated.scenarios[1]!.actions.filter(
      (action) => action.executionMode !== "autonomous",
    );
    expect(() => opportunityScenarioResultSchema.parse(delegated)).toThrow(
      "delegated scenario requires autonomous and human-controlled",
    );

    const agentic = result();
    agentic.scenarios[2]!.actions.forEach((action) => {
      action.escalationTriggers = [];
    });
    expect(() => opportunityScenarioResultSchema.parse(agentic)).toThrow(
      "agentic scenario requires an explicit escalation trigger",
    );
  });

  test("requires each scenario to partition every high-confidence hypothesis", () => {
    const missing = result();
    missing.scenarios[1]!.excludedHypotheses = [];
    expect(() => assertOpportunityScenarioReferences(missing, context)).toThrow(
      "include or exclude every high-confidence hypothesis",
    );

    const overlapping = result();
    overlapping.scenarios[1]!.includedHypothesisIds.push("HYP-002");
    expect(() => opportunityScenarioResultSchema.parse(overlapping)).toThrow(
      "cannot be included and excluded",
    );
  });

  test("rejects foreign process-step and evidence references", () => {
    const foreignStep = result();
    foreignStep.scenarios[0]!.affectedProcessStepIds = ["step-foreign"];
    foreignStep.scenarios[0]!.actions[0]!.processStepIds = ["step-foreign"];
    expect(() =>
      assertOpportunityScenarioReferences(foreignStep, context),
    ).toThrow("unknown process step");

    const foreignEvidence = result();
    foreignEvidence.scenarios[0]!.evidenceIds = ["evidence-foreign"];
    expect(() =>
      assertOpportunityScenarioReferences(foreignEvidence, context),
    ).toThrow("unknown evidence");
  });

  test("keeps MCP as one optional mechanism and rejects unknown combinations", () => {
    expect(
      opportunityScenarioResultSchema.parse(result()).scenarios[1]
        ?.systemAccess[0]?.possibleMechanisms,
    ).toEqual(["api", "mcp"]);

    const invalid = result();
    invalid.scenarios[1]!.systemAccess[0]!.possibleMechanisms = [
      "unknown",
      "mcp",
    ];
    expect(() => opportunityScenarioResultSchema.parse(invalid)).toThrow(
      "Unknown cannot be combined",
    );
  });

  test("rejects assessment fields and malformed scenario ordering", () => {
    const withScore = {
      ...result(),
      scenarios: result().scenarios.map((item, index) =>
        index === 0 ? { ...item, roi: 2.4 } : item,
      ),
    };
    expect(() => opportunityScenarioResultSchema.parse(withScore)).toThrow();

    const wrongOrder = result();
    [wrongOrder.scenarios[0], wrongOrder.scenarios[1]] = [
      wrongOrder.scenarios[1]!,
      wrongOrder.scenarios[0]!,
    ];
    expect(() => opportunityScenarioResultSchema.parse(wrongOrder)).toThrow(
      "ordered assistive, delegated, agentic",
    );
  });
});
