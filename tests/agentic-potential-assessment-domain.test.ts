import { expect, test } from "bun:test";
import config from "../defaults/agentic-potential-assessment-config.json";
import {
  agenticPotentialAssessmentConfigSchema,
  assertAgenticAssessmentTransition,
  insufficientEvidenceCriterionAssessmentSchema,
  scoredCriterionAssessmentSchema,
} from "../packages/domain/src/agentic-potential-assessment.ts";
test("versioned catalogue contains the complete score and policy sets", () => {
  const parsed = agenticPotentialAssessmentConfigSchema.parse(config);
  expect(parsed.criteria).toHaveLength(32);
  expect(
    parsed.criteria.filter((item) => item.assessmentType === "ai"),
  ).toHaveLength(24);
  expect(
    parsed.criteria.filter((item) => item.assessmentType === "policy_excluded"),
  ).toHaveLength(8);
});

test("a numeric score requires evidence, an included hypothesis and no open premise", () => {
  const valid = {
    status: "scored",
    criterionId: "strategic_fit",
    score: 2,
    confidenceLevel: "high",
    rationale: "Die dokumentierte Hypothese belegt eine strategische Wirkung.",
    evidenceIds: ["flow-roles"],
    hypothesisIds: ["HYP-001"],
    assumptions: [],
    openQuestions: [],
  };
  expect(scoredCriterionAssessmentSchema.parse(valid).score).toBe(2);
  expect(() =>
    scoredCriterionAssessmentSchema.parse({ ...valid, evidenceIds: [] }),
  ).toThrow();
  expect(() =>
    scoredCriterionAssessmentSchema.parse({ ...valid, hypothesisIds: [] }),
  ).toThrow();
  expect(() =>
    scoredCriterionAssessmentSchema.parse({
      ...valid,
      assumptions: ["Materielle Annahme"],
    }),
  ).toThrow();
});

test("medium and low confidence cannot carry a numeric score", () => {
  expect(() =>
    insufficientEvidenceCriterionAssessmentSchema.parse({
      status: "insufficient_evidence",
      criterionId: "strategic_fit",
      score: 1,
      confidenceLevel: "medium",
      rationale: "Es fehlen belastbare Informationen.",
      evidenceIds: [],
      hypothesisIds: [],
      assumptions: [],
      openQuestions: ["Welche Strategie gilt?"],
    }),
  ).toThrow();
});
test("assessment state machine only permits bounded lifecycle transitions", () => {
  expect(assertAgenticAssessmentTransition("queued", "running")).toBe(
    "running",
  );
  expect(assertAgenticAssessmentTransition("running", "completed")).toBe(
    "completed",
  );
  expect(() =>
    assertAgenticAssessmentTransition("completed", "queued"),
  ).toThrow();
});
