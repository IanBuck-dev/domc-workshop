import { describe, expect, test } from "bun:test";
import {
  assessmentConfigSchema,
  emptyCriterionValues,
  gatewayResponseKindFor,
} from "../packages/domain/src/assessment";
import {
  calculateAssessmentResults,
  rankAssessments,
} from "../packages/domain/src/scoring";

const config = assessmentConfigSchema.parse(
  await Bun.file("defaults/assessment-config.json").json(),
);

function completedValues() {
  const financial: Record<string, number | boolean> = {
    "annual-savings": 30_000,
    "one-time-savings": 0,
    "annual-operating-costs": 5_000,
    "one-time-costs": 10_000,
    "absolute-necessity": false,
  };
  return emptyCriterionValues(config).map((item) => ({
    ...item,
    value: financial[item.criterionId] ?? 2,
    source: "human" as const,
    confirmation: "confirmed" as const,
    updatedBy: "human" as const,
    updatedAt: new Date().toISOString(),
  }));
}

describe("KI-Potenzial domain", () => {
  test("validates the versioned default catalog with exactly four questions, five sections and 28 inputs", () => {
    expect(config.gateway.questions).toHaveLength(4);
    expect(
      config.gateway.questions.every(
        (question) =>
          question.evaluationQuestion &&
          question.userQuestion &&
          question.helpText &&
          !question.description,
      ),
    ).toBe(true);
    expect(config.chat.sections).toHaveLength(5);
    expect(config.criteria).toHaveLength(28);
    expect(new Set(config.criteria.map((item) => item.id)).size).toBe(28);
  });

  test("calculates all corporate-v1 components deterministically", () => {
    const result = calculateAssessmentResults(config, completedValues());
    expect(result.annualNetBenefit).toBe(25_000);
    expect(result.initialNetCost).toBe(10_000);
    expect(result.paybackMonths).toBeCloseTo(4.8);
    expect(result.yearOneNetReturn).toBe(15_000);
    expect(result.roi).toBe(1);
    expect(result.profitabilityPercent).toBeCloseTo((7 / 12) * 100);
    expect(result.strategicRelevancePercent).toBe(100);
    expect(result.implementationFactorPercent).toBe(200);
    expect(result.technicalAttractivenessPercent).toBe(200);
    expect(result.overallScore).toBeCloseTo(283.333333);
  });

  test("keeps unknown gateway evidence distinct from explicit absence", () => {
    expect(gatewayResponseKindFor("Weiß ich nicht")).toBe("unknown");
    expect(gatewayResponseKindFor("Nicht bekannt")).toBe("unknown");
    expect(gatewayResponseKindFor("Trifft in diesem Prozess nicht zu")).toBe(
      "not_applicable",
    );
    expect(gatewayResponseKindFor("Der Ablauf ist vollständig bekannt.")).toBe(
      "description",
    );
  });

  test("uses documented ranking tie breakers", () => {
    const result = calculateAssessmentResults(config, completedValues());
    const lower = { ...result, overallScore: result.overallScore - 1 };
    const ranked = rankAssessments([
      {
        id: "later",
        calculatedResults: result,
        createdAt: "2026-01-02T00:00:00.000Z",
      },
      {
        id: "lower",
        calculatedResults: lower,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "earlier",
        calculatedResults: result,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(ranked.map((item) => item.id)).toEqual([
      "earlier",
      "later",
      "lower",
    ]);
  });
});
