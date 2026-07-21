import { z } from "zod";

export const interactionModeSchema = z.enum(["form", "chat"]);
export const assessmentStateSchema = z.enum([
  "gateway_in_progress",
  "submitted_without_clear_ai_signal",
  "criteria_in_progress",
  "ready_for_review",
  "review_in_progress",
  "review_changes_required",
  "ready_for_confirmation",
  "confirmed",
]);
export const criterionSourceSchema = z.enum(["none", "ai", "human"]);
export const criterionConfirmationSchema = z.enum([
  "empty",
  "pending",
  "confirmed",
]);
export const actorSchema = z.enum(["ai", "human"]);
export const isoDateSchema = z.string().datetime({ offset: true });
const idSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{1,79}$/);

export const criterionInputTypeSchema = z.enum([
  "currency",
  "integer",
  "boolean",
]);
export const scoringDirectionSchema = z.enum([
  "higher_is_better",
  "lower_is_better",
]);

export const gatewayQuestionConfigSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(200),
    evaluationQuestion: z.string().trim().min(1).max(4_000).optional(),
    userQuestion: z.string().trim().min(1).max(4_000).optional(),
    helpText: z.string().trim().min(1).max(4_000).optional(),
    /** Legacy v1 field retained so frozen assessment snapshots remain readable. */
    description: z.string().trim().min(1).max(4_000).optional(),
    displayOrder: z.number().int().nonnegative(),
  })
  .superRefine((question, ctx) => {
    if (!question.evaluationQuestion && !question.description)
      ctx.addIssue({
        code: "custom",
        path: ["evaluationQuestion"],
        message: "Eine interne Prüffrage ist erforderlich.",
      });
    if (!question.userQuestion && !question.description)
      ctx.addIssue({
        code: "custom",
        path: ["userQuestion"],
        message: "Eine sichtbare Nutzerfrage ist erforderlich.",
      });
    if (!question.helpText && !question.description)
      ctx.addIssue({
        code: "custom",
        path: ["helpText"],
        message: "Ein verständlicher Hilfstext ist erforderlich.",
      });
  });
export const assessmentSectionConfigSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000).default(""),
  mainQuestion: z.string().trim().min(1).max(4_000),
  displayOrder: z.number().int().nonnegative(),
});
export const criterionConfigSchema = z
  .object({
    id: idSchema,
    sectionId: idSchema,
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(4_000),
    inputType: criterionInputTypeSchema,
    minimum: z.number().finite(),
    maximum: z.number().finite(),
    scoringDirection: scoringDirectionSchema,
    weight: z.number().positive().finite(),
    displayOrder: z.number().int().nonnegative(),
  })
  .superRefine((value, ctx) => {
    if (value.maximum < value.minimum)
      ctx.addIssue({
        code: "custom",
        path: ["maximum"],
        message: "Der Höchstwert muss mindestens dem Mindestwert entsprechen.",
      });
    if (
      value.inputType === "boolean" &&
      (value.minimum !== 0 || value.maximum !== 1)
    )
      ctx.addIssue({
        code: "custom",
        path: ["inputType"],
        message: "Boolesche Kriterien benötigen den Wertebereich 0 bis 1.",
      });
  });

