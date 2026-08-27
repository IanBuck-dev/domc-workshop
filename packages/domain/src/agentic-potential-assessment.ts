import { createHash } from "node:crypto";
import { z } from "zod";
import {
  opportunityDiscoveryRecordSchema,
  opportunityProcessSnapshotSchema,
  opportunityScenarioSchema,
} from "./opportunity-discovery.ts";

export const agenticAssessmentContractVersion = 1 as const;
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const criterionIdSchema = z.string().regex(/^[a-z][a-z0-9_]{2,80}$/);
const textSchema = z.string().trim().min(1).max(8_000);
const identifierArray = (minimum = 0, maximum = 250) =>
  z
    .array(z.string().trim().min(1).max(120))
    .min(minimum)
    .max(maximum)
    .refine(
      (values) => new Set(values).size === values.length,
      "Values must be unique.",
    );

export const assessableCriterionIds = [
  "strategic_fit",
  "qualitative_process_improvement",
  "customer_value",
  "employee_value",
  "temporal_process_improvement",
  "risk_reduction",
  "scalability",
  "organizational_development",
  "time_urgency",
  "process_criticality",
  "process_maturity",
  "change_effort",
  "experience_base",
  "process_expertise",
  "process_diversity",
  "process_systems",
  "process_data",
  "context_understanding",
  "data_structuring_degree",
  "decision_complexity",
  "ai_data_foundation",
  "error_tolerance",
  "explainability_need",
  "autonomy_and_human_ai_collaboration",
] as const;
export const excludedCriterionIds = [
  "regulatory_admissibility",
  "absolute_necessity",
  "annual_savings_potential",
  "one_time_savings",
  "annual_operating_costs",
  "one_time_costs",
  "business_case_stability",
  "compliance_risk",
] as const;
export const criterionIds = [
  ...assessableCriterionIds,
  ...excludedCriterionIds,
] as const;
export const assessableCriterionIdSchema = z.enum(assessableCriterionIds);
export const excludedCriterionIdSchema = z.enum(excludedCriterionIds);
export const criterionStatusSchema = z.enum([
  "scored",
  "insufficient_evidence",
  "policy_excluded",
]);

const criterionDefinitionSchema = z
  .object({
    id: criterionIdSchema,
    category: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(240),
    definition: textSchema,
    scale: textSchema,
    order: z.number().int().min(1).max(99),
    assessmentType: z.enum(["ai", "policy_excluded"]),
  })
  .strict();
export const agenticPotentialAssessmentConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    profile: z
      .object({
        id: z.literal("agentic-potential-assessment-v1"),
        version: z.literal(1),
      })
      .strict(),
    ai: z
      .object({
        model: z.enum(["sonnet", "opus", "claude-opus-4-8"]),
        reasoningEffort: z.enum(["medium", "high"]),
        timeoutMs: z.number().int().min(10_000).max(300_000),
        maxOutputTokens: z.number().int().min(512).max(32_768),
        maxInputCharacters: z.number().int().min(10_000).max(2_000_000),
        maxBudgetUsd: z.number().positive().max(10),
      })
      .strict(),
    criteria: z.array(criterionDefinitionSchema).length(32),
  })
  .strict()
  .superRefine((config, ctx) => {
    const ids = config.criteria.map((criterion) => criterion.id);
    if (
      new Set(ids).size !== ids.length ||
      criterionIds.some((id) => !ids.includes(id)) ||
      ids.some((id) => !criterionIds.includes(id as never))
    )
      ctx.addIssue({
        code: "custom",
        path: ["criteria"],
        message:
          "The criteria catalogue must contain every configured criterion exactly once.",
      });
    config.criteria.forEach((criterion) => {
      const expected = assessableCriterionIds.includes(criterion.id as never)
        ? "ai"
        : "policy_excluded";
      if (criterion.assessmentType !== expected)
        ctx.addIssue({
          code: "custom",
          path: ["criteria"],
          message: "Criterion assessment type does not match policy.",
        });
    });
  });

export const agenticAssessmentSourceSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    processId: z.string().regex(/^PROC-\d{4}$/),
    processName: z.string().trim().min(1).max(500),
    department: z.string().trim().min(1).max(500),
    sourceProcessHash: sha256Schema,
    opportunity: opportunityProcessSnapshotSchema,
    scenario: opportunityScenarioSchema.refine(
      (scenario) => scenario.id === "SCN-agentic",
      "The assessment requires SCN-agentic.",
    ),
    hypotheses: z
      .array(z.object({ id: z.string().regex(/^HYP-\d{3}$/) }).passthrough())
      .min(1)
      .max(100),
    criteria: z.array(criterionDefinitionSchema).length(32),
  })
  .strict()
  .superRefine((value, ctx) => {
    const included = new Set(value.scenario.includedHypothesisIds);
    if (
      value.hypotheses.some((hypothesis) => !included.has(hypothesis.id)) ||
      value.hypotheses.length !== included.size
    )
      ctx.addIssue({
        code: "custom",
        path: ["hypotheses"],
        message:
          "The snapshot must contain exactly the scenario's included hypotheses.",
      });
  });

