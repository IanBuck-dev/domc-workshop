import { join } from "node:path";
import { loadAgenticAssessmentDefaults } from "../apps/server/src/agentic-assessment-defaults.ts";
import { loadOpportunityDefaults } from "../apps/server/src/opportunity-defaults.ts";
import { assessableCriterionIds } from "../packages/domain/src/agentic-potential-assessment.ts";
import {
  opportunityHypothesisResultSchema,
  opportunityScenarioResultSchema,
  type OpportunityHypothesis,
  type OpportunityHypothesisResult,
  type OpportunityScenario,
  type OpportunityScenarioResult,
  type ScenarioLevel,
} from "../packages/domain/src/opportunity-discovery.ts";
import type {
  AiTrace,
  ProcessCaptureRecord,
} from "../packages/domain/src/process-understanding.ts";
import { AgenticPotentialAssessmentRepository } from "../packages/storage/src/agentic-potential-assessment-repository.ts";
import { OpportunityDiscoveryRepository } from "../packages/storage/src/opportunity-discovery-repository.ts";

const flagshipTitle = "Leitungswasserschaden Wohngebäude regulieren";

const trace = (): AiTrace => ({
  operationId: crypto.randomUUID(),
  sessionId: null,
  model: "deterministischer-demo-seed",
  durationMs: 0,
  inputTokens: 0,
  outputTokens: 0,
  sandboxed: true,
});

type HypothesisContent = Omit<
  OpportunityHypothesis,
  "id" | "provenance" | "processStepId" | "evidenceIds"
> & { stepOrder: number };