export const assessmentConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    instructions: z.object({
      gateway: z.string().min(1).max(30_000),
      formPrefill: z.string().min(1).max(30_000),
      chat: z.string().min(1).max(30_000),
      reviewer: z.string().min(1).max(30_000),
    }),
    openingMessage: z.string().trim().min(1).max(8_000),
    departments: z.array(z.string().trim().min(1).max(120)).min(1).max(100),
    gateway: z.object({
      questions: z.array(gatewayQuestionConfigSchema).length(4),
      maxFollowUps: z.number().int().min(0).max(1),
    }),
    chat: z.object({
      sections: z.array(assessmentSectionConfigSchema).length(5),
      maxFollowUpsPerSection: z.number().int().min(0).max(2),
    }),
    criteria: z.array(criterionConfigSchema).length(28),
    uploads: z.object({
      allowedExtensions: z
        .array(
          z.enum([
            "pdf",
            "xlsx",
            "csv",
            "docx",
            "txt",
            "md",
            "png",
            "jpg",
            "jpeg",
          ]),
        )
        .min(1),
      maxFileBytes: z
        .number()
        .int()
        .positive()
        .max(20 * 1024 * 1024),
      maxAssessmentBytes: z
        .number()
        .int()
        .positive()
        .max(100 * 1024 * 1024),
    }),
    scoring: z.object({
      formulaVersion: z.literal("corporate-v1"),
      financialCriterionIds: z.object({
        annualSavings: idSchema,
        oneTimeSavings: idSchema,
        annualOperatingCosts: idSchema,
        oneTimeCosts: idSchema,
        absoluteNecessity: idSchema,
      }),
      sectionIds: z.object({
        strategic: idSchema,
        implementation: idSchema,
        technical: idSchema,
      }),
      paybackMonthThresholds: z.tuple([
        z.number().positive(),
        z.number().positive(),
        z.number().positive(),
        z.number().positive(),
      ]),
      yearOneNetReturnThresholds: z.tuple([
        z.number().nonnegative(),
        z.number().nonnegative(),
        z.number().nonnegative(),
        z.number().nonnegative(),
      ]),
      roiThresholds: z.tuple([
        z.number().nonnegative(),
        z.number().nonnegative(),
        z.number().nonnegative(),
        z.number().nonnegative(),
      ]),
      profitabilityWeight: z.number().min(0).max(1),
      strategicWeight: z.number().min(0).max(1),
      plausibilityWarningAmount: z.number().nonnegative(),
      configuredMinimum: z.number().finite(),
      configuredMaximum: z.number().finite(),
    }),
    ai: z.object({
      model: z.string().min(1).max(200),
      reasoningEffort: z.enum(["low", "medium", "high", "xhigh", "max"]),
      timeoutMs: z.number().int().min(10_000).max(300_000),
      maxOutputTokens: z.number().int().min(256).max(32_768),
      maxInputCharacters: z.number().int().positive().max(2_000_000),
      maxBudgetUsd: z.number().positive().max(100),
      reviewerChatLimit: z.number().int().min(0).max(3),
    }),
  })
  .superRefine((config, ctx) => {
    const duplicatePaths = (
      values: string[],
      path: (string | number)[],
      label: string,
    ) => {
      const duplicates = values.filter(
        (value, index) => values.indexOf(value) !== index,
      );
      if (duplicates.length)
        ctx.addIssue({
          code: "custom",
          path,
          message: `${label} müssen eindeutig sein.`,
        });
    };
    duplicatePaths(
      config.gateway.questions.map((item) => item.id),
      ["gateway", "questions"],
      "Frage-IDs",
    );
    duplicatePaths(
      config.chat.sections.map((item) => item.id),
      ["chat", "sections"],
      "Bereichs-IDs",
    );
    duplicatePaths(
      config.criteria.map((item) => item.id),
      ["criteria"],
      "Kriterien-IDs",
    );
    duplicatePaths(config.departments, ["departments"], "Fachbereiche");
    const sectionIds = new Set(config.chat.sections.map((item) => item.id));
    const criterionIds = new Set(config.criteria.map((item) => item.id));
    config.criteria.forEach((criterion, index) => {
      if (!sectionIds.has(criterion.sectionId))
        ctx.addIssue({
          code: "custom",
          path: ["criteria", index, "sectionId"],
          message: "Unbekannter Kriterienbereich.",
        });
    });
    config.chat.sections.forEach((section, index) => {
      if (
        !config.criteria.some((criterion) => criterion.sectionId === section.id)
      )
        ctx.addIssue({
          code: "custom",
          path: ["chat", "sections", index],
          message: "Jeder Bereich benötigt mindestens ein Kriterium.",
        });
    });
    for (const [name, id] of Object.entries(
      config.scoring.financialCriterionIds,
    )) {
      if (!criterionIds.has(id))
        ctx.addIssue({
          code: "custom",
          path: ["scoring", "financialCriterionIds", name],
          message: "Unbekannte Kriterien-ID.",
        });
    }
    const financialNames = config.scoring.financialCriterionIds;
    for (const id of [
      financialNames.annualSavings,
      financialNames.oneTimeSavings,
      financialNames.annualOperatingCosts,
      financialNames.oneTimeCosts,
    ]) {
      if (
        config.criteria.find((item) => item.id === id)?.inputType !== "currency"
      )
        ctx.addIssue({
          code: "custom",
          path: ["scoring", "financialCriterionIds"],
          message: "Finanzformeln dürfen nur Währungskriterien verwenden.",
        });
    }
    if (
      config.criteria.find(
        (item) => item.id === financialNames.absoluteNecessity,
      )?.inputType !== "boolean"
    )
      ctx.addIssue({
        code: "custom",
        path: ["scoring", "financialCriterionIds", "absoluteNecessity"],
        message: "Alternativlosigkeit benötigt ein Ja/Nein-Kriterium.",
      });
    for (const [name, id] of Object.entries(config.scoring.sectionIds)) {
      if (!sectionIds.has(id))
        ctx.addIssue({
          code: "custom",
          path: ["scoring", "sectionIds", name],
          message: "Unbekannte Bereichs-ID.",
        });
    }
    const weights =
      config.scoring.profitabilityWeight + config.scoring.strategicWeight;
    if (Math.abs(weights - 1) > 0.000001)
      ctx.addIssue({
        code: "custom",
        path: ["scoring"],
        message: "Die Basisgewichtung muss zusammen 1 ergeben.",
      });
    if (config.scoring.configuredMaximum <= config.scoring.configuredMinimum)
      ctx.addIssue({
        code: "custom",
        path: ["scoring", "configuredMaximum"],
        message: "Der konfigurierte Höchstwert muss größer sein.",
      });
    const strictlyAscending = (values: readonly number[]) =>
      values.every((value, index) => index === 0 || value > values[index - 1]!);
    const strictlyDescending = (values: readonly number[]) =>
      values.every((value, index) => index === 0 || value < values[index - 1]!);
    if (!strictlyAscending(config.scoring.paybackMonthThresholds))
      ctx.addIssue({
        code: "custom",
        path: ["scoring", "paybackMonthThresholds"],
        message: "Amortisationsgrenzen müssen aufsteigend sortiert sein.",
      });
    if (
      !strictlyDescending(config.scoring.yearOneNetReturnThresholds) ||
      !strictlyDescending(config.scoring.roiThresholds)
    )
      ctx.addIssue({
        code: "custom",
        path: ["scoring"],
        message: "Ertrags- und ROI-Grenzen müssen absteigend sortiert sein.",
      });
  });

