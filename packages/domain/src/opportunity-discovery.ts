import { z } from "zod";
import {
  processCaptureRecordSchema,
  processUnderstandingStorageSchema,
  processUnderstandingSchema,
  workCharacteristicIdSchema,
} from "./process-understanding.ts";

export const opportunityScenarioContractVersion = 1 as const;

export interface OpportunityContractSnapshot {
  basePrompt: string;
  hypothesesPrompt: string;
  scenariosPrompt: string;
  hypothesesSchema: object;
  scenariosSchema: object;
}

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
export const potentialLevels = ["high", "medium", "low"] as const;
export const potentialLevelSchema = z.enum(potentialLevels);

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

const aiRuntimeConfigSchema = z
  .object({
    model: z.enum(["sonnet", "opus", "claude-opus-4-8"]),
    reasoningEffort: z.enum(["medium", "high"]),
    timeoutMs: z.number().int().min(10_000).max(300_000),
    maxOutputTokens: z.number().int().min(512).max(32_768),
    maxInputCharacters: z.number().int().min(10_000).max(2_000_000),
    maxBudgetUsd: z.number().positive().max(10),
  })
  .strict();

export const opportunityDiscoveryConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    profile: z
      .object({
        id: z.literal("opportunity-discovery-v1"),
        version: z.literal(1),
      })
      .strict(),
    instructions: z
      .object({
        hypotheses: z.string().trim().min(1).max(30_000),
        scenarios: z.string().trim().min(1).max(30_000),
      })
      .strict(),
    ai: aiRuntimeConfigSchema,
  })
  .strict();

const workCharacteristicSnapshotSchema = z
  .object({
    id: workCharacteristicIdSchema,
    question: shortTextSchema,
    selectedOptions: z
      .array(
        z.object({ id: identifierSchema, label: shortTextSchema }).strict(),
      )
      .min(0)
      .max(12),
  })
  .strict();

export const opportunityProcessSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    processId: z.string().regex(/^PROC-\d{4}$/),
    processName: shortTextSchema,
    department: shortTextSchema,
    confirmedAt: z.string().datetime(),
    confirmationQuality: z.enum(["complete", "with_gaps"]).nullable(),
    workCharacteristics: z.array(workCharacteristicSnapshotSchema).max(4),
    understanding: processUnderstandingSchema,
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    const ids = snapshot.workCharacteristics.map((item) => item.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        path: ["workCharacteristics"],
        message: "Work-characteristic IDs must be unique.",
      });
  });

export const opportunityProcessSnapshotStorageSchema = z.preprocess((input) => {
  if (!input || typeof input !== "object") return input;
  const value = structuredClone(input) as Record<string, unknown>;
  if (!("confirmationQuality" in value)) value.confirmationQuality = null;
  if ("understanding" in value)
    value.understanding = processUnderstandingStorageSchema.parse(
      value.understanding,
    );
  return value;
}, opportunityProcessSnapshotSchema);

export function createOpportunityProcessSnapshot(input: unknown) {
  const record = processCaptureRecordSchema.parse(input);
  if (
    record.state !== "confirmed" ||
    !record.confirmedAt ||
    !record.understanding
  )
    throw new Error(
      "Nur ein fachlich bestätigter Prozess kann analysiert werden.",
    );
  if (
    record.profile.version === 1 ||
    !("workCharacteristics" in record.configSnapshot)
  )
    throw new Error(
      "Die Potenzialanalyse benötigt die aktuellen Arbeitsmerkmale.",
    );
  const answers = new Map(
    record.workCharacteristicAnswers.map((answer) => [
      answer.characteristicId,
      answer,
    ]),
  );
  return opportunityProcessSnapshotSchema.parse({
    schemaVersion: 1,
    processId: record.id,
    processName: record.cover.processName,
    department: record.cover.department,
    confirmedAt: record.confirmedAt,
    confirmationQuality: record.confirmationQuality,
    workCharacteristics:
      record.interactionMode === "chat"
        ? []
        : record.configSnapshot.workCharacteristics.map((definition) => ({
            id: definition.id,
            question: definition.question,
            selectedOptions: (
              answers.get(definition.id)?.selectedOptionIds ?? []
            ).map((optionId) => ({
              id: optionId,
              label:
                definition.options.find((option) => option.id === optionId)
                  ?.label ?? optionId,
            })),
          })),
    understanding: record.understanding,
  });
}

