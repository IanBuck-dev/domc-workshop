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