export const coverSchema = z.object({
  department: z.string().trim().min(1).max(120),
  participantName: z.string().trim().min(1).max(200),
  participantEmail: z.string().trim().email().max(320),
  processName: z.string().trim().min(1).max(240),
  currentProcessDescription: z
    .string()
    .trim()
    .max(12_000)
    .nullable()
    .default(null),
});
export const gatewayResponseKindSchema = z.enum([
  "description",
  "unknown",
  "not_applicable",
]);
export const gatewaySubmissionAnswerSchema = z.object({
  questionId: idSchema,
  response: z.string().trim().min(1).max(8_000),
  responseKind: gatewayResponseKindSchema,
});
const legacyGatewayUserAnswerSchema = z
  .object({
    questionId: idSchema,
    answer: z.enum(["yes", "no", "unsure"]),
    context: z.string().trim().max(4_000).default(""),
  })
  .transform((answer) => ({
    questionId: answer.questionId,
    response:
      answer.context ||
      (answer.answer === "yes"
        ? "Ja"
        : answer.answer === "no"
          ? "Nein"
          : "Weiß ich nicht"),
    responseKind:
      answer.answer === "unsure"
        ? ("unknown" as const)
        : ("description" as const),
  }));
export const gatewayUserAnswerSchema = z.union([
  gatewaySubmissionAnswerSchema,
  legacyGatewayUserAnswerSchema,
]);
export const gatewayDecisionSchema = z.object({
  questionId: idSchema,
  decision: z.enum(["yes", "no", "unclear"]),
  confidence: z.number().min(0).max(100),
  rationale: z.string().trim().min(1).max(4_000),
  evidence: z.array(z.string().max(1_000)).max(30).default([]),
  assumptions: z.array(z.string().max(1_000)).max(30).default([]),
});
export const aiOperationMetadataSchema = z.object({
  operationId: z.string().uuid(),
  model: z.string().min(1),
  sessionId: z.string().nullable().default(null),
  durationMs: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative().nullable().default(null),
  outputTokens: z.number().int().nonnegative().nullable().default(null),
});
export const gatewayElicitationQuestionSchema = z.object({
  questionId: idSchema,
  question: z.string().trim().min(1).max(4_000),
  recognitionAids: z
    .array(z.string().trim().min(1).max(500))
    .max(6)
    .default([]),
});
export const gatewayElicitationSchema = z.object({
  assistantMessage: z.string().trim().min(1).max(4_000),
  questions: z.array(gatewayElicitationQuestionSchema).length(4),
  operation: aiOperationMetadataSchema,
});
export const gatewayAssessmentSchema = z.object({
  userAnswers: z.array(gatewayUserAnswerSchema).max(4).default([]),
  selectedUploadIds: z.array(z.string().uuid()).max(30).default([]),
  elicitation: gatewayElicitationSchema.nullable().default(null),
  decisions: z.array(gatewayDecisionSchema).max(4).default([]),
  followUpQuestion: z
    .string()
    .trim()
    .min(1)
    .max(4_000)
    .nullable()
    .default(null),
  followUpAnswer: z.string().trim().max(8_000).nullable().default(null),
  followUpsUsed: z.number().int().min(0).max(1).default(0),
  final: z.boolean().default(false),
  hasClearAiSignal: z.boolean().nullable().default(null),
  operation: aiOperationMetadataSchema.nullable().default(null),
});