export const opportunityAssumptionSchema = z
  .object({ text: textSchema, material: z.boolean() })
  .strict();

const opportunityHypothesisBase = {
  processStepId: identifierSchema,
  title: shortTextSchema,
  currentSituation: textSchema,
  aiContribution: textSchema,
  aiCapabilities: z
    .array(aiCapabilitySchema)
    .min(1)
    .max(aiCapabilities.length)
    .refine((values) => new Set(values).size === values.length),
  expectedChange: textSchema,
  supportingDeterministicAutomation: uniqueTextArray(0, 50),
  requiredInformationAndSystemAccess: uniqueTextArray(0, 50),
  expectedHumanRole: textSchema,
  potentialLevel: potentialLevelSchema,
  potentialRationale: textSchema,
  confidenceLevel: confidenceLevelSchema,
  confidenceRationale: textSchema,
  evidenceIds: identifierArraySchema(0, 250),
  assumptions: z.array(opportunityAssumptionSchema).max(50),
  openQuestions: uniqueTextArray(0, 50),
};

export const opportunityHypothesisSchema = z
  .object({
    id: hypothesisIdSchema,
    provenance: z.literal("ai_inferred"),
    ...opportunityHypothesisBase,
  })
  .strict()
  .superRefine((hypothesis, ctx) => {
    if (
      hypothesis.confidenceLevel === "high" &&
      (!hypothesis.evidenceIds.length ||
        hypothesis.assumptions.some((assumption) => assumption.material))
    )
      ctx.addIssue({
        code: "custom",
        path: ["confidenceLevel"],
        message:
          "High confidence requires evidence and no material assumption.",
      });
  });

const opportunityHypothesisAiSchema = z
  .object(opportunityHypothesisBase)
  .strict();

const stepOpportunityAiSchema = z
  .object({
    processStepId: identifierSchema,
    summary: textSchema,
    noPotentialRationale: textSchema.nullable(),
    hypotheses: z.array(opportunityHypothesisAiSchema).max(20),
  })
  .strict()
  .superRefine((analysis, ctx) => {
    if (!analysis.hypotheses.length && !analysis.noPotentialRationale)
      ctx.addIssue({
        code: "custom",
        path: ["noPotentialRationale"],
        message: "A step without hypotheses requires a rationale.",
      });
    if (analysis.hypotheses.length && analysis.noPotentialRationale !== null)
      ctx.addIssue({
        code: "custom",
        path: ["noPotentialRationale"],
        message: "A step with hypotheses cannot have a no-potential rationale.",
      });
    analysis.hypotheses.forEach((hypothesis, index) => {
      if (hypothesis.processStepId !== analysis.processStepId)
        ctx.addIssue({
          code: "custom",
          path: ["hypotheses", index, "processStepId"],
          message: "Hypothesis and step analysis must reference the same step.",
        });
    });
  });

export const opportunityHypothesisAiResultSchema = z
  .object({ stepAnalyses: z.array(stepOpportunityAiSchema).min(1).max(8) })
  .strict();

export const stepOpportunityAnalysisSchema = z
  .object({
    processStepId: identifierSchema,
    summary: textSchema,
    noPotentialRationale: textSchema.nullable(),
    hypotheses: z.array(opportunityHypothesisSchema).max(20),
  })
  .strict();

export const opportunityHypothesisResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    stepAnalyses: z.array(stepOpportunityAnalysisSchema).min(1).max(8),
  })
  .strict();

const rank = { high: 0, medium: 1, low: 2 } as const;
export function normalizeOpportunityHypotheses(
  input: unknown,
  snapshotInput: unknown,
) {
  const output = opportunityHypothesisAiResultSchema.parse(input);
  const snapshot = opportunityProcessSnapshotSchema.parse(snapshotInput);
  const stepOrder = new Map(
    snapshot.understanding.steps.map((step) => [step.id, step.order]),
  );
  const expected = [...stepOrder.keys()].sort();
  const actual = output.stepAnalyses.map((item) => item.processStepId).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual))
    throw new Error(
      "Die Hypothesenanalyse muss jeden Prozessschritt genau einmal enthalten.",
    );
  const evidenceIds = new Set(
    snapshot.understanding.evidence.map((item) => item.id),
  );
  const analyses = output.stepAnalyses
    .map((analysis) => ({ ...analysis, hypotheses: [...analysis.hypotheses] }))
    .sort(
      (a, b) =>
        (stepOrder.get(a.processStepId) ?? 99) -
        (stepOrder.get(b.processStepId) ?? 99),
    );
  let sequence = 0;
  const normalized = analyses.map((analysis) => ({
    ...analysis,
    hypotheses: analysis.hypotheses
      .sort(
        (a, b) =>
          rank[a.potentialLevel] - rank[b.potentialLevel] ||
          rank[a.confidenceLevel] - rank[b.confidenceLevel] ||
          a.title.localeCompare(b.title, "de"),
      )
      .map((hypothesis) => {
        if (hypothesis.evidenceIds.some((id) => !evidenceIds.has(id)))
          throw new Error("Eine Hypothese verweist auf unbekannte Evidenz.");
        return opportunityHypothesisSchema.parse({
          ...hypothesis,
          id: `HYP-${String(++sequence).padStart(3, "0")}`,
          provenance: "ai_inferred",
        });
      }),
  }));
  return opportunityHypothesisResultSchema.parse({
    schemaVersion: 1,
    stepAnalyses: normalized,
  });
}