const hypothesisContent: HypothesisContent[] = [
  {
    stepOrder: 1,
    title: "Eingänge fallbezogen ordnen und Vollständigkeit prüfen",
    currentSituation:
      "Schadenmeldungen, Fotos und Kostenvoranschläge erreichen die Sachbearbeitung über mehrere Kanäle und werden manuell einem Fall zugeordnet.",
    aiContribution:
      "Ein Arbeitsbegleiter liest die Eingänge, ordnet sie dem Schadenfall zu und bereitet eine belegte Vollständigkeitsprüfung vor.",
    aiCapabilities: ["interpretation", "recognition", "generation"],
    expectedChange:
      "Die Sachbearbeitung startet mit einem strukturierten Fallüberblick und einem Entwurf für fehlende Unterlagen.",
    supportingDeterministicAutomation: [
      "Pflichtunterlagen je Schadenart abgleichen",
      "Eingangsfristen überwachen",
    ],
    requiredInformationAndSystemAccess: [
      "Lesender Zugriff auf KOMPASS und AKTE",
      "Schadenmeldung, Fotos und Kostenvoranschlag",
    ],
    expectedHumanRole:
      "Die Sachbearbeitung prüft die Zuordnung und versendet Anforderungen erst nach fachlicher Freigabe.",
    potentialLevel: "high",
    potentialRationale:
      "Hoher wiederkehrender Sichtungsaufwand und nachweislich unvollständige Ersteinreichungen treffen auf klar benannte Unterlagen.",
    confidenceLevel: "high",
    confidenceRationale:
      "Kanäle, Unterlagen, Systeme und der heutige manuelle Aufwand sind im bestätigten Prozessbild belegt.",
    assumptions: [],
    openQuestions: [],
  },
  {
    stepOrder: 3,
    title: "Gutachterbeauftragung und Rückmeldungen orchestrieren",
    currentSituation:
      "Beauftragungsgrund, Frist und Rückmeldung werden zwischen KOMPASS, Outlook und einer Teamliste manuell nachgehalten.",
    aiContribution:
      "Der Arbeitsbegleiter führt Fallstatus und Kommunikation zusammen, bereitet Beauftragungen vor und weist auf ausstehende Rückmeldungen hin.",
    aiCapabilities: ["interpretation", "planning"],
    expectedChange:
      "Offene Gutachtertermine und nächste Aktionen werden fallbezogen sichtbar, ohne dass das System die fachliche Gutachterentscheidung übernimmt.",
    supportingDeterministicAutomation: [
      "Wertgrenze prüfen",
      "Fristüberschreitungen markieren",
    ],
    requiredInformationAndSystemAccess: [
      "Lesender Zugriff auf KOMPASS, Outlook und Teamliste",
      "Schreibender Zugriff nur für freigegebene Beauftragungsentwürfe",
    ],
    expectedHumanRole:
      "Die Sachbearbeitung entscheidet über die Beauftragung und übernimmt Eskalationen bei unklarem Schadenbild.",
    potentialLevel: "high",
    potentialRationale:
      "Die dokumentierten Medienbrüche erzeugen Statuslücken und verzögern einen häufigen externen Übergabepunkt.",
    confidenceLevel: "high",
    confidenceRationale:
      "Systeme, Übergabe, Friststeuerung und menschliche Entscheidung sind im Prozessbild ausdrücklich erfasst.",
    assumptions: [],
    openQuestions: [],
  },
  {
    stepOrder: 4,
    title: "Kostenvoranschlag und Gutachten belegbasiert vorprüfen",
    currentSituation:
      "Positionen aus Kostenvoranschlag oder Gutachten werden manuell geprüft; Kürzungen müssen fachlich begründet werden.",
    aiContribution:
      "Der Arbeitsbegleiter stellt Positionen gegenüber, markiert Abweichungen und verknüpft jeden Hinweis mit seinem Beleg.",
    aiCapabilities: ["interpretation", "recommendation", "generation"],
    expectedChange:
      "Die Sachbearbeitung erhält eine nachvollziehbare Prüfliste, behält aber Leistungsentscheidung, Kürzung und Freigabe.",
    supportingDeterministicAutomation: [
      "Summen und Positionsnummern abgleichen",
      "Fehlende Belegreferenzen markieren",
    ],
    requiredInformationAndSystemAccess: [
      "Kostenvoranschlag, Gutachten und Vertragsdeckung",
      "Lesender Zugriff auf AKTE und VERA",
    ],
    expectedHumanRole:
      "Die Sachbearbeitung bewertet Abweichungen, begründet Kürzungen und gibt die Entschädigung frei.",
    potentialLevel: "high",
    potentialRationale:
      "Unstrukturierte Dokumente, wiederkehrender Vergleichsaufwand und hohe Erklärbarkeit sprechen für eine belegbasierte Assistenz.",
    confidenceLevel: "high",
    confidenceRationale:
      "Dokumenttypen, Kontrollpflicht und menschliche Entscheidung sind im bestätigten Ist-Prozess belegt.",
    assumptions: [],
    openQuestions: [],
  },
  {
    stepOrder: 6,
    title: "Ausnahmen und Folgeübergaben früh erkennen",
    currentSituation:
      "Verdachtsmerkmale, Rückgriffshinweise und zeitkritische Ausnahmen werden im laufenden Fall erkannt und an getrennte Prozesse übergeben.",
    aiContribution:
      "Der Arbeitsbegleiter bündelt belegte Hinweise, schlägt die passende Übergabe vor und hält die Entscheidung der Sachbearbeitung fest.",
    aiCapabilities: ["recognition", "interpretation", "recommendation"],
    expectedChange:
      "Ausnahmen werden früher sichtbar und nachvollziehbar übergeben, ohne automatisch eine Ablehnung oder Betrugsentscheidung auszulösen.",
    supportingDeterministicAutomation: [
      "Vollständigkeit des Übergabepakets prüfen",
    ],
    requiredInformationAndSystemAccess: [
      "Fallakte und dokumentierte Übergaberegeln",
      "Lesender Zugriff auf KOMPASS und AKTE",
    ],
    expectedHumanRole:
      "Die Sachbearbeitung bewertet den Hinweis und bestätigt jede Übergabe an Betrugsprüfung oder Regress.",
    potentialLevel: "medium",
    potentialRationale:
      "Die Übergaben sind fachlich wichtig und belegbar, treten aber seltener als die normale Fallbearbeitung auf.",
    confidenceLevel: "high",
    confidenceRationale:
      "Abgrenzung, Ausnahmen und Übergaben sind im bestätigten Prozess ausdrücklich dokumentiert.",
    assumptions: [],
    openQuestions: [],
  },
];