const commonAssessment = {
  rationale: textSchema,
  evidenceIds: identifierArray(),
  hypothesisIds: identifierArray(),
  assumptions: z.array(textSchema).max(50),
  openQuestions: z.array(textSchema).max(50),
};
export const scoredCriterionAssessmentSchema = z
  .object({
    status: z.literal("scored"),
    criterionId: assessableCriterionIdSchema,
    score: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    confidenceLevel: z.literal("high"),
    rationale: commonAssessment.rationale,
    evidenceIds: commonAssessment.evidenceIds.min(1),
    hypothesisIds: commonAssessment.hypothesisIds.min(1),
    assumptions: z.array(textSchema).length(0),
    openQuestions: z.array(textSchema).length(0),
  })
  .strict();
export const insufficientEvidenceCriterionAssessmentSchema = z
  .object({
    status: z.literal("insufficient_evidence"),
    criterionId: assessableCriterionIdSchema,
    score: z.null(),
    confidenceLevel: z.enum(["medium", "low"]),
    ...commonAssessment,
  })
  .strict();
export const policyExcludedCriterionAssessmentSchema = z
  .object({
    status: z.literal("policy_excluded"),
    criterionId: excludedCriterionIdSchema,
    score: z.null(),
    confidenceLevel: z.null(),
    rationale: textSchema,
    evidenceIds: z.array(z.string()).length(0),
    hypothesisIds: z.array(z.string()).length(0),
    assumptions: z.array(z.string()).length(0),
    openQuestions: z.array(z.string()).length(0),
  })
  .strict();
export const criterionAssessmentSchema = z.discriminatedUnion("status", [
  scoredCriterionAssessmentSchema,
  insufficientEvidenceCriterionAssessmentSchema,
  policyExcludedCriterionAssessmentSchema,
]);

export const agenticAssessmentAiResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    criteria: z
      .array(
        z.discriminatedUnion("status", [
          scoredCriterionAssessmentSchema,
          insufficientEvidenceCriterionAssessmentSchema,
        ]),
      )
      .length(24),
  })
  .strict();
export const agenticAssessmentResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    criteria: z.array(criterionAssessmentSchema).length(32),
  })
  .strict();

export function normalizeAgenticAssessment(
  input: unknown,
  sourceInput: unknown,
) {
  const output = agenticAssessmentAiResultSchema.parse(input);
  const source = agenticAssessmentSourceSnapshotSchema.parse(sourceInput);
  const supplied = output.criteria.map((criterion) => criterion.criterionId);
  if (
    new Set(supplied).size !== supplied.length ||
    assessableCriterionIds.some((id) => !supplied.includes(id))
  )
    throw new Error(
      "Die KI-Bewertung muss jedes bewertbare Kriterium genau einmal enthalten.",
    );
  const evidenceIds = new Set(
    source.opportunity.understanding.evidence.map((evidence) => evidence.id),
  );
  const hypothesisIds = new Set(
    source.hypotheses.map((hypothesis) => hypothesis.id),
  );
  for (const criterion of output.criteria) {
    if (criterion.evidenceIds.some((id) => !evidenceIds.has(id)))
      throw new Error("Eine Bewertung verweist auf unbekannte Evidenz.");
    if (criterion.hypothesisIds.some((id) => !hypothesisIds.has(id)))
      throw new Error(
        "Eine Bewertung verweist auf eine nicht eingeschlossene Hypothese.",
      );
  }
  const values = new Map(
    output.criteria.map((criterion) => [criterion.criterionId, criterion]),
  );
  return agenticAssessmentResultSchema.parse({
    schemaVersion: 1,
    criteria: source.criteria
      .sort((a, b) => a.order - b.order)
      .map((definition) => {
        if (definition.assessmentType === "policy_excluded")
          return {
            status: "policy_excluded",
            criterionId: definition.id,
            score: null,
            confidenceLevel: null,
            rationale: "Nicht Bestandteil dieser Ausbaustufe.",
            evidenceIds: [],
            hypothesisIds: [],
            assumptions: [],
            openQuestions: [],
          };
        return values.get(definition.id as AssessableCriterionId)!;
      }),
  });
}

export const agenticAssessmentStates = [
  "queued",
  "running",
  "completed",
  "failed",
] as const;
export const agenticAssessmentStateSchema = z.enum(agenticAssessmentStates);
export function assertAgenticAssessmentTransition(
  fromInput: unknown,
  toInput: unknown,
) {
  const from = agenticAssessmentStateSchema.parse(fromInput);
  const to = agenticAssessmentStateSchema.parse(toInput);
  if (
    !new Set([
      "queued:running",
      "running:completed",
      "running:failed",
      "failed:queued",
    ]).has(`${from}:${to}`)
  )
    throw new Error(
      `Ungültiger Zustandswechsel der agentischen Potenzialbewertung: ${from} → ${to}.`,
    );
  return to;
}
export const agenticAssessmentContractManifestSchema = z
  .object({ prompt: sha256Schema, schema: sha256Schema })
  .strict();
export const agenticPotentialAssessmentRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^APA-PROC-\d{4}$/),
    processId: z.string().regex(/^PROC-\d{4}$/),
    state: agenticAssessmentStateSchema,
    sourceHash: sha256Schema,
    configHash: sha256Schema,
    contractManifest: agenticAssessmentContractManifestSchema,
    sourceSnapshot: agenticAssessmentSourceSnapshotSchema,
    configSnapshot: agenticPotentialAssessmentConfigSchema,
    result: agenticAssessmentResultSchema.nullable(),
    lastError: z
      .object({
        message: z.string().trim().min(1).max(500),
        cancelled: z.boolean(),
        at: z.string().datetime(),
      })
      .strict()
      .nullable(),
    assessmentRevision: sha256Schema.nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((record, ctx) => {
    if (record.id !== `APA-${record.processId}`)
      ctx.addIssue({
        code: "custom",
        path: ["id"],
        message: "Assessment ID must be derived from process ID.",
      });
    if ((record.state === "completed") !== (record.result !== null))
      ctx.addIssue({
        code: "custom",
        path: ["result"],
        message: "Only completed assessments contain a result.",
      });
    if ((record.state === "failed") !== (record.lastError !== null))
      ctx.addIssue({
        code: "custom",
        path: ["lastError"],
        message: "Failure state and error detail must agree.",
      });
    if ((record.state === "completed") !== (record.assessmentRevision !== null))
      ctx.addIssue({
        code: "custom",
        path: ["assessmentRevision"],
        message: "Completed assessments require a revision.",
      });
  });

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function hashAgenticAssessment(value: unknown) {
  return createHash("sha256")
    .update(typeof value === "string" ? value : canonical(value))
    .digest("hex");
}
export function agenticAssessmentRevision(
  source: unknown,
  config: unknown,
  manifest: unknown,
  result: unknown,
) {
  return hashAgenticAssessment({ source, config, manifest, result });
}
export function createAgenticAssessmentSourceSnapshot(
  opportunityInput: unknown,
  configInput: unknown,
) {
  const opportunity = opportunityDiscoveryRecordSchema.parse(opportunityInput);
  const config = agenticPotentialAssessmentConfigSchema.parse(configInput);
  if (
    opportunity.state !== "completed" ||
    !opportunity.scenarios ||
    !opportunity.hypotheses
  )
    throw new Error("Die Szenarioanalyse muss abgeschlossen sein.");
  const scenario = opportunity.scenarios.scenarios.find(
    (item) => item.id === "SCN-agentic",
  );
  if (!scenario) throw new Error("Das agentische Szenario fehlt.");
  const hypotheses = opportunity.hypotheses.stepAnalyses
    .flatMap((item) => item.hypotheses)
    .filter((item) => scenario.includedHypothesisIds.includes(item.id));
  return agenticAssessmentSourceSnapshotSchema.parse({
    schemaVersion: 1,
    processId: opportunity.processId,
    processName: opportunity.sourceProcess.processName,
    department: opportunity.sourceProcess.department,
    sourceProcessHash: opportunity.sourceProcessHash,
    opportunity: opportunity.sourceProcess,
    scenario,
    hypotheses,
    criteria: config.criteria,
  });
}
export function toAgenticPotentialAssessmentPublicRecord(input: unknown) {
  const record = agenticPotentialAssessmentRecordSchema.parse(input);
  return {
    schemaVersion: record.schemaVersion,
    id: record.id,
    processId: record.processId,
    state: record.state,
    sourceSnapshot: record.sourceSnapshot,
    result: record.result,
    lastError: record.lastError,
    assessmentRevision: record.assessmentRevision,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
export type AgenticPotentialAssessmentConfig = z.infer<
  typeof agenticPotentialAssessmentConfigSchema
>;
export type AgenticAssessmentSourceSnapshot = z.infer<
  typeof agenticAssessmentSourceSnapshotSchema
>;
export type AgenticAssessmentResult = z.infer<
  typeof agenticAssessmentResultSchema
>;
export type AgenticPotentialAssessmentRecord = z.infer<
  typeof agenticPotentialAssessmentRecordSchema
>;
export type AgenticAssessmentState = z.infer<
  typeof agenticAssessmentStateSchema
>;
export type CriterionAssessment = z.infer<typeof criterionAssessmentSchema>;
export type AssessableCriterionId = z.infer<typeof assessableCriterionIdSchema>;
export type ExcludedCriterionId = z.infer<typeof excludedCriterionIdSchema>;