export const scenarioEvidenceBases = ["high", "medium_fallback"] as const;
export const scenarioEvidenceBasisSchema = z.enum(scenarioEvidenceBases);

export function selectScenarioHypotheses(input: unknown) {
  const result = opportunityHypothesisResultSchema.parse(input);
  const hypotheses = result.stepAnalyses.flatMap((analysis, stepIndex) =>
    analysis.hypotheses.map((hypothesis) => ({ hypothesis, stepIndex })),
  );
  const high = hypotheses
    .filter(({ hypothesis }) => hypothesis.confidenceLevel === "high")
    .map(({ hypothesis }) => hypothesis);
  if (high.length) return { basis: "high" as const, hypotheses: high };

  const medium = hypotheses
    .filter(({ hypothesis }) => hypothesis.confidenceLevel === "medium")
    .sort(
      (left, right) =>
        rank[left.hypothesis.potentialLevel] -
          rank[right.hypothesis.potentialLevel] ||
        left.stepIndex - right.stepIndex ||
        left.hypothesis.title.localeCompare(right.hypothesis.title, "de"),
    )
    .slice(0, 3)
    .map(({ hypothesis }) => hypothesis);
  return medium.length >= 2
    ? { basis: "medium_fallback" as const, hypotheses: medium }
    : { basis: null, hypotheses: [] };
}

export const opportunityDiscoveryStates = [
  "hypotheses_queued",
  "hypotheses_running",
  "hypotheses_failed",
  "no_supported_hypotheses",
  "scenarios_running",
  "scenarios_failed",
  "completed",
] as const;
export const opportunityDiscoveryStateSchema = z.enum(
  opportunityDiscoveryStates,
);

const opportunityDiscoveryTransitions = new Set([
  "hypotheses_queued:hypotheses_running",
  "hypotheses_running:no_supported_hypotheses",
  "hypotheses_running:scenarios_running",
  "hypotheses_running:hypotheses_failed",
  "hypotheses_failed:hypotheses_queued",
  "scenarios_running:completed",
  "scenarios_running:scenarios_failed",
  "scenarios_failed:scenarios_running",
]);

export function assertOpportunityDiscoveryTransition(
  fromInput: unknown,
  toInput: unknown,
) {
  const from = opportunityDiscoveryStateSchema.parse(fromInput);
  const to = opportunityDiscoveryStateSchema.parse(toInput);
  if (!opportunityDiscoveryTransitions.has(`${from}:${to}`))
    throw new Error(
      `Ungültiger Zustandswechsel der Potenzialanalyse: ${from} → ${to}.`,
    );
  return to;
}

export const opportunityPhaseErrorSchema = z
  .object({
    phase: z.enum(["hypotheses", "scenarios"]),
    message: shortTextSchema,
    cancelled: z.boolean(),
    at: z.string().datetime(),
  })
  .strict();

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

function normalizeKnownKeyCasing(
  input: Record<string, unknown>,
  canonicalKeys: readonly string[],
) {
  for (const suppliedKey of Object.keys(input)) {
    if (canonicalKeys.includes(suppliedKey)) continue;
    const matchingKeys = canonicalKeys.filter(
      (canonicalKey) =>
        canonicalKey.toLowerCase() === suppliedKey.toLowerCase(),
    );
    if (matchingKeys.length !== 1) continue;
    const canonicalKey = matchingKeys[0]!;
    if (canonicalKey in input) continue;
    input[canonicalKey] = input[suppliedKey];
    delete input[suppliedKey];
  }
}