function hypotheses(
  process: ProcessCaptureRecord,
): OpportunityHypothesisResult {
  if (!process.understanding)
    throw new Error("Der Showcase-Prozess besitzt kein Prozessbild.");
  const byOrder = new Map(
    process.understanding.steps.map((step) => [step.order, step]),
  );
  const byStep = new Map<number, OpportunityHypothesis[]>();
  hypothesisContent.forEach((content, index) => {
    const step = byOrder.get(content.stepOrder);
    if (!step) throw new Error(`Showcase-Schritt ${content.stepOrder} fehlt.`);
    const { stepOrder: _stepOrder, ...businessContent } = content;
    void _stepOrder;
    const evidenceIds = step.evidenceIds.length
      ? step.evidenceIds
      : [process.understanding!.evidence[0]!.id];
    byStep.set(content.stepOrder, [
      {
        ...businessContent,
        id: `HYP-${String(index + 1).padStart(3, "0")}`,
        provenance: "ai_inferred",
        processStepId: step.id,
        evidenceIds,
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
          : "Die Verbesserung wird durch die übergreifenden Potenziale abgedeckt.",
        hypotheses: items,
      };
    }),
  });
}

function scenario(
  level: ScenarioLevel,
  process: ProcessCaptureRecord,
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
  const labels = {
    assistive: {
      title: "Belegbasierte Schadenassistenz",
      summary:
        "Die KI bereitet jeden Arbeitsschritt vor; die Sachbearbeitung stößt Aktionen an und entscheidet.",
      target:
        "Die Sachbearbeitung erhält strukturierte Fallübersichten, Prüflisten und Kommunikationsentwürfe.",
    },
    delegated: {
      title: "Delegierte Fallvorbereitung mit Freigaben",
      summary:
        "Die KI übernimmt klar abgegrenzte Vorbereitungs- und Nachhalteaufgaben, kritische Aktionen bleiben freigabepflichtig.",
      target:
        "Routineaufgaben laufen innerhalb fester Leitplanken; Deckung, Kürzung, Zahlung und Übergaben bleiben beim Menschen.",
    },
    agentic: {
      title: "Agentischer Schaden-Arbeitsbegleiter",
      summary:
        "Ein Agent koordiniert Eingänge, Vollständigkeit, Gutachterstatus und belegbasierte Vorprüfung über die Schadenstrecke.",
      target:
        "Der Agent hält den Fall arbeitsfähig, bereitet nächste Aktionen vor und eskaliert fachliche Entscheidungen nachvollziehbar.",
    },
  }[level];
  return {
    id: `SCN-${level}`,
    provenance: "ai_inferred",
    level,
    title: labels.title,
    summary: labels.summary,
    targetState: labels.target,
    includedHypothesisIds,
    excludedHypotheses: [],
    affectedProcessStepIds,
    changesFromToday: [
      "Eingänge und Belege werden fallbezogen strukturiert.",
      "Offene Gutachter- und Unterlagenaktionen werden aktiv nachgehalten.",
      "Prüfhinweise verweisen auf ihre fachlichen Belege.",
    ],
    aiResponsibilities: [
      "Unterlagen lesen, zuordnen und auf Vollständigkeit prüfen",
      "Fallstatus und nächste Aktionen zusammenführen",
      "Belegbasierte Prüf- und Kommunikationsentwürfe erstellen",
    ],
    aiCapabilities: [
      "interpretation",
      "recognition",
      "recommendation",
      "generation",
      "planning",
    ],
    deterministicAutomation: [
      "Wertgrenze und Pflichtunterlagen prüfen",
      "Fristen und Freigabestatus überwachen",
    ],
    orchestration: [
      "Unterlagenanforderung, Gutachterstatus und Prüfschritte koordinieren",
    ],
    humanResponsibilities: [
      "Deckung, Kürzungen und Entschädigung fachlich entscheiden",
      "Zahlung und externe Übergaben freigeben",
      "Eskalationen und Fälle mit geringer Konfidenz übernehmen",
    ],
    actions: [
      ...(autonomous
        ? [
            {
              name: "Fallvorbereitung aktualisieren",
              description:
                "Der Agent ordnet neue Belege zu, aktualisiert die Vollständigkeitsprüfung und hält Fristen nach.",
              processStepIds: affectedProcessStepIds,
              executionMode: "autonomous" as const,
              controls: [
                "Nur bestätigte Fall- und Vertragsquellen verwenden",
                "Jeden Hinweis mit einem Beleg verknüpfen",
              ],
              escalationTriggers: [],
            },
          ]
        : []),
      {
        name: "Fachliche Entscheidung freigeben",
        description:
          "Die Sachbearbeitung prüft Vorschlag und Belege vor jeder Deckungs-, Kürzungs-, Zahlungs- oder Übergabeentscheidung.",
        processStepIds: affectedProcessStepIds,
        executionMode: "approval_required",
        controls: [
          "Vier-Augen-Freigabe gemäß bestehender Kompetenzregel",
          "Entscheidungsgrund dokumentieren",
        ],
        escalationTriggers: agentic
          ? [
              "Widersprüchliche Deckungsinformation",
              "Geringe Konfidenz oder fehlender Beleg",
              "Verdachtsmerkmal, Rückgriff oder unbewohnbares Gebäude",
            ]
          : [],
      },
    ],
    humanOversight: [
      "Sachbearbeitung bestätigt alle fachlichen und finanziellen Aktionen",
      "Teamleitung überwacht Eskalationen, Fristen und Stichproben",
    ],
    informationAndDocuments: [
      "Schadenmeldung, Fotos und Kostenvoranschlag",
      "Vertragsdeckung und Kontaktdaten",
      "Gutachten, Schriftwechsel und Fallstatus",
    ],
    systemAccess: [
      {
        target: "KOMPASS, VERA und AKTE",
        accessModes: ["read"],
        timing: autonomous ? "on_demand" : "manual",
        possibleMechanisms: autonomous ? ["api"] : ["manual"],
        assumptions: [
          "Freigegebene lesende Schnittstellen und ein fallbezogenes Berechtigungskonzept werden eingerichtet.",
        ],
      },
      {
        target: "Outlook und Gutachter-Teamliste",
        accessModes: ["read", "write"],
        timing: autonomous ? "on_demand" : "manual",
        possibleMechanisms: autonomous ? ["api"] : ["manual"],
        assumptions: [
          "Schreibzugriffe bleiben auf Entwürfe und freigegebene Nachfassaktionen begrenzt.",
        ],
      },
    ],
    prerequisites: [
      "Pflichtunterlagen, Kompetenzregeln und Eskalationsgründe sind versioniert.",
      "Systemzugriffe werden nach Rolle und Fall begrenzt protokolliert.",
    ],
    risksAndFailureModes: [
      "Ein Dokument wird dem falschen Fall zugeordnet.",
      "Ein Prüfhinweis wird ohne ausreichenden Deckungsbezug erzeugt.",
      "Eine zeitkritische Ausnahme wird nicht eskaliert.",
    ],
    assumptions: [
      "Die genannten Systeme stellen geeignete Schnittstellen bereit.",
    ],
    openQuestions: [
      "Welche Schreibaktionen dürfen nach einer Pilotphase ohne Einzelfreigabe laufen?",
      "Welche Konfidenzschwelle löst zwingend eine Eskalation aus?",
    ],
    evidenceIds,
    confidenceLevel: "medium",
    confidenceRationale:
      "Fachlicher Ablauf, Belastungen und Kontrollpunkte sind belegt; technische Schnittstellen und Betriebsleitplanken sind noch zu klären.",
  };
}

