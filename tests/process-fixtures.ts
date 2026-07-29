import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  processCaptureConfigSchema,
  processUnderstandingSchema,
  topicIds,
  type ProcessCaptureConfig,
  type ProcessUnderstanding,
  type TopicAnswer,
  type WorkCharacteristicAnswer,
} from "../packages/domain/src/process-understanding.ts";

export async function processConfig(): Promise<
  Extract<ProcessCaptureConfig, { profile: { version: 2 } }>
> {
  const config = processCaptureConfigSchema.parse(
    JSON.parse(
      await readFile(
        join(import.meta.dir, "..", "defaults", "process-capture-config.json"),
        "utf8",
      ),
    ),
  );
  if (config.profile.version !== 2 || !("workCharacteristics" in config))
    throw new Error("The active test config must use profile version 2.");
  return config;
}

export const cover = {
  department: "Vertrieb",
  participantName: "Test Person",
  participantEmail: "test@example.invalid",
  processName: "Fiktiver Cold-Leads-Prozess",
};

export function answers(): TopicAnswer[] {
  const now = new Date().toISOString();
  return topicIds.map((topicId, index) => ({
    topicId,
    text: `Ausführliche fiktive Antwort ${index + 1} zum normalen Prozessablauf.`,
    answeredAt: now,
  }));
}

export function workCharacteristicAnswers(): WorkCharacteristicAnswer[] {
  const answeredAt = new Date().toISOString();
  return [
    {
      characteristicId: "combined-information-sources",
      selectedOptionIds: ["yes"],
      answeredAt,
    },
    {
      characteristicId: "content-types",
      selectedOptionIds: ["free-text", "images-scans"],
      answeredAt,
    },
    {
      characteristicId: "case-specific-recognition",
      selectedOptionIds: ["detect-unusual-cases", "adapt-case-flow"],
      answeredAt,
    },
    {
      characteristicId: "uncertain-decisions",
      selectedOptionIds: ["decide-with-incomplete-rules"],
      answeredAt,
    },
  ];
}

const stringFact = (value: string | null, evidenceIds = ["purpose-scope"]) => ({
  value,
  provenance:
    value === null ? ("unknown" as const) : ("ai_structured" as const),
  evidenceIds: value === null ? [] : evidenceIds,
  confidence: value === null ? null : 85,
  assumptions: [],
  confirmed: false,
});
const listFact = (value: string[] | null, evidenceIds = ["flow-roles"]) => ({
  value,
  provenance:
    value === null ? ("unknown" as const) : ("ai_structured" as const),
  evidenceIds: value === null ? [] : evidenceIds,
  confidence: value === null ? null : 85,
  assumptions: [],
  confirmed: false,
});

