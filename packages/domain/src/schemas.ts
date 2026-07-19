import { z } from "zod";

export const stateSchema = z.enum([
  "Entwurf",
  "Klärung nötig",
  "Bewertungsbereit",
  "Bewertet",
  "Für Übergabe ausgewählt",
  "Übergeben",
  "Archiviert",
]);
export const evidenceSchema = z.enum(["PUBLIC", "INFERRED", "FICTIONAL"]);
export const relevanceSchema = z.enum(["Stark", "Möglich", "Schwach", "Keine"]);
export const sourceSchema = z.object({
  title: z.string(),
  publisher: z.string(),
  url: z.string().url(),
});
export const scoresSchema = z.object({
  priority: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(10),
  effort: z.number().int().min(1).max(10),
  confidence: z.number().min(0).max(100),
});
export const ideaSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^IDEA-\d{4}$/),
  title: z.string().min(1),
  description: z.string(),
  raw: z.string(),
  brief: z.string(),
  assessment: z.string(),
  evidenceLevel: evidenceSchema,
  sources: z.array(sourceSchema).default([]),
  state: stateSchema,
  aiRelevance: relevanceSchema,
  relevanceRationale: z.string(),
  conventionalAlternative: z.string(),
  scores: scoresSchema,
  scoreComponents: z.record(z.string(), z.number()).default({}),
  assumptions: z.array(z.string()),
  risks: z.array(z.string()),
  reviewFlags: z.array(z.string()),
  clarificationQuestions: z.array(z.string()).max(3),
  clarificationAnswers: z.record(z.string(), z.string()).default({}),
  override: z
    .object({ previous: z.number(), reason: z.string(), at: z.string() })
    .nullable(),
  handoverReady: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Idea = z.infer<typeof ideaSchema>;
export const workshopSchema = z.object({
  workshopTitle: z.string(),
  workshopSubtitle: z.string(),
  model: z.string(),
  modelDisplay: z.string(),
  effort: z.enum(["low", "medium", "high", "xhigh", "max"]),
  impactThreshold: z.number(),
  effortThreshold: z.number(),
  scoringGuidance: z.string(),
  weights: z.record(z.string(), z.number().positive()),
  models: z.array(z.object({ label: z.string(), value: z.string() })),
  discovery: z.object({
    model: z.string().min(1),
    modelDisplay: z.string().min(1),
    effort: z.enum(["low", "medium", "high", "xhigh", "max"]),
    timeoutMs: z.number().int().min(10_000).max(180_000),
    maxOutputTokens: z.number().int().min(256).max(8_192),
    maxQuestions: z.number().int().min(2).max(20),
    departments: z.array(z.string().min(1)),
    criteria: z.array(
      z.object({ id: z.string().min(1), question: z.string().min(1) }),
    ),
  }),
});
export type Workshop = z.infer<typeof workshopSchema>;
export const claudeResultSchema = z.object({
  brief: z.string(),
  clarificationQuestions: z.array(z.string()).max(3).default([]),
  aiRelevance: relevanceSchema,
  relevanceRationale: z.string(),
  conventionalAlternative: z.string(),
  priority: z.number().int().min(1).max(5),
  priorityComponents: z.object({
    businessImpact: z.number().min(1).max(5),
    urgency: z.number().min(1).max(5),
    strategicFit: z.number().min(1).max(5),
    riskReduction: z.number().min(1).max(5),
    feasibility: z.number().min(1).max(5),
    dependencyReadiness: z.number().min(1).max(5),
  }),
  impact: z.number().int().min(1).max(10),
  effort: z.number().int().min(1).max(10),
  confidence: z.number().min(0).max(100),
  assumptions: z.array(z.string()),
  risks: z.array(z.string()),
  reviewFlags: z.array(z.string()),
  assessment: z.string(),
});

export const processStateSchema = z.enum([
  "Interview läuft",
  "Interview abgeschlossen",
  "PDD erstellt",
  "Geprüft",
]);
export const processStepClassificationSchema = z.enum([
  "deterministisch",
  "KI-erforderlich",
  "hybrid",
  "nur-menschlich",
]);
export const criterionAnswerSchema = z.enum([
  "ja",
  "teilweise",
  "nein",
  "unklar",
]);
export const processStepSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  classification: processStepClassificationSchema,
  reasoning: z.string().min(1),
});
export const criterionAssessmentSchema = z.object({
  criterionId: z.string().min(1),
  question: z.string().min(1),
  answer: criterionAnswerSchema,
  evidence: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(100),
});
export const processExtractionSchema = z.object({
  schemaVersion: z.literal(1),
  processName: z.string().default("Unbenannter Prozess"),
  department: z.string().default("Noch offen"),
  contact: z.string().default("Nicht angegeben"),
  trigger: z.string().default("Noch offen"),
  frequency: z.string().default("Noch offen"),
  volume: z.string().default("Noch offen"),
  systems: z.array(z.string()).default([]),
  documents: z.array(z.string()).default([]),
  painPoints: z.array(z.string()).default([]),
  steps: z.array(processStepSchema).default([]),
  criteriaAssessment: z.array(criterionAssessmentSchema).default([]),
  openQuestions: z.array(z.string()).default([]),
});
export const processExtractionDeltaSchema = processExtractionSchema
  .omit({ schemaVersion: true })
  .partial();
export const discoveryTurnSchema = z.object({
  extractionDelta: processExtractionDeltaSchema,
  criteriaCoverage: z.number().int().min(0),
  openPoints: z.array(z.string()),
  interviewComplete: z.boolean(),
});
export const transcriptTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1),
  timestamp: z.string(),
});
export const processMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^PROC-\d{4}$/),
  state: processStateSchema,
  department: z.string(),
  sessionId: z.string().uuid(),
  sessionStarted: z.boolean().default(false),
  model: z.string(),
  modelDisplay: z.string(),
  effort: z.enum(["low", "medium", "high", "xhigh", "max"]),
  interviewComplete: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const processUploadSchema = z.object({
  name: z.string(),
  size: z.number().int().nonnegative(),
});
export const processRecordSchema = z.object({
  metadata: processMetadataSchema,
  extraction: processExtractionSchema,
  transcript: z.array(transcriptTurnSchema),
  pdd: z.string(),
  uploads: z.array(processUploadSchema),
});
export type ProcessState = z.infer<typeof processStateSchema>;
export type ProcessStepClassification = z.infer<
  typeof processStepClassificationSchema
>;
export type ProcessExtraction = z.infer<typeof processExtractionSchema>;
export type ProcessExtractionDelta = z.infer<
  typeof processExtractionDeltaSchema
>;
export type DiscoveryTurn = z.infer<typeof discoveryTurnSchema>;
export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;
export type ProcessMetadata = z.infer<typeof processMetadataSchema>;
export type ProcessRecord = z.infer<typeof processRecordSchema>;
