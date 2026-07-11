import { z } from "zod";
import { claudeResultSchema } from "../../domain/src/schemas.ts";
export const claudeEnvelopeSchema = z
  .object({ type: z.string().optional(), result: z.string().optional() })
  .passthrough();
export { claudeResultSchema };
export const claudeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "brief",
    "clarificationQuestions",
    "aiRelevance",
    "relevanceRationale",
    "conventionalAlternative",
    "priority",
    "priorityComponents",
    "impact",
    "effort",
    "confidence",
    "assumptions",
    "risks",
    "reviewFlags",
    "assessment",
  ],
  properties: {
    brief: { type: "string" },
    clarificationQuestions: {
      type: "array",
      maxItems: 3,
      items: { type: "string" },
    },
    aiRelevance: {
      type: "string",
      enum: ["Stark", "Möglich", "Schwach", "Keine"],
    },
    relevanceRationale: { type: "string" },
    conventionalAlternative: { type: "string" },
    priority: { type: "integer", minimum: 1, maximum: 5 },
    priorityComponents: {
      type: "object",
      additionalProperties: false,
      required: [
        "businessImpact",
        "urgency",
        "strategicFit",
        "riskReduction",
        "feasibility",
        "dependencyReadiness",
      ],
      properties: {
        businessImpact: { type: "number", minimum: 1, maximum: 5 },
        urgency: { type: "number", minimum: 1, maximum: 5 },
        strategicFit: { type: "number", minimum: 1, maximum: 5 },
        riskReduction: { type: "number", minimum: 1, maximum: 5 },
        feasibility: { type: "number", minimum: 1, maximum: 5 },
        dependencyReadiness: { type: "number", minimum: 1, maximum: 5 },
      },
    },
    impact: { type: "integer", minimum: 1, maximum: 10 },
    effort: { type: "integer", minimum: 1, maximum: 10 },
    confidence: { type: "number", minimum: 0, maximum: 100 },
    assumptions: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    reviewFlags: { type: "array", items: { type: "string" } },
    assessment: { type: "string" },
  },
};
