import { describe, expect, test } from "bun:test";
import {
  assertOpportunityScenarioReferences,
  assertOpportunityDiscoveryTransition,
  createOpportunityProcessSnapshot,
  normalizeOpportunityHypotheses,
  normalizeOpportunityScenarioScope,
  selectScenarioHypotheses,
  opportunityScenarioAiResultSchema,
  opportunityScenarioResultSchema,
  type OpportunityScenario,
  type OpportunityScenarioReferenceContext,
  type OpportunityScenarioResult,
  type ScenarioLevel,
} from "../packages/domain/src/opportunity-discovery.ts";
import { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  confirmedProcess,
  hypothesisAiResult,
  normalizedHypotheses,
} from "./opportunity-fixtures.ts";
import { understanding } from "./process-fixtures.ts";

const context: OpportunityScenarioReferenceContext = {
  scenarioBasis: "high",
  scenarioHypotheses: [
    { id: "HYP-001", processStepId: "step-1", confidenceLevel: "high" },
    { id: "HYP-002", processStepId: "step-2", confidenceLevel: "high" },
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

  test("assigns scenario IDs and provenance on the server", () => {
    const aiOutput = structuredClone(result()) as unknown as {
      scenarios: Array<Record<string, unknown>>;
    };
    aiOutput.scenarios.forEach((item) => {
      item.id = "SCN-untrusted";
      delete item.provenance;
    });

    const parsed = opportunityScenarioAiResultSchema.parse(aiOutput);
    expect(parsed.scenarios.map((item) => item.id)).toEqual([
      "SCN-assistive",
      "SCN-delegated",
      "SCN-agentic",
    ]);
    expect(
      parsed.scenarios.every((item) => item.provenance === "ai_inferred"),
    ).toBeTrue();
  });

  test("normalizes unambiguous casing drift in known AI contract fields", () => {
    const aiOutput = structuredClone(result()) as unknown as {
      scenarios: Array<Record<string, unknown>>;
    };
    const first = aiOutput.scenarios[0]!;
    first.changesFromtoday = first.changesFromToday;
    delete first.changesFromToday;

    const parsed = opportunityScenarioAiResultSchema.parse(aiOutput);
    expect(parsed.scenarios[0]!.changesFromToday).toEqual([
      "Informationen werden automatisch zusammengeführt.",
    ]);
  });

  test("rejects casing aliases when the canonical AI contract field exists", () => {
    const aiOutput = structuredClone(result()) as unknown as {
      scenarios: Array<Record<string, unknown>>;
    };
    aiOutput.scenarios[0]!.changesFromtoday = ["Konflikt"];

    expect(() => opportunityScenarioAiResultSchema.parse(aiOutput)).toThrow(
      "Unrecognized key",
    );
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

  test("requires each scenario to partition every selected hypothesis", () => {
    const missing = result();
    missing.scenarios[1]!.excludedHypotheses = [];
    expect(() => assertOpportunityScenarioReferences(missing, context)).toThrow(
      "include or exclude every selected hypothesis",
    );

    const overlapping = result();
    overlapping.scenarios[1]!.includedHypothesisIds.push("HYP-002");
    expect(() => opportunityScenarioResultSchema.parse(overlapping)).toThrow(
      "cannot be included and excluded",
    );
  });

  test("completes the redundant scenario scope from hypotheses and actions", () => {
    const incomplete = result();
    incomplete.scenarios[0]!.includedHypothesisIds = ["HYP-001", "HYP-002"];
    incomplete.scenarios[0]!.excludedHypotheses = [];
    incomplete.scenarios[0]!.actions[0]!.processStepIds = ["step-1", "step-2"];

    const normalized = normalizeOpportunityScenarioScope(incomplete, context);
    expect(normalized.scenarios[0]!.affectedProcessStepIds).toEqual([
      "step-1",
      "step-2",
    ]);
    expect(() =>
      assertOpportunityScenarioReferences(normalized, context),
    ).not.toThrow();
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
    expect(
      opportunityScenarioAiResultSchema.parse(invalid).scenarios[1]
        ?.systemAccess[0]?.possibleMechanisms,
    ).toEqual(["mcp"]);
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

  test("limits medium fallback to two or three candidates and caps scenario confidence", () => {
    expect(selectScenarioHypotheses(normalizedHypotheses("medium", 1))).toEqual(
      { basis: null, hypotheses: [] },
    );
    const two = selectScenarioHypotheses(normalizedHypotheses("medium", 2));
    expect(two.basis).toBe("medium_fallback");
    expect(two.hypotheses).toHaveLength(2);
    const four = selectScenarioHypotheses(normalizedHypotheses("medium", 4));
    expect(four.hypotheses).toHaveLength(3);

    const mediumContext: OpportunityScenarioReferenceContext = {
      ...context,
      scenarioBasis: "medium_fallback",
      scenarioHypotheses: context.scenarioHypotheses.map((hypothesis) => ({
        ...hypothesis,
        confidenceLevel: "medium",
      })),
    };
    const overconfident = result();
    overconfident.scenarios[0]!.confidenceLevel = "high";
    expect(() =>
      assertOpportunityScenarioReferences(overconfident, mediumContext),
    ).toThrow("cannot have high confidence with a medium evidence basis");
  });
});

describe("opportunity discovery input and hypotheses", () => {
  test("rejects every state transition outside the bounded pipeline", () => {
    const allowed = new Set([
      "hypotheses_queued:hypotheses_running",
      "hypotheses_running:no_supported_hypotheses",
      "hypotheses_running:scenarios_running",
      "hypotheses_running:hypotheses_failed",
      "hypotheses_failed:hypotheses_queued",
      "scenarios_running:completed",
      "scenarios_running:scenarios_failed",
      "scenarios_failed:scenarios_running",
    ]);
    const states = [
      "hypotheses_queued",
      "hypotheses_running",
      "hypotheses_failed",
      "no_supported_hypotheses",
      "scenarios_running",
      "scenarios_failed",
      "completed",
    ] as const;

    for (const from of states)
      for (const to of states) {
        const transition = `${from}:${to}`;
        if (allowed.has(transition))
          expect(assertOpportunityDiscoveryTransition(from, to)).toBe(to);
        else
          expect(() => assertOpportunityDiscoveryTransition(from, to)).toThrow(
            "Ungültiger Zustandswechsel",
          );
      }
  });

  test("creates a bounded confirmed snapshot without participant data", async () => {
    const root = await mkdtemp(join(tmpdir(), "opportunity-domain-"));
    try {
      const process = await confirmedProcess(
        new ProcessCaptureRepository(root),
      );
      const snapshot = createOpportunityProcessSnapshot(process);
      const serialized = JSON.stringify(snapshot);
      expect(snapshot.understanding.steps).toHaveLength(5);
      expect(snapshot.workCharacteristics).toHaveLength(4);
      expect(serialized).not.toContain(process.cover.participantName);
      expect(serialized).not.toContain(process.cover.participantEmail);
      expect(serialized).not.toContain("mainAnswers");
      expect(serialized).not.toContain("uploads");
      expect(() =>
        createOpportunityProcessSnapshot({
          ...process,
          state: "review_required",
          confirmedAt: null,
        }),
      ).toThrow("Nur ein fachlich bestätigter Prozess");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("normalizes every process step and assigns deterministic sorted IDs", async () => {
    const root = await mkdtemp(join(tmpdir(), "opportunity-domain-"));
    try {
      const process = await confirmedProcess(
        new ProcessCaptureRepository(root),
      );
      const snapshot = createOpportunityProcessSnapshot(process);
      const input = hypothesisAiResult();
      input.stepAnalyses[0]!.hypotheses.push({
        ...input.stepAnalyses[0]!.hypotheses[0]!,
        title: "Kleineres Potenzial",
        potentialLevel: "low",
        confidenceLevel: "medium",
        assumptions: [{ text: "Datenqualität ist unbekannt.", material: true }],
      });
      input.stepAnalyses.reverse();
      const output = normalizeOpportunityHypotheses(input, snapshot);
      expect(output.stepAnalyses.map((item) => item.processStepId)).toEqual(
        snapshot.understanding.steps.map((step) => step.id),
      );
      expect(output.stepAnalyses[0]!.hypotheses.map((item) => item.id)).toEqual(
        ["HYP-001", "HYP-002"],
      );
      expect(output.stepAnalyses[0]!.hypotheses[0]!.potentialLevel).toBe(
        "high",
      );

      input.stepAnalyses[input.stepAnalyses.length - 1] = structuredClone(
        input.stepAnalyses[0]!,
      );
      expect(() => normalizeOpportunityHypotheses(input, snapshot)).toThrow(
        "jeden Prozessschritt genau einmal",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("enforces evidence and assumption rules for high confidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "opportunity-domain-"));
    try {
      const process = await confirmedProcess(
        new ProcessCaptureRepository(root),
      );
      const snapshot = createOpportunityProcessSnapshot(process);
      const withoutEvidence = hypothesisAiResult();
      withoutEvidence.stepAnalyses[0]!.hypotheses[0]!.evidenceIds = [];
      expect(() =>
        normalizeOpportunityHypotheses(withoutEvidence, snapshot),
      ).toThrow("High confidence requires evidence");

      const withMaterialAssumption = hypothesisAiResult();
      withMaterialAssumption.stepAnalyses[0]!.hypotheses[0]!.assumptions = [
        {
          text: "Eine wesentliche Voraussetzung ist ungeklärt.",
          material: true,
        },
      ];
      expect(() =>
        normalizeOpportunityHypotheses(withMaterialAssumption, snapshot),
      ).toThrow("High confidence requires evidence");

      const deterministicOnly = hypothesisAiResult();
      deterministicOnly.stepAnalyses[0]!.hypotheses[0]!.aiCapabilities = [];
      expect(() =>
        normalizeOpportunityHypotheses(deterministicOnly, snapshot),
      ).toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("accepts a complete analysis of eight process steps", async () => {
    const root = await mkdtemp(join(tmpdir(), "opportunity-domain-"));
    try {
      const process = await confirmedProcess(
        new ProcessCaptureRepository(root),
      );
      const snapshot = createOpportunityProcessSnapshot(process);
      const input = hypothesisAiResult();
      snapshot.understanding = understanding(8);
      for (let order = 6; order <= 8; order += 1) {
        input.stepAnalyses.push({
          processStepId: `step-${order}`,
          summary: `Der Hauptschritt ${order} wurde geprüft.`,
          noPotentialRationale: "Kein materieller KI-Beitrag belegt.",
          hypotheses: [],
        });
      }

      expect(
        normalizeOpportunityHypotheses(input, snapshot).stepAnalyses,
      ).toHaveLength(8);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("accepts a complete analysis of a one-step Chat Capture", async () => {
    const root = await mkdtemp(join(tmpdir(), "opportunity-domain-"));
    try {
      const process = await confirmedProcess(
        new ProcessCaptureRepository(root),
      );
      const snapshot = createOpportunityProcessSnapshot(process);
      snapshot.understanding.steps = snapshot.understanding.steps.slice(0, 1);
      const firstStepNode = snapshot.understanding.flow.nodes.find(
        (node) => node.kind === "step" && node.stepId === "step-1",
      )!;
      snapshot.understanding.flow = {
        nodes: snapshot.understanding.flow.nodes.filter(
          (node) =>
            node.kind === "startEvent" ||
            node.kind === "endEvent" ||
            node.id === firstStepNode.id,
        ),
        edges: [
          { id: "edge-1", source: "start", target: firstStepNode.id },
          { id: "edge-2", source: firstStepNode.id, target: "end" },
        ],
      };
      const input = hypothesisAiResult();
      input.stepAnalyses = input.stepAnalyses.slice(0, 1);

      expect(
        normalizeOpportunityHypotheses(input, snapshot).stepAnalyses,
      ).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
