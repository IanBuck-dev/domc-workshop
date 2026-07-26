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
      trigger:
        index === 0 ? "Lead ist fällig" : `Schritt ${index} ist abgeschlossen`,
      responsibleRoles: ["Vertrieb"],
      activity: `Fachliche Tätigkeit ${index + 1}`,
      information: ["CRM-Angaben"],
      output: `Ergebnis ${index + 1}`,
      systems: ["CRM"],
      decision: "Keine zusätzliche Entscheidung",
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