export const criterionValueSchema = z
  .object({
    criterionId: idSchema,
    value: z.union([z.number().finite(), z.boolean()]).nullable(),
    source: criterionSourceSchema,
    confirmation: criterionConfirmationSchema,
    rationale: z.string().max(4_000).default(""),
    evidence: z.array(z.string().max(1_000)).max(50).default([]),
    assumptions: z.array(z.string().max(1_000)).max(30).default([]),
    confidence: z.number().min(0).max(100).nullable(),
    updatedBy: actorSchema.nullable(),
    updatedAt: isoDateSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    if (
      value.value === null &&
      (value.source !== "none" || value.confirmation !== "empty")
    )
      ctx.addIssue({
        code: "custom",
        message: "Leere Werte müssen als leer gekennzeichnet sein.",
      });
    if (value.value !== null && value.source === "none")
      ctx.addIssue({
        code: "custom",
        message: "Ein Wert benötigt eine Quelle.",
      });
  });

export const scoreComponentSchema = z.object({
  value: z.number().nullable(),
  points: z.number(),
  inputs: z.record(z.string(), z.number()),
  thresholds: z.array(z.number()).default([]),
});
export const calculatedResultsSchema = z.object({
  annualNetBenefit: z.number(),
  initialNetCost: z.number(),
  paybackMonths: z.number().nullable(),
  yearOneNetReturn: z.number(),
  roi: z.number().nullable(),
  profitabilityPercent: z.number(),
  strategicRelevancePercent: z.number(),
  implementationFactorPercent: z.number(),
  technicalAttractivenessPercent: z.number(),
  alternativlosigkeitPoints: z.number(),
  baseValue: z.number(),
  overallScore: z.number(),
  components: z.object({
    payback: scoreComponentSchema,
    yearOneNetReturn: scoreComponentSchema,
    roi: scoreComponentSchema,
    strategic: scoreComponentSchema,
    implementation: scoreComponentSchema,
    technical: scoreComponentSchema,
    absoluteNecessity: scoreComponentSchema,
  }),
});
export const reviewFindingSchema = z.object({
  id: z.string().min(1).max(100),
  severity: z.enum(["info", "warning", "blocking"]),
  criterionIds: z.array(idSchema).max(28).default([]),
  evidence: z.array(z.string().max(1_000)).max(30).default([]),
  explanation: z.string().trim().min(1).max(4_000),
  proposedCorrection: z
    .object({
      criterionId: idSchema,
      value: z.union([z.number(), z.boolean()]),
    })
    .nullable()
    .default(null),
  acknowledgedAt: isoDateSchema.nullable().default(null),
});
export const reviewRecordSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["current", "stale"]),
  reviewedCriteriaUpdatedAt: isoDateSchema,
  deterministicWarnings: z.array(reviewFindingSchema).default([]),
  findings: z.array(reviewFindingSchema).default([]),
  chatMessagesUsed: z.number().int().nonnegative().max(3).default(0),
  operation: aiOperationMetadataSchema,
  createdAt: isoDateSchema,
});
export const uploadRecordSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(160),
  mediaType: z.string().min(1).max(200),
  size: z
    .number()
    .int()
    .nonnegative()
    .max(20 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: isoDateSchema,
});
export const assessmentMetricsSchema = z.object({
  aiPopulatedBeforeHuman: z.number().int().nonnegative().default(0),
  humanOverrideCount: z.number().int().nonnegative().default(0),
  mainChatTurns: z.number().int().nonnegative().default(0),
  followUpChatTurns: z.number().int().nonnegative().default(0),
  aiProcessingMs: z.number().int().nonnegative().default(0),
  userElapsedMs: z.number().int().nonnegative().default(0),
  inputTokens: z.number().int().nonnegative().nullable().default(null),
  outputTokens: z.number().int().nonnegative().nullable().default(null),
  facilitatorRatings: z
    .object({
      completeness: z.number().int().min(1).max(5),
      plausibility: z.number().int().min(1).max(5),
      traceability: z.number().int().min(1).max(5),
      userEffort: z.number().int().min(1).max(5),
    })
    .nullable()
    .default(null),
});
export const assessmentRecordSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^ASSESS-\d{4}$/),
  comparisonGroupId: z.string().uuid().nullable(),
  mode: interactionModeSchema,
  state: assessmentStateSchema,
  cover: coverSchema,
  configSnapshot: assessmentConfigSchema,
  configHash: z.string().regex(/^[a-f0-9]{64}$/),
  gateway: gatewayAssessmentSchema,
  criteria: z.array(criterionValueSchema).length(28),
  calculatedResults: calculatedResultsSchema.nullable(),
  review: reviewRecordSchema.nullable(),
  uploads: z.array(uploadRecordSchema),
  metrics: assessmentMetricsSchema,
  confirmedAt: isoDateSchema.nullable().default(null),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export type InteractionMode = z.infer<typeof interactionModeSchema>;