const scenarioResultKeys = ["schemaVersion", "scenarios"] as const;
const scenarioKeys = [
  "id",
  "provenance",
  "level",
  "title",
  "summary",
  "targetState",
  "includedHypothesisIds",
  "excludedHypotheses",
  "affectedProcessStepIds",
  "changesFromToday",
  "aiResponsibilities",
  "aiCapabilities",
  "deterministicAutomation",
  "orchestration",
  "humanResponsibilities",
  "actions",
  "humanOversight",
  "informationAndDocuments",
  "systemAccess",
  "prerequisites",
  "risksAndFailureModes",
  "assumptions",
  "openQuestions",
  "evidenceIds",
  "confidenceLevel",
  "confidenceRationale",
] as const;
const excludedHypothesisKeys = ["hypothesisId", "rationale"] as const;
const scenarioActionKeys = [
  "name",
  "description",
  "processStepIds",
  "executionMode",
  "humanDecisionPoint",
  "escalationTriggers",
] as const;
const systemAccessKeys = [
  "systemName",
  "purpose",
  "accessType",
  "possibleMechanisms",
  "assumptions",
] as const;

export const opportunityScenarioAiResultSchema = z.preprocess((input) => {
  const value = structuredClone(input);
  if (!value || typeof value !== "object") return value;
  const resultRecord = value as Record<string, unknown>;
  normalizeKnownKeyCasing(resultRecord, scenarioResultKeys);
  if (!("scenarios" in resultRecord)) return value;
  const scenarios = resultRecord.scenarios;
  if (!Array.isArray(scenarios)) return value;
  for (const scenario of scenarios) {
    if (!scenario || typeof scenario !== "object") continue;
    const scenarioRecord = scenario as Record<string, unknown>;
    normalizeKnownKeyCasing(scenarioRecord, scenarioKeys);
    scenarioRecord.id = `SCN-${String(scenarioRecord.level)}`;
    scenarioRecord.provenance = "ai_inferred";

    const excludedHypotheses = scenarioRecord.excludedHypotheses;
    if (Array.isArray(excludedHypotheses))
      for (const excludedHypothesis of excludedHypotheses)
        if (excludedHypothesis && typeof excludedHypothesis === "object")
          normalizeKnownKeyCasing(
            excludedHypothesis as Record<string, unknown>,
            excludedHypothesisKeys,
          );

    const actions = scenarioRecord.actions;
    if (Array.isArray(actions))
      for (const action of actions)
        if (action && typeof action === "object")
          normalizeKnownKeyCasing(
            action as Record<string, unknown>,
            scenarioActionKeys,
          );

    if (!("systemAccess" in scenarioRecord)) continue;
    const accesses = scenarioRecord.systemAccess;
    if (!Array.isArray(accesses)) continue;
    for (const access of accesses) {
      if (!access || typeof access !== "object") continue;
      const accessRecord = access as Record<string, unknown>;
      normalizeKnownKeyCasing(accessRecord, systemAccessKeys);
      if (!("possibleMechanisms" in accessRecord)) continue;
      const mechanisms = accessRecord.possibleMechanisms;
      if (Array.isArray(mechanisms) && mechanisms.length > 1)
        accessRecord.possibleMechanisms = mechanisms.filter(
          (mechanism) => mechanism !== "unknown",
        );
    }
  }
  return value;
}, opportunityScenarioResultSchema);