function scenarios(
  process: ProcessCaptureRecord,
  result: OpportunityHypothesisResult,
): OpportunityScenarioResult {
  return opportunityScenarioResultSchema.parse({
    schemaVersion: 1,
    scenarios: (["assistive", "delegated", "agentic"] as const).map((level) =>
      scenario(level, process, result),
    ),
  });
}

const scoredCriteria = new Map<
  (typeof assessableCriterionIds)[number],
  { score: 0 | 1 | 2; rationale: string }
>([
  [
    "qualitative_process_improvement",
    {
      score: 2,
      rationale:
        "Der Agent reduziert dokumentierte Medienbrüche und stellt Eingänge, Status sowie Prüfbelege fallbezogen zusammen.",
    },
  ],
  [
    "customer_value",
    {
      score: 2,
      rationale:
        "Vollständigere Erstkontakte und sichtbare nächste Schritte adressieren die belegten Status- und Rückfrageprobleme der Kundenstrecke.",
    },
  ],
  [
    "employee_value",
    {
      score: 2,
      rationale:
        "Manuelles Übertragen, Sichten und Nachhalten werden vorbereitet; fachliche Entscheidungen verbleiben bei der Sachbearbeitung.",
    },
  ],
  [
    "temporal_process_improvement",
    {
      score: 2,
      rationale:
        "Die belegte mediane Durchlaufzeit von 19 Tagen trifft auf Wartezeiten bei Unterlagen und Gutachterterminen, die aktiv nachgehalten werden können.",
    },
  ],
  [
    "risk_reduction",
    {
      score: 1,
      rationale:
        "Belegverweise, Vollständigkeitskontrollen und explizite Eskalationen können Auslassungen senken, ohne die fachliche Entscheidung zu automatisieren.",
    },
  ],
  [
    "process_criticality",
    {
      score: 2,
      rationale:
        "Der Prozess steuert Deckungsprüfung, Entschädigung, Zahlung und zeitkritische Ausnahmen in der Schadenregulierung.",
    },
  ],
  [
    "process_expertise",
    {
      score: 2,
      rationale:
        "Regeln, professionelles Urteil, Rollen und Übergaben sind im bestätigten Prozessbild konkret beschrieben.",
    },
  ],
  [
    "process_diversity",
    {
      score: 2,
      rationale:
        "Mehrere Eingangskanäle, Dokumenttypen, Deckungsfälle und externe Übergaben erzeugen belegte Fallvarianten.",
    },
  ],
  [
    "process_systems",
    {
      score: 2,
      rationale:
        "KOMPASS, VERA, AKTE, SAP FI, Outlook und die Teamliste sind mit ihrer Rolle im Ablauf erfasst.",
    },
  ],
  [
    "process_data",
    {
      score: 1,
      rationale:
        "Fall- und Vertragsdaten sind vorhanden, liegen aber nachweislich über mehrere Systeme und unstrukturierte Dokumente verteilt.",
    },
  ],
  [
    "context_understanding",
    {
      score: 2,
      rationale:
        "Deckung, Schadenbild, Gebäudenutzung und Beleglage müssen gemeinsam interpretiert werden; reine Regelautomation reicht nicht aus.",
    },
  ],
  [
    "data_structuring_degree",
    {
      score: 2,
      rationale:
        "Freitext, Fotos, Kostenvoranschläge, Gutachten und E-Mail-Status erfordern eine deutliche Strukturierungsleistung.",
    },
  ],
  [
    "decision_complexity",
    {
      score: 2,
      rationale:
        "Wertgrenze, Vertragsdeckung und professionelles Urteil wirken zusammen; Ausnahmen müssen gesondert eskaliert werden.",
    },
  ],
  [
    "explainability_need",
    {
      score: 2,
      rationale:
        "Kürzungen, Deckung und Übergaben müssen gegenüber Kunden und internen Prüfstellen belegbar begründet werden.",
    },
  ],
  [
    "autonomy_and_human_ai_collaboration",
    {
      score: 2,
      rationale:
        "Das Szenario trennt autonome Fallvorbereitung klar von menschlicher Freigabe, Eskalation und Leistungsentscheidung.",
    },
  ],
]);

function assessment(process: ProcessCaptureRecord) {
  const evidenceIds = process.understanding!.evidence.map((item) => item.id);
  const hypothesisIds = ["HYP-001", "HYP-002", "HYP-003", "HYP-004"];
  return {
    schemaVersion: 1,
    criteria: assessableCriterionIds.map((criterionId) => {
      const scored = scoredCriteria.get(criterionId);
      if (scored)
        return {
          status: "scored" as const,
          criterionId,
          score: scored.score,
          confidenceLevel: "high" as const,
          rationale: scored.rationale,
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

export async function seedFlagshipOpportunity(
  root: string,
  process: ProcessCaptureRecord,
) {
  if (process.cover.processName !== flagshipTitle) return null;
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
  const hypothesisResult = hypotheses(process);
  await opportunities.saveHypotheses(process.id, hypothesisResult, trace());
  const opportunity = await opportunities.saveScenarios(
    process.id,
    scenarios(process, hypothesisResult),
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
  await assessments.saveResult(process.id, assessment(process), trace());
  return opportunity;
}
