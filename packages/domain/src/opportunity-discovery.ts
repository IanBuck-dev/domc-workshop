import { z } from "zod";

export const opportunityScenarioContractVersion = 1 as const;

export const scenarioLevels = ["assistive", "delegated", "agentic"] as const;
export const scenarioLevelSchema = z.enum(scenarioLevels);

export const executionModes = [
  "autonomous",
  "approval_required",
  "human_only",
] as const;
export const executionModeSchema = z.enum(executionModes);

export const systemAccessModes = ["read", "write", "observe", "act"] as const;
export const systemAccessModeSchema = z.enum(systemAccessModes);

export const accessTimings = ["manual", "on_demand", "event_driven"] as const;
export const accessTimingSchema = z.enum(accessTimings);

export const accessMechanisms = [
  "manual",
  "file_exchange",
  "api",
  "connector",
  "mcp",
  "ui_automation",
  "unknown",
] as const;
export const accessMechanismSchema = z.enum(accessMechanisms);

export const aiCapabilities = [
  "interpretation",
  "generation",
  "recognition",
  "prediction",
  "recommendation",
  "planning",
] as const;
export const aiCapabilitySchema = z.enum(aiCapabilities);

export const confidenceLevels = ["high", "medium", "low"] as const;
export const confidenceLevelSchema = z.enum(confidenceLevels);

const identifierSchema = z.string().trim().min(1).max(120);
const hypothesisIdSchema = z.string().regex(/^HYP-\d{3}$/);
const scenarioIdSchema = z
  .string()
  .regex(/^SCN-(assistive|delegated|agentic)$/);
const shortTextSchema = z.string().trim().min(1).max(500);
const textSchema = z.string().trim().min(1).max(4_000);

function uniqueTextArray(minimum: number, maximum: number) {
  return z
    .array(z.string().trim().min(1).max(2_000))
    .min(minimum)
    .max(maximum)
    .refine((values) => new Set(values).size === values.length, {
      message: "Values must be unique.",
    });
}

const identifierArraySchema = (minimum = 0, maximum = 100) =>
  z
    .array(identifierSchema)
    .min(minimum)
    .max(maximum)
    .refine((values) => new Set(values).size === values.length, {
      message: "Identifiers must be unique.",
    });

export const scenarioActionSchema = z
  .object({
    name: shortTextSchema,
    description: textSchema,
    processStepIds: identifierArraySchema(1, 8),
    executionMode: executionModeSchema,
    controls: uniqueTextArray(0, 30),
    escalationTriggers: uniqueTextArray(0, 30),
  })
  .strict();

export const scenarioSystemAccessSchema = z
  .object({
    target: shortTextSchema,
    accessModes: z
      .array(systemAccessModeSchema)
      .min(1)
      .max(systemAccessModes.length)
      .refine((values) => new Set(values).size === values.length, {
        message: "Access modes must be unique.",
      }),
    timing: accessTimingSchema,
    possibleMechanisms: z
      .array(accessMechanismSchema)
      .min(1)
      .max(accessMechanisms.length)
      .superRefine((values, ctx) => {
        if (new Set(values).size !== values.length)
          ctx.addIssue({
            code: "custom",
            message: "Access mechanisms must be unique.",
          });
        if (values.length > 1 && values.includes("unknown"))
          ctx.addIssue({
            code: "custom",
            message: "Unknown cannot be combined with a known mechanism.",
          });
      }),
    assumptions: uniqueTextArray(0, 30),
  })
  .strict();

const excludedHypothesisSchema = z
  .object({
    hypothesisId: hypothesisIdSchema,
    rationale: textSchema,
  })
  .strict();