export type AssessmentState = z.infer<typeof assessmentStateSchema>;
export type AssessmentConfig = z.infer<typeof assessmentConfigSchema>;
export type GatewayUserAnswer = z.infer<typeof gatewayUserAnswerSchema>;
export type GatewayDecision = z.infer<typeof gatewayDecisionSchema>;
export type GatewayAssessment = z.infer<typeof gatewayAssessmentSchema>;
export type GatewayElicitation = z.infer<typeof gatewayElicitationSchema>;
export type CriterionValue = z.infer<typeof criterionValueSchema>;
export type CalculatedResults = z.infer<typeof calculatedResultsSchema>;
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type ReviewRecord = z.infer<typeof reviewRecordSchema>;
export type AssessmentMetrics = z.infer<typeof assessmentMetricsSchema>;
export type AssessmentRecord = z.infer<typeof assessmentRecordSchema>;
export type AiOperationMetadata = z.infer<typeof aiOperationMetadataSchema>;

export function gatewayResponseKindFor(
  response: string,
  fallback: z.infer<typeof gatewayResponseKindSchema> = "description",
) {
  const normalized = response.trim().toLocaleLowerCase("de-DE");
  if (
    ["weiß ich nicht", "weiss ich nicht", "nicht bekannt"].includes(normalized)
  )
    return "unknown" as const;
  if (
    [
      "trifft nicht zu",
      "trifft in diesem prozess nicht zu",
      "in diesem prozess nicht relevant",
    ].includes(normalized)
  )
    return "not_applicable" as const;
  return fallback;
}

export function gatewayEvaluationQuestion(
  question: AssessmentConfig["gateway"]["questions"][number],
) {
  return question.evaluationQuestion ?? question.description ?? "";
}

export function gatewayUserQuestion(
  question: AssessmentConfig["gateway"]["questions"][number],
) {
  return question.userQuestion ?? question.description ?? "";
}

export function gatewayHelpText(
  question: AssessmentConfig["gateway"]["questions"][number],
) {
  return question.helpText ?? question.description ?? "";
}

export function emptyCriterionValues(
  config: AssessmentConfig,
): CriterionValue[] {
  return [...config.criteria]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((criterion) => ({
      criterionId: criterion.id,
      value: null,
      source: "none" as const,
      confirmation: "empty" as const,
      rationale: "",
      evidence: [],
      assumptions: [],
      confidence: null,
      updatedBy: null,
      updatedAt: null,
    }));
}

export function validateCriterionValue(
  config: AssessmentConfig,
  criterionId: string,
  value: number | boolean,
) {
  const criterion = config.criteria.find((item) => item.id === criterionId);
  if (!criterion) throw new Error("Unbekanntes Kriterium.");
  const numeric = typeof value === "boolean" ? Number(value) : value;
  if (
    criterion.inputType === "boolean" &&
    typeof value !== "boolean" &&
    value !== 0 &&
    value !== 1
  )
    throw new Error("Dieses Kriterium erwartet Ja oder Nein.");
  if (criterion.inputType !== "boolean" && typeof value === "boolean")
    throw new Error("Dieses Kriterium erwartet eine Zahl.");
  if (criterion.inputType === "integer" && !Number.isInteger(numeric))
    throw new Error("Dieses Kriterium erwartet eine ganze Zahl.");
  if (numeric < criterion.minimum || numeric > criterion.maximum)
    throw new Error(
      `Der Wert muss zwischen ${criterion.minimum} und ${criterion.maximum} liegen.`,
    );
}
