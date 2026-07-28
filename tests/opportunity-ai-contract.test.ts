import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ClaudeOpportunityAiAdapter } from "../packages/claude/src/opportunity-ai-adapter.ts";
import {
  CLAUDE_NETWORK_ALLOWED_DOMAINS,
  SandboxRunner,
  type SandboxTransportRequest,
} from "../packages/claude/src/sandbox-runner.ts";
import { createOpportunityProcessSnapshot } from "../packages/domain/src/opportunity-discovery.ts";
import { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";
import {
  confirmedProcess,
  hypothesisAiResult,
  normalizedHypotheses,
  opportunityDefaults,
  scenarioResult,
} from "./opportunity-fixtures.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

function envelope(value: unknown) {
  return JSON.stringify({
    structured_output: value,
    usage: { input_tokens: 3, output_tokens: 7 },
  });
}

describe("opportunity Claude contract", () => {
  test("allows the Claude OAuth refresh host in deployment and fallback sandbox settings", async () => {
    const deploymentSettings = JSON.parse(
      await Bun.file("deploy/pi/sandbox-settings.json").text(),
    ) as { network?: { allowedDomains?: unknown } };

    expect(deploymentSettings.network?.allowedDomains).toContain(
      "platform.claude.com",
    );
    expect(CLAUDE_NETWORK_ALLOWED_DOMAINS).toContain("platform.claude.com");
  });

  test("uses two fresh tool-free calls with only bounded phase inputs", async () => {
    const root = await mkdtemp(join(tmpdir(), "opportunity-ai-"));
    roots.push(root);
    const process = await confirmedProcess(new ProcessCaptureRepository(root));
    const sourceProcess = createOpportunityProcessSnapshot(process);
    const defaults = await opportunityDefaults();
    expect(defaults.config.ai).toMatchObject({
      model: "claude-opus-4-8",
      reasoningEffort: "high",
    });
    const captured: SandboxTransportRequest[] = [];
    const responses = [hypothesisAiResult(), scenarioResult()];
    const runner = new SandboxRunner({
      tempRoot: join(root, "operations"),
      sandboxCommand: "missing",
      allowUnsafeLocalFallback: true,
      transport: async (request) => {
        captured.push(request);
        return {
          stdout: envelope(responses[captured.length - 1]),
          stderr: "",
          exitCode: 0,
          sandboxed: false,
        };
      },
    });
    const adapter = new ClaudeOpportunityAiAdapter(runner);
    const model = {
      model: "claude-opus-4-8",
      effort: "high",
      timeoutMs: defaults.config.ai.timeoutMs,
      maxOutputTokens: defaults.config.ai.maxOutputTokens,
      maxInputCharacters: defaults.config.ai.maxInputCharacters,
      maxBudgetUsd: defaults.config.ai.maxBudgetUsd,
    } as const;
    const hypotheses = await adapter.discoverHypotheses({
      processId: process.id,
      configHash: "a".repeat(64),
      model,
      sourceProcess,
      contracts: defaults.contracts,
      instructions: defaults.config.instructions.hypotheses,
    });
    const scenarioHypotheses = normalizedHypotheses().stepAnalyses.flatMap(
      (item) => item.hypotheses,
    );
    const scenarios = await adapter.createScenarios({
      processId: process.id,
      configHash: "a".repeat(64),
      model,
      sourceProcess,
      contracts: defaults.contracts,
      instructions: defaults.config.instructions.scenarios,
      scenarioBasis: "high",
      scenarioHypotheses,
    });

    expect(captured).toHaveLength(2);
    for (const request of captured) {
      expect(request.command).toContain("--no-session-persistence");
      expect(
        request.command.slice(request.command.indexOf("--tools") + 1)[0],
      ).toBe("");
      expect(
        request.command.slice(request.command.indexOf("--effort") + 1)[0],
      ).toBe("high");
      expect(request.stdin).not.toContain(process.cover.participantEmail);
      expect(request.stdin).not.toContain(process.cover.participantName);
      expect(request.stdin).toContain("Keine ausgewählten Dateien");
    }
    expect(captured[0]!.stdin).not.toContain("HYP-001");
    expect(captured[1]!.stdin).toContain("HYP-001");
    expect(captured[1]!.command).not.toContain("--json-schema");
    expect(captured[1]!.stdin).toContain("Verbindliches Ausgabeschema");
    expect(captured[0]!.command.join(" ")).toContain(
      "senken diese fachliche Konfidenz nicht automatisch",
    );
    expect(captured[0]!.command.join(" ")).toContain(
      "Eine direkt belegte Pflichtregel beweist nicht",
    );
    expect(captured[1]!.command.join(" ")).toContain(
      "pro Szenario höchstens vier Aktionen",
    );
    expect(captured[1]!.command.join(" ")).toContain(
      "regelbasierte Buchungsbedingungen",
    );
    expect(JSON.stringify(defaults.contracts.scenariosSchema)).toContain(
      '"maxLength":700',
    );
    expect(hypotheses.trace.sessionId).not.toBe(scenarios.trace.sessionId);
  });
});
