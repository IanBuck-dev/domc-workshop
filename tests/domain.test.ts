import { describe, expect, test } from "bun:test";
import { rankIdeas } from "../packages/domain/src/ranking";
import { quadrant } from "../packages/domain/src/matrix";
import { deterministicPriority } from "../packages/domain/src/priority";
import { demoIdeas } from "../packages/storage/src/seed";
describe("portfolio domain", () => {
  test("ranks priority, impact, then low effort", () => {
    const ranked = rankIdeas(demoIdeas);
    expect(ranked[0].id).toBe("IDEA-0001");
    expect(ranked.at(-1)?.id).toBe("IDEA-0012");
  });
  test("covers all matrix quadrants", () => {
    expect(
      new Set(demoIdeas.map((i) => quadrant(i.scores.impact, i.scores.effort)))
        .size,
    ).toBe(4);
  });
  test("contains every priority", () =>
    expect(new Set(demoIdeas.map((i) => i.scores.priority))).toEqual(
      new Set([1, 2, 3, 4, 5]),
    ));
  test("maps weighted components deterministically", () =>
    expect(
      deterministicPriority(
        { businessImpact: 5, feasibility: 3 },
        { businessImpact: 2, feasibility: 1 },
      ),
    ).toBe(4));
});
