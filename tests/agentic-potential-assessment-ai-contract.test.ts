import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  agenticAssessmentAiResultSchema,
  assessableCriterionIds,
} from "../packages/domain/src/agentic-potential-assessment.ts";
test("AI contract requires exactly 24 assessed criteria", () => {
  expect(() =>
    agenticAssessmentAiResultSchema.parse({ schemaVersion: 1, criteria: [] }),
  ).toThrow();
});

test("Claude JSON schema describes both criterion result variants", async () => {
  const schema = JSON.parse(
    await readFile(
      "defaults/ai-schemas/agentic-potential-assessment.json",
      "utf8",
    ),
  ) as {
    properties: {
      criteria: {
        items: {
          oneOf: Array<{
            properties: Record<string, Record<string, unknown>>;
          }>;
        };
      };
    };
  };
  const variants = schema.properties.criteria.items.oneOf;
  expect(variants).toHaveLength(2);
  expect(variants.map((item) => item.properties.status!.const)).toEqual([
    "scored",
    "insufficient_evidence",
  ]);
  for (const variant of variants)
    expect(variant.properties.criterionId!.enum).toEqual([
      ...assessableCriterionIds,
    ]);
  expect(variants[0]!.properties.evidenceIds!.minItems).toBe(1);
  expect(variants[0]!.properties.hypothesisIds!.minItems).toBe(1);
  expect(variants[0]!.properties.assumptions!.maxItems).toBe(0);
  expect(variants[1]!.properties.score!.type).toBe("null");
});
