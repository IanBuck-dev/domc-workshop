import { describe, expect, test } from "bun:test";
import {
  claudeArgs,
  buildPrompt,
} from "../packages/claude/src/request-builder";
import { claudeJsonSchema } from "../packages/claude/src/response-schemas";
import { demoIdeas } from "../packages/storage/src/seed";
const settings = {
  workshopTitle: "Test",
  workshopSubtitle: "",
  model: "opus",
  modelDisplay: "Opus",
  effort: "medium" as const,
  impactThreshold: 5.5,
  effortThreshold: 5.5,
  scoringGuidance: "Test",
  weights: { businessImpact: 1 },
  models: [],
};
describe("Claude contract", () => {
  test("disables tools and uses bounded schema", () => {
    const a = claudeArgs("opus", "low", claudeJsonSchema);
    expect(a).toContain("--tools");
    expect(a[a.indexOf("--tools") + 1]).toBe("");
    expect(a).toContain("--json-schema");
  });
  test("passes only current idea content", () => {
    const p = buildPrompt("assess", demoIdeas[3], "REGELN", settings);
    expect(p).toContain(demoIdeas[3].raw);
    expect(p).not.toContain(demoIdeas[4].title);
  });
});