export const opportunityScenarioSchema = z
  .object({
    id: scenarioIdSchema,
    provenance: z.literal("ai_inferred"),
    level: scenarioLevelSchema,
    title: shortTextSchema,
    summary: textSchema,
    targetState: textSchema,
    includedHypothesisIds: z
      .array(hypothesisIdSchema)
      .min(1)
      .max(100)
      .refine((values) => new Set(values).size === values.length, {
        message: "Included hypothesis IDs must be unique.",
      }),
    excludedHypotheses: z.array(excludedHypothesisSchema).max(100),
    affectedProcessStepIds: identifierArraySchema(1, 8),
    changesFromToday: uniqueTextArray(1, 50),
    aiResponsibilities: uniqueTextArray(1, 50),
    aiCapabilities: z
      .array(aiCapabilitySchema)
      .min(1)
      .max(aiCapabilities.length)
      .refine((values) => new Set(values).size === values.length, {
        message: "AI capabilities must be unique.",
      }),
    deterministicAutomation: uniqueTextArray(0, 50),
    orchestration: uniqueTextArray(0, 50),
    humanResponsibilities: uniqueTextArray(1, 50),
    actions: z.array(scenarioActionSchema).min(1).max(100),
    humanOversight: uniqueTextArray(1, 50),
    informationAndDocuments: uniqueTextArray(0, 100),
    systemAccess: z.array(scenarioSystemAccessSchema).max(50),
    prerequisites: uniqueTextArray(0, 50),
    risksAndFailureModes: uniqueTextArray(0, 50),
    assumptions: uniqueTextArray(0, 50),
    openQuestions: uniqueTextArray(0, 50),
    evidenceIds: identifierArraySchema(1, 250),
    confidenceLevel: confidenceLevelSchema,
    confidenceRationale: textSchema,
  })
  .strict()
  .superRefine((scenario, ctx) => {
    if (scenario.id !== `SCN-${scenario.level}`)
      ctx.addIssue({
        code: "custom",
        path: ["id"],
        message: "Scenario ID must match its level.",
      });

    const excludedIds = scenario.excludedHypotheses.map(
      (item) => item.hypothesisId,
    );
    if (new Set(excludedIds).size !== excludedIds.length)
      ctx.addIssue({
        code: "custom",
        path: ["excludedHypotheses"],
        message: "Excluded hypothesis IDs must be unique.",
      });
    if (scenario.includedHypothesisIds.some((id) => excludedIds.includes(id)))
      ctx.addIssue({
        code: "custom",
        path: ["excludedHypotheses"],
        message: "A hypothesis cannot be included and excluded.",
      });

    const autonomousActions = scenario.actions.filter(
      (action) => action.executionMode === "autonomous",
    );
    const controlledActions = scenario.actions.filter(
      (action) => action.executionMode !== "autonomous",
    );
    if (scenario.level === "assistive" && autonomousActions.length)
      ctx.addIssue({
        code: "custom",
        path: ["actions"],
        message: "An assistive scenario cannot contain autonomous actions.",
      });
    if (
      scenario.level === "delegated" &&
      (!autonomousActions.length || !controlledActions.length)
    )
      ctx.addIssue({
        code: "custom",
        path: ["actions"],
        message:
          "A delegated scenario requires autonomous and human-controlled actions.",
      });
    if (scenario.level === "agentic") {
      if (!autonomousActions.length || !controlledActions.length)
        ctx.addIssue({
          code: "custom",
          path: ["actions"],
          message:
            "An agentic scenario requires autonomous and human-controlled actions.",
        });
      if (
        !controlledActions.some((action) =>
          Boolean(action.escalationTriggers.length),
        )
      )
        ctx.addIssue({
          code: "custom",
          path: ["actions"],
          message:
            "An agentic scenario requires an explicit escalation trigger for a human-controlled action.",
        });
    }
  });

export const opportunityScenarioResultSchema = z
  .object({
    schemaVersion: z.literal(opportunityScenarioContractVersion),
    scenarios: z.array(opportunityScenarioSchema).length(3),
  })
  .strict()
  .superRefine((result, ctx) => {
    result.scenarios.forEach((scenario, index) => {
      if (scenario.level !== scenarioLevels[index])
        ctx.addIssue({
          code: "custom",
          path: ["scenarios", index, "level"],
          message: "Scenarios must be ordered assistive, delegated, agentic.",
        });
    });
  });

