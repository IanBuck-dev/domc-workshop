import { describe, expect, test } from "bun:test";
import {
  claudeArgs,
  buildPrompt,
} from "../packages/claude/src/request-builder";
import { claudeJsonSchema } from "../packages/claude/src/response-schemas";
import { demoIdeas } from "../packages/storage/src/seed";
import { discoveryModelSettings } from "../packages/claude/src/discovery-adapter";
import { ProcessRepository } from "../packages/storage/src/process-repository";
import { WorkspaceRepository } from "../packages/storage/src/workspace-repository";
import { processInterviewError } from "../apps/server/src/routes/processes";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  discovery: {
    model: "claude-opus-4-8",
    modelDisplay: "Claude Opus 4.8",
    effort: "low" as const,
    timeoutMs: 90_000,
    maxOutputTokens: 1_800,
    maxQuestions: 8,
    departments: [],
    criteria: [],
  },
};
describe("Claude contract", () => {
  test("keeps provider errors out of the interview UI", () => {
    expect(
      processInterviewError(new Error("Claude Code process aborted by user")),
    ).toBe("Die Antwort wurde abgebrochen. Sie können es erneut versuchen.");
    expect(
      processInterviewError(new Error("Session ID abc is already in use")),
    ).not.toContain("Session ID");
  });

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
  test("pins discovery sessions and excludes mutation and network tools", async () => {
    const root = await mkdtemp(join(tmpdir(), "discovery-contract-"));
    try {
      const workspace = new WorkspaceRepository(root);
      await workspace.ensure();
      const process = await new ProcessRepository(root).create(
        await workspace.settings(),
      );
      const options = discoveryModelSettings(
        process,
        "REGELN",
        join(root, "processes", process.metadata.id),
      );
      expect(options.cwd).toEndWith(process.metadata.id);
      expect(options.sessionId).toBe(process.metadata.sessionId);
      expect(options.allowedTools).toEqual(["Read", "Glob", "Bash"]);
      expect(options.disallowedTools).toContain("Write");
      expect(options.disallowedTools).toContain("WebSearch");
      expect(options.maxTurns).toBe(6);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