export const opportunityScenarioReferenceContextSchema = z
  .object({
    scenarioBasis: scenarioEvidenceBasisSchema,
    scenarioHypotheses: z
      .array(
        z
          .object({
            id: hypothesisIdSchema,
            processStepId: identifierSchema,
            confidenceLevel: confidenceLevelSchema,
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
    const hypothesisIds = context.scenarioHypotheses.map(
      (hypothesis) => hypothesis.id,
    );
    if (new Set(hypothesisIds).size !== hypothesisIds.length)
      ctx.addIssue({
        code: "custom",
        path: ["scenarioHypotheses"],
        message: "Scenario hypothesis IDs must be unique.",
      });
    const expectedConfidence =
      context.scenarioBasis === "high" ? "high" : "medium";
    if (
      context.scenarioHypotheses.some(
        (hypothesis) => hypothesis.confidenceLevel !== expectedConfidence,
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["scenarioHypotheses"],
        message: "Scenario hypotheses must match their evidence basis.",
      });
    if (
      context.scenarioBasis === "medium_fallback" &&
      ![2, 3].includes(context.scenarioHypotheses.length)
    )
      ctx.addIssue({
        code: "custom",
        path: ["scenarioHypotheses"],
        message: "Medium fallback requires two or three hypotheses.",
      });
    const stepIds = new Set(context.processStepIds);
    context.scenarioHypotheses.forEach((hypothesis, index) => {
      if (!stepIds.has(hypothesis.processStepId))
        ctx.addIssue({
          code: "custom",
          path: ["scenarioHypotheses", index, "processStepId"],
          message: "Hypothesis references an unknown process step.",
        });
    });
  });

export function normalizeOpportunityScenarioScope(
  resultInput: unknown,
  contextInput: unknown,
) {
  const result = opportunityScenarioResultSchema.parse(resultInput);
  const context = opportunityScenarioReferenceContextSchema.parse(contextInput);
  const hypothesisSteps = new Map(
    context.scenarioHypotheses.map((hypothesis) => [
      hypothesis.id,
      hypothesis.processStepId,
    ]),
  );
  const stepOrder = new Map(
    context.processStepIds.map((stepId, index) => [stepId, index]),
  );

  return opportunityScenarioResultSchema.parse({
    ...result,
    scenarios: result.scenarios.map((scenario) => {
      const affectedProcessStepIds = new Set(scenario.affectedProcessStepIds);
      for (const hypothesisId of scenario.includedHypothesisIds) {
        const processStepId = hypothesisSteps.get(hypothesisId);
        if (processStepId) affectedProcessStepIds.add(processStepId);
      }
      for (const action of scenario.actions)
        for (const processStepId of action.processStepIds)
          affectedProcessStepIds.add(processStepId);

      return {
        ...scenario,
        affectedProcessStepIds: [...affectedProcessStepIds].sort(
          (left, right) =>
            (stepOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
            (stepOrder.get(right) ?? Number.MAX_SAFE_INTEGER),
        ),
      };
    }),
  });
}

export function assertOpportunityScenarioReferences(
  resultInput: unknown,
  contextInput: unknown,
) {
  const result = opportunityScenarioResultSchema.parse(resultInput);
  const context = opportunityScenarioReferenceContextSchema.parse(contextInput);
  const hypotheses = new Map(
    context.scenarioHypotheses.map((hypothesis) => [hypothesis.id, hypothesis]),
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
        `Scenario ${scenario.id} must include or exclude every selected hypothesis exactly once.`,
      );

    if (
      context.scenarioBasis === "medium_fallback" &&
      scenario.confidenceLevel === "high"
    )
      throw new Error(
        `Scenario ${scenario.id} cannot have high confidence with a medium evidence basis.`,
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

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const opportunityContractManifestSchema = z
  .object({
    basePrompt: sha256Schema,
    hypothesesPrompt: sha256Schema,
    scenariosPrompt: sha256Schema,
    hypothesesSchema: sha256Schema,
    scenariosSchema: sha256Schema,
  })
  .strict();

export const opportunityDiscoveryRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^OPP-PROC-\d{4}$/),
    processId: z.string().regex(/^PROC-\d{4}$/),
    state: opportunityDiscoveryStateSchema,
    sourceProcessHash: sha256Schema,
    configHash: sha256Schema,
    sourceProcess: opportunityProcessSnapshotSchema,
    configSnapshot: opportunityDiscoveryConfigSchema,
    contractManifest: opportunityContractManifestSchema,
    hypotheses: opportunityHypothesisResultSchema.nullable(),
    scenarios: opportunityScenarioResultSchema.nullable(),
    lastError: opportunityPhaseErrorSchema.nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((record, ctx) => {
    if (record.id !== `OPP-${record.processId}`)
      ctx.addIssue({
        code: "custom",
        path: ["id"],
        message: "Opportunity ID must be derived from process ID.",
      });
    const hypothesesRequired = [
      "no_supported_hypotheses",
      "scenarios_running",
      "scenarios_failed",
      "completed",
    ].includes(record.state);
    if (hypothesesRequired && !record.hypotheses)
      ctx.addIssue({
        code: "custom",
        path: ["hypotheses"],
        message: "This state requires hypotheses.",
      });
    if (record.state === "completed" && !record.scenarios)
      ctx.addIssue({
        code: "custom",
        path: ["scenarios"],
        message: "Completed state requires scenarios.",
      });
    if (record.state !== "completed" && record.scenarios)
      ctx.addIssue({
        code: "custom",
        path: ["scenarios"],
        message: "Only completed state may contain scenarios.",
      });
    if (record.state.endsWith("failed") !== (record.lastError !== null))
      ctx.addIssue({
        code: "custom",
        path: ["lastError"],
        message: "Failure state and error detail must agree.",
      });
  });

export const opportunityDiscoverySummarySchema = z
  .object({
    processId: z.string().regex(/^PROC-\d{4}$/),
    state: opportunityDiscoveryStateSchema,
    isStale: z.boolean(),
    hypothesisCount: z.number().int().nonnegative(),
    highConfidenceHypothesisCount: z.number().int().nonnegative(),
    scenarioCount: z.union([z.literal(0), z.literal(3)]),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const opportunityDiscoveryPublicRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^OPP-PROC-\d{4}$/),
    processId: z.string().regex(/^PROC-\d{4}$/),
    state: opportunityDiscoveryStateSchema,
    scenarioBasis: scenarioEvidenceBasisSchema.nullable(),
    sourceProcess: opportunityProcessSnapshotSchema,
    hypotheses: opportunityHypothesisResultSchema.nullable(),
    scenarios: opportunityScenarioResultSchema.nullable(),
    lastError: opportunityPhaseErrorSchema.nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export function toOpportunityDiscoveryPublicRecord(input: unknown) {
  const record = opportunityDiscoveryRecordSchema.parse(input);
  return opportunityDiscoveryPublicRecordSchema.parse({
    schemaVersion: record.schemaVersion,
    id: record.id,
    processId: record.processId,
    state: record.state,
    scenarioBasis:
      record.hypotheses && record.state !== "no_supported_hypotheses"
        ? selectScenarioHypotheses(record.hypotheses).basis
        : null,
    sourceProcess: record.sourceProcess,
    hypotheses: record.hypotheses,
    scenarios: record.scenarios,
    lastError: record.lastError,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export type ScenarioLevel = z.infer<typeof scenarioLevelSchema>;
export type ExecutionMode = z.infer<typeof executionModeSchema>;
export type SystemAccessMode = z.infer<typeof systemAccessModeSchema>;
export type AccessTiming = z.infer<typeof accessTimingSchema>;
export type AccessMechanism = z.infer<typeof accessMechanismSchema>;
export type AiCapability = z.infer<typeof aiCapabilitySchema>;
export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;
export type PotentialLevel = z.infer<typeof potentialLevelSchema>;
export type ScenarioEvidenceBasis = z.infer<typeof scenarioEvidenceBasisSchema>;
export type OpportunityDiscoveryConfig = z.infer<
  typeof opportunityDiscoveryConfigSchema
>;
export type OpportunityProcessSnapshot = z.infer<
  typeof opportunityProcessSnapshotSchema
>;
export type OpportunityAssumption = z.infer<typeof opportunityAssumptionSchema>;
export type OpportunityHypothesis = z.infer<typeof opportunityHypothesisSchema>;
export type OpportunityHypothesisAiResult = z.infer<
  typeof opportunityHypothesisAiResultSchema
>;
export type OpportunityHypothesisResult = z.infer<
  typeof opportunityHypothesisResultSchema
>;
export type OpportunityDiscoveryState = z.infer<
  typeof opportunityDiscoveryStateSchema
>;
export type OpportunityPhaseError = z.infer<typeof opportunityPhaseErrorSchema>;
export type ScenarioAction = z.infer<typeof scenarioActionSchema>;
export type ScenarioSystemAccess = z.infer<typeof scenarioSystemAccessSchema>;
export type OpportunityScenario = z.infer<typeof opportunityScenarioSchema>;
export type OpportunityScenarioResult = z.infer<
  typeof opportunityScenarioResultSchema
>;
export type OpportunityScenarioReferenceContext = z.infer<
  typeof opportunityScenarioReferenceContextSchema
>;
export type OpportunityContractManifest = z.infer<
  typeof opportunityContractManifestSchema
>;
export type OpportunityDiscoveryRecord = z.infer<
  typeof opportunityDiscoveryRecordSchema
>;
export type OpportunityDiscoveryPublicRecord = z.infer<
  typeof opportunityDiscoveryPublicRecordSchema
>;
export type OpportunityDiscoverySummary = z.infer<
  typeof opportunityDiscoverySummarySchema
>;