export const opportunityScenarioReferenceContextSchema = z
  .object({
    highConfidenceHypotheses: z
      .array(
        z
          .object({
            id: hypothesisIdSchema,
            processStepId: identifierSchema,
          })
          .strict(),
      )
      .min(1)
      .max(100),
    processStepIds: identifierArraySchema(1, 8),
    evidenceIds: identifierArraySchema(1, 250),
  })
  .strict()
  .superRefine((context, ctx) => {
    const hypothesisIds = context.highConfidenceHypotheses.map(
      (hypothesis) => hypothesis.id,
    );
    if (new Set(hypothesisIds).size !== hypothesisIds.length)
      ctx.addIssue({
        code: "custom",
        path: ["highConfidenceHypotheses"],
        message: "High-confidence hypothesis IDs must be unique.",
      });
    const stepIds = new Set(context.processStepIds);
    context.highConfidenceHypotheses.forEach((hypothesis, index) => {
      if (!stepIds.has(hypothesis.processStepId))
        ctx.addIssue({
          code: "custom",
          path: ["highConfidenceHypotheses", index, "processStepId"],
          message: "Hypothesis references an unknown process step.",
        });
    });
  });

export function assertOpportunityScenarioReferences(
  resultInput: unknown,
  contextInput: unknown,
) {
  const result = opportunityScenarioResultSchema.parse(resultInput);
  const context = opportunityScenarioReferenceContextSchema.parse(contextInput);
  const hypotheses = new Map(
    context.highConfidenceHypotheses.map((hypothesis) => [
      hypothesis.id,
      hypothesis,
    ]),
  );
  const expectedHypothesisIds = [...hypotheses.keys()].sort();
  const processStepIds = new Set(context.processStepIds);
  const evidenceIds = new Set(context.evidenceIds);

  for (const scenario of result.scenarios) {
    const referencedHypothesisIds = [
      ...scenario.includedHypothesisIds,
      ...scenario.excludedHypotheses.map((item) => item.hypothesisId),
    ].sort();
    if (
      JSON.stringify(referencedHypothesisIds) !==
      JSON.stringify(expectedHypothesisIds)
    )
      throw new Error(
        `Scenario ${scenario.id} must include or exclude every high-confidence hypothesis exactly once.`,
      );

    if (scenario.affectedProcessStepIds.some((id) => !processStepIds.has(id)))
      throw new Error(
        `Scenario ${scenario.id} references an unknown process step.`,
      );

    const affectedStepIds = new Set(scenario.affectedProcessStepIds);
    for (const hypothesisId of scenario.includedHypothesisIds) {
      const hypothesis = hypotheses.get(hypothesisId);
      if (!hypothesis || !affectedStepIds.has(hypothesis.processStepId))
        throw new Error(
          `Scenario ${scenario.id} must include the process step of each included hypothesis.`,
        );
    }

    for (const action of scenario.actions) {
      if (action.processStepIds.some((id) => !processStepIds.has(id)))
        throw new Error(
          `Scenario ${scenario.id} action references an unknown process step.`,
        );
      if (action.processStepIds.some((id) => !affectedStepIds.has(id)))
        throw new Error(
          `Scenario ${scenario.id} action references a step outside the scenario scope.`,
        );
    }

    if (scenario.evidenceIds.some((id) => !evidenceIds.has(id)))
      throw new Error(`Scenario ${scenario.id} references unknown evidence.`);
  }

  return result;
}

export type ScenarioLevel = z.infer<typeof scenarioLevelSchema>;
export type ExecutionMode = z.infer<typeof executionModeSchema>;
export type SystemAccessMode = z.infer<typeof systemAccessModeSchema>;
export type AccessTiming = z.infer<typeof accessTimingSchema>;
export type AccessMechanism = z.infer<typeof accessMechanismSchema>;
export type AiCapability = z.infer<typeof aiCapabilitySchema>;
export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;
export type ScenarioAction = z.infer<typeof scenarioActionSchema>;
export type ScenarioSystemAccess = z.infer<typeof scenarioSystemAccessSchema>;
export type OpportunityScenario = z.infer<typeof opportunityScenarioSchema>;
export type OpportunityScenarioResult = z.infer<
  typeof opportunityScenarioResultSchema
>;
export type OpportunityScenarioReferenceContext = z.infer<
  typeof opportunityScenarioReferenceContextSchema
>;
