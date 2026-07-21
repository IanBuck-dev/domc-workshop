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

const nonEmptyString = z.string().trim().min(1);

export const aiEvidenceSchema = z.array(nonEmptyString).max(30);

export const gatewayDecisionSchema = z.object({
  questionId: nonEmptyString,
  decision: z.enum(["yes", "no", "unclear"]),
  confidence: z.number().int().min(0).max(100),
  rationale: nonEmptyString.max(2_000),
  evidence: aiEvidenceSchema,
  assumptions: z.array(nonEmptyString).max(20),
});

export const gatewayResultSchema = z
  .object({
    decisions: z.array(gatewayDecisionSchema).length(4),
    followUpQuestion: z.string().trim().min(1).max(1_000).nullable(),
  })
  .superRefine((value, context) => {
    const ids = value.decisions.map((decision) => decision.questionId);
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: "custom",
        message: "Gateway decisions must use four distinct question IDs.",
        path: ["decisions"],
      });
  });

export const gatewayElicitationResultSchema = z
  .object({
    assistantMessage: nonEmptyString.max(4_000),
    questions: z
      .array(
        z.object({
          questionId: nonEmptyString,
          question: nonEmptyString.max(4_000),
          recognitionAids: z.array(nonEmptyString.max(500)).max(6),
        }),
      )
      .length(4),
  })
  .superRefine((value, context) => {
    const ids = value.questions.map((question) => question.questionId);
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: "custom",
        message: "Gateway elicitation must use four distinct question IDs.",
        path: ["questions"],
      });
  });

export const criterionProposalSchema = z.object({
  criterionId: nonEmptyString,
  value: z.union([z.number().finite(), z.boolean()]),
  rationale: nonEmptyString.max(2_000),
  evidence: aiEvidenceSchema,
  assumptions: z.array(nonEmptyString).max(20),
  confidence: z.number().int().min(0).max(100),
});

export const criteriaProposalsResultSchema = z.object({
  message: z.string().max(8_000),
  proposals: z.array(criterionProposalSchema).max(28),
  askFollowUp: z.boolean(),
});

export const reviewCorrectionSchema = z.object({
  criterionId: nonEmptyString,
  value: z.union([z.number().finite(), z.boolean()]),
  rationale: nonEmptyString.max(2_000),
});

export const reviewFindingSchema = z.object({
  id: nonEmptyString,
  severity: z.enum(["info", "warning", "blocking"]),
  criterionIds: z.array(nonEmptyString).max(28),
  evidence: aiEvidenceSchema,
  explanation: nonEmptyString.max(3_000),
  proposedCorrection: reviewCorrectionSchema.nullable(),
});

export const reviewResultSchema = z.object({
  summary: nonEmptyString.max(5_000),
  findings: z.array(reviewFindingSchema).max(20),
});

export const reviewChatResultSchema = z.object({
  message: nonEmptyString.max(8_000),
});

export type GatewayResult = z.infer<typeof gatewayResultSchema>;
export type GatewayElicitationResult = z.infer<
  typeof gatewayElicitationResultSchema
>;
export type CriterionProposal = z.infer<typeof criterionProposalSchema>;
export type CriteriaProposalsResult = z.infer<
  typeof criteriaProposalsResultSchema
>;
export type ReviewResult = z.infer<typeof reviewResultSchema>;
export type ReviewChatResult = z.infer<typeof reviewChatResultSchema>;

export const gatewayResultJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["decisions", "followUpQuestion"],
  properties: {
    decisions: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "questionId",
          "decision",
          "confidence",
          "rationale",
          "evidence",
          "assumptions",
        ],
        properties: {
          questionId: { type: "string", minLength: 1 },
          decision: { type: "string", enum: ["yes", "no", "unclear"] },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
          rationale: { type: "string", minLength: 1 },
          evidence: { type: "array", items: { type: "string", minLength: 1 } },
          assumptions: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
        },
      },
    },
    followUpQuestion: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
  },
} as const;

export const criteriaProposalsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["message", "proposals", "askFollowUp"],
  properties: {
    message: { type: "string" },
    proposals: {
      type: "array",
      maxItems: 28,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "criterionId",
          "value",
          "rationale",
          "evidence",
          "assumptions",
          "confidence",
        ],
        properties: {
          criterionId: { type: "string", minLength: 1 },
          value: {
            anyOf: [{ type: "number" }, { type: "boolean" }],
          },
          rationale: { type: "string", minLength: 1 },
          evidence: { type: "array", items: { type: "string", minLength: 1 } },
          assumptions: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
        },
      },
    },
    askFollowUp: { type: "boolean" },
  },
} as const;

export const reviewResultJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "findings"],
  properties: {
    summary: { type: "string", minLength: 1 },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "severity",
          "criterionIds",
          "evidence",
          "explanation",
          "proposedCorrection",
        ],
        properties: {
          id: { type: "string", minLength: 1 },
          severity: {
            type: "string",
            enum: ["info", "warning", "blocking"],
          },
          criterionIds: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          evidence: { type: "array", items: { type: "string", minLength: 1 } },
          explanation: { type: "string", minLength: 1 },
          proposedCorrection: {
            anyOf: [
              { type: "null" },
              {
                type: "object",
                additionalProperties: false,
                required: ["criterionId", "value", "rationale"],
                properties: {
                  criterionId: { type: "string", minLength: 1 },
                  value: {
                    anyOf: [{ type: "number" }, { type: "boolean" }],
                  },
                  rationale: { type: "string", minLength: 1 },
                },
              },
            ],
          },
        },
      },
    },
  },
} as const;

export const reviewChatResultJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["message"],
  properties: { message: { type: "string", minLength: 1 } },
} as const;
