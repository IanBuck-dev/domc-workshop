import { expect, test } from "bun:test";
import config from "../defaults/agentic-potential-assessment-config.json";
import {
  agenticPotentialAssessmentConfigSchema,
  agenticPotentialScore,
  assertAgenticAssessmentTransition,
  insufficientEvidenceCriterionAssessmentSchema,
  scoredCriterionAssessmentSchema,
} from "../packages/domain/src/agentic-potential-assessment.ts";

function scoreResult(scoreFor: (category: string) => 0 | 1 | 2 | null) {
  return {
    schemaVersion: 1 as const,
    criteria: config.criteria.map((criterion) => {
      if (criterion.assessmentType === "policy_excluded")
        return {
          status: "policy_excluded" as const,
          criterionId: criterion.id,
          score: null,
          confidenceLevel: null,
          rationale: "Dieses Kriterium ist fachlich ausgeschlossen.",
          evidenceIds: [],
          hypothesisIds: [],
          assumptions: [],
          openQuestions: [],
        };
      const score = scoreFor(criterion.category);
      return score === null
        ? {
            status: "insufficient_evidence" as const,
            criterionId: criterion.id,
            score: null,
            confidenceLevel: "medium" as const,
            rationale: "Für eine belastbare Einstufung fehlen Informationen.",
            evidenceIds: [],
            hypothesisIds: [],
            assumptions: ["Eine Grundlage fehlt."],
            openQuestions: ["Welche Grundlage gilt?"],
          }
        : {
            status: "scored" as const,
            criterionId: criterion.id,
            score,
            confidenceLevel: "high" as const,
            rationale: "Prozessbild und Hypothese belegen dieses Kriterium.",
            evidenceIds: ["evidence-1"],
            hypothesisIds: ["HYP-001"],
            assumptions: [],
            openQuestions: [],
          };
    }),
  };
}
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

test("potential score weights benefit, feasibility and AI suitability 50/30/20", () => {
  const score = agenticPotentialScore(
    scoreResult((category) =>
      category === "Qualitativ-strategische Relevanz"
        ? 2
        : category === "Implementierungskomplexität"
          ? 1
          : 0,
    ),
  );
  expect(score).toEqual({
    value: 65,
    benefit: 100,
    feasibility: 50,
    aiSuitability: 0,
    scoredCriteria: 24,
  });
});

test("potential score stays empty without half coverage in every group", () => {
  expect(
    agenticPotentialScore(
      scoreResult((category) =>
        category === "Technische KI-Attraktivität" ? null : 2,
      ),
    ),
  ).toBeNull();
});
