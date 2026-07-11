import type { Idea } from "../../domain/src/schemas.ts";
const now = "2026-07-11T09:00:00.000Z";
const rows = [
  [
    "KIM – automatisierte Schadenbearbeitung",
    "Dokumente und Schadeninformationen analysieren, Entscheidungen vorbereiten und Standardfälle beschleunigen.",
    "PUBLIC",
    5,
    10,
    9,
  ],
  [
    "KIM Partner Rollout",
    "KI-Schadenservice an Prozesse, Datenmodelle und Bestandsführung externer Versicherer anbinden.",
    "PUBLIC",
    5,
    9,
    8,
  ],
  [
    "AI Governance & Audit Cockpit",
    "Entscheidungen, Dokumente, Regeln, Modellversionen und menschliche Freigaben nachvollziehbar machen.",
    "INFERRED",
    5,
    9,
    6,
  ],
  [
    "KI-Eingangspost und Schaden-Triage",
    "E-Mails und Anhänge klassifizieren, fehlende Unterlagen erkennen und Fälle routen.",
    "FICTIONAL",
    5,
    8,
    4,
  ],
  [
    "Unwetter- und Massenschadenmodus",
    "Fälle nach Dringlichkeit, Schadentyp und Vollständigkeit priorisieren und Kapazitäten verteilen.",
    "FICTIONAL",
    4,
    9,
    7,
  ],
  [
    "Vermittler-Copilot",
    "Fragen zu Bedingungen und Deckungen mit relevanten Klauseln beantworten.",
    "FICTIONAL",
    4,
    8,
    7,
  ],
  [
    "KI-Dokumentenprüfung im Underwriting",
    "Gebäude-, Risiko- und Vertragsdaten extrahieren und Anträge vorbereiten.",
    "FICTIONAL",
    4,
    7,
    6,
  ],
  [
    "Automatisierte Kundenkommunikation",
    "Rückfragen, Statusmeldungen und Auszahlungsschreiben als prüfbare Entwürfe erzeugen.",
    "FICTIONAL",
    4,
    6,
    3,
  ],
  [
    "Betrugs- und Anomalieerkennung",
    "Doppelte Rechnungen, wiederverwendete Bilder und ungewöhnliche Schadenmuster markieren.",
    "FICTIONAL",
    3,
    8,
    9,
  ],
  [
    "Interner Wissensassistent",
    "Prozesse, Arbeitsanweisungen und Bedingungen mit Quellenangaben durchsuchbar machen.",
    "FICTIONAL",
    3,
    5,
    4,
  ],
  [
    "KI-Zusammenfassung für Tickets und Meetings",
    "Verlauf, Entscheidungen und offene Aufgaben automatisch dokumentieren.",
    "FICTIONAL",
    2,
    3,
    2,
  ],
  [
    "Eigenes Versicherungs-Foundation-Model trainieren",
    "Ein eigenes Basismodell statt bestehender Modelle entwickeln.",
    "FICTIONAL",
    1,
    4,
    10,
  ],
] as const;
const sources: Record<number, Idea["sources"]> = {
  0: [
    {
      title: "Innovationspreis der Assekuranz",
      publisher: "DOMCURA",
      url: "https://www.domcura.de/news/detail/innovationspreis-der-assekuranz",
    },
  ],
  1: [
    {
      title: "DOMCURA-KI unterstützt nun auch andere Firmen",
      publisher: "AssCompact",
      url: "https://www.asscompact.de/nachrichten/domcura-ki-unterstuetzt-nun-auch-andere-firmen",
    },
  ],
  2: [
    {
      title:
        "Unser Vorsprung ist heute doppelt – DOMCURA setzt auf KI mit menschlichem Kern",
      publisher: "Cash.-Online",
      url: "https://www.cash-online.de/a/unser-vorsprung-ist-heute-doppelt-domcura-setzt-auf-ki-mit-menschlichem-kern-705814/",
    },
  ],
};
const flags = [
  "Datenschutz und Datenminimierung prüfen",
  "Informationssicherheit und Hosting klären",
  "Menschliche Freigabe und Auditierbarkeit festlegen",
  "Fachbereich und IT als Verantwortliche benennen",
];
export const demoIdeas: Idea[] = rows.map((r, n) => ({
  schemaVersion: 1,
  id: `IDEA-${String(n + 1).padStart(4, "0")}`,
  title: r[0],
  description: r[1],
  raw: r[1],
  brief: `## Zielbild\n${r[1]}\n\n## Betroffener Prozess\nIm Workshop gemeinsam konkretisieren.\n\n## Kleinster Discovery-Schritt\nDatenlage, Prozessverantwortung und messbares Ergebnis in einem Fach-/IT-Termin klären.`,
  assessment:
    n === 11
      ? "Ein eigenes Basismodell hat sehr hohen Aufwand und für den beschriebenen Nutzen keinen belastbaren Vorteil. Zuerst bestehende Modelle und konventionelle Wissenssysteme vergleichen."
      : `Demo-Einschätzung: Das Vorhaben hat einen Impact von ${r[4]}/10 bei einem Aufwand von ${r[5]}/10. Wirkung, Datenverfügbarkeit und Prozessintegration müssen validiert werden.`,
  evidenceLevel: r[2],
  sources: sources[n] ?? [],
  state: "Bewertet",
  aiRelevance: n === 11 ? "Schwach" : "Stark",
  relevanceRationale:
    n === 11
      ? "Der Bedarf lässt sich voraussichtlich mit bestehenden Modellen abdecken."
      : "Mustererkennung, Dokumentverständnis oder assistierte Textarbeit sind wesentliche Bestandteile.",
  conventionalAlternative:
    n === 11
      ? "Bestehendes Modell mit Quellenzugriff und klarer Evaluation einsetzen."
      : "Regelbasierten Workflow und Prozessoptimierung als Vergleichsoption prüfen.",
  scores: {
    priority: r[3],
    impact: r[4],
    effort: r[5],
    confidence: n < 3 ? 75 : 60,
  },
  scoreComponents: {
    Geschäftswirkung: r[4],
    Umsetzbarkeit: 11 - r[5],
    StrategischerFit: r[3],
  },
  assumptions: [
    "Datenzugang und fachliche Verantwortlichkeit sind noch zu bestätigen.",
  ],
  risks: [
    "Fehlinterpretationen müssen durch fachliche Kontrolle abgefangen werden.",
  ],
  reviewFlags: flags,
  clarificationQuestions: [],
  clarificationAnswers: {},
  override: null,
  handoverReady: true,
  createdAt: new Date(Date.parse(now) + n * 1000).toISOString(),
  updatedAt: now,
}));
