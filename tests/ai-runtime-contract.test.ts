import { expect, test } from "bun:test";
import {
  configuredAiModel,
  configuredAiEffort,
  configuredAiProvider,
  configuredAiServiceTier,
  aiProviderIds,
} from "../packages/ai-runtime/src/contracts.ts";
import { providerModel } from "../packages/ai-runtime/src/operation-policy.ts";
import { aiTraceSchema } from "../packages/domain/src/process-understanding.ts";

test("runtime defaults to Codex and preserves the Claude compatibility switch", () => {
  expect(aiProviderIds).toEqual(["codex-cli", "claude-cli"]);
  expect(configuredAiProvider(undefined)).toBe("codex-cli");
  expect(configuredAiProvider("claude-cli")).toBe("claude-cli");
  expect(configuredAiModel("codex-cli", undefined)).toBe("gpt-5.6-terra");
  expect(configuredAiModel("claude-cli", undefined)).toBe("opus");
});

test("provider models normalize frozen records and honor an operator override", () => {
  expect(providerModel("codex-cli", "opus", undefined)).toBe("gpt-5.6-terra");
  expect(providerModel("claude-cli", "gpt-5.6-sol", undefined)).toBe("opus");
  expect(providerModel("codex-cli", "opus", "gpt-custom")).toBe("gpt-custom");
  expect(providerModel("claude-cli", "gpt-5.6-sol", "sonnet")).toBe("sonnet");
});

test("runtime validates reasoning and Fast service-tier overrides", () => {
  expect(configuredAiEffort("high", "medium")).toBe("medium");
  expect(() => configuredAiEffort("medium", "ultra")).toThrow(
    "AI_REASONING_EFFORT",
  );
  expect(configuredAiServiceTier("priority")).toBe("priority");
  expect(() => configuredAiServiceTier("fast")).toThrow("AI_SERVICE_TIER");
});

test("legacy traces parse as Claude CLI traces", () => {
  const trace = aiTraceSchema.parse({
    operationId: crypto.randomUUID(),
    sessionId: null,
    model: "opus",
    durationMs: 1,
    inputTokens: null,
    outputTokens: null,
  });
  expect(trace.provider).toBe("claude-cli");
});