export function understanding(stepCount = 5): ProcessUnderstanding {
  return processUnderstandingSchema.parse({
    schemaVersion: 2,
    purpose: stringFact("Kalte Leads fachlich korrekt erneut ansprechen."),
    trigger: stringFact("Ein Lead wurde länger nicht kontaktiert."),
    outcome: stringFact("Eine geprüfte Nachricht wurde versendet."),
    boundaries: stringFact(
      "Vom CRM-Filter bis zur Dokumentation der Ansprache.",
    ),
    participants: listFact(["Vertriebsmitarbeiter"]),
    informationSources: listFact(
      ["CRM", "frühere E-Mails"],
      ["information-systems"],
    ),
    systems: listFact(["Vertriebs-CRM"], ["information-systems"]),
    decisions: listFact(["Kontakt erlaubt?"], ["decisions-controls-handoffs"]),
    controls: listFact(
      ["Einwilligung prüfen"],
      ["decisions-controls-handoffs"],
    ),
    handoffs: listFact(
      ["Keine reguläre Teamübergabe"],
      ["decisions-controls-handoffs"],
    ),
    volumeAndTime: listFact(
      ["Ungefähr 20 Leads pro Woche"],
      ["effort-pain-goals"],
    ),
    painPoints: listFact(["Manuelle Einzelprüfung"], ["effort-pain-goals"]),
    improvementGoals: listFact(["Weniger Suchaufwand"], ["effort-pain-goals"]),
    steps: Array.from({ length: stepCount }, (_, index) => ({
      id: `step-${index + 1}`,
      order: index + 1,
      name: `Hauptschritt ${index + 1}`,
      activity: `Fachliche Tätigkeit ${index + 1}`,
      inputs: [index === 0 ? "Fälliger Lead" : `Ergebnis ${index}`],
      outputs: [`Ergebnis ${index + 1}`],
      informationItems: [
        {
          id: `info-${index + 1}-1`,
          name: "CRM-Angaben",
          source: "Vertriebs-CRM",
          type: "system_field" as const,
          typeDetail: null,
        },
      ],
      decisions:
        index === 0
          ? [
              {
                id: "decision-1-1",
                question: "Ist die erneute Kontaktaufnahme erlaubt?",
                mode: "rule_based" as const,
                options: [
                  {
                    id: "option-1-1-1",
                    label: "Ja",
                    determination: "Eine gültige Einwilligung ist hinterlegt.",
                    consequence: "Der Lead wird weiterbearbeitet.",
                    nextStepId: stepCount > 1 ? "step-2" : null,
                  },
                  {
                    id: "option-1-1-2",
                    label: "Nein",
                    determination: "Keine gültige Einwilligung ist hinterlegt.",
                    consequence: "Die Kontaktaufnahme wird beendet.",
                    nextStepId: null,
                  },
                ],
              },
            ]
          : [],
      miscellaneous: "Plausibilitätsprüfung durch den Vertrieb.",
      provenance: "ai_structured" as const,
      evidenceIds: [
        "flow-roles",
        "information-systems",
        "decisions-controls-handoffs",
        "effort-pain-goals",
      ],
      confidence: 85,
      assumptions: [],
      confirmed: false,
    })),
    evidence: topicIds.map((topicId) => ({
      id: topicId,
      kind: "main_answer",
      sourceId: topicId,
      excerpt: `Fiktive Evidenz für ${topicId}`,
    })),
    documentCoverage: [],
    knowledgeGaps: ["Exakte Fallzahl unbekannt"],
    conflicts: [],
  });
}

export function legacyUnderstanding(stepCount = 5) {
  const current = understanding(stepCount);
  const globalFacts = structuredClone(current) as Record<string, unknown>;
  delete globalFacts.schemaVersion;
  delete globalFacts.steps;
  return {
    ...globalFacts,
    steps: Array.from({ length: stepCount }, (_, index) => ({
      id: `step-${index + 1}`,
      order: index + 1,
      name: `Hauptschritt ${index + 1}`,
      trigger:
        index === 0 ? "Lead ist fällig" : `Schritt ${index} ist abgeschlossen`,
      responsibleRoles: ["Vertrieb"],
      activity: `Fachliche Tätigkeit ${index + 1}`,
      information: ["CRM-Angaben"],
      output: `Ergebnis ${index + 1}`,
      systems: ["CRM"],
      decision: index === 0 ? "Ist die Kontaktaufnahme erlaubt?" : null,
      ruleOrJudgement: "Bekannte fachliche Regel",
      handover: "Weiter zum nächsten Hauptschritt",
      controls: ["Plausibilitätsprüfung"],
      painPoints: ["Manuelle Bearbeitung"],
      provenance: "ai_structured" as const,
      evidenceIds: [
        "flow-roles",
        "information-systems",
        "decisions-controls-handoffs",
        "effort-pain-goals",
      ],
      confidence: 85,
      assumptions: [],
      confirmed: false,
    })),
  };
}

export function synthesisUnderstanding(stepCount = 5) {
  const current = understanding(stepCount);
  return {
    ...current,
    steps: current.steps.map((step) => ({
      ...step,
      informationItems: step.informationItems.map((item) => ({
        name: item.name,
        source: item.source,
        type: item.type,
        typeDetail: item.typeDetail,
      })),
      decisions: step.decisions.map((decision) => ({
        question: decision.question,
        mode: decision.mode,
        options: decision.options.map((option) => ({
          label: option.label,
          determination: option.determination,
          consequence: option.consequence,
          nextStepId: option.nextStepId,
        })),
      })),
    })),
  };
}
