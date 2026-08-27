import { expect, test } from "bun:test";
import {
  configuredAiModel,
  configuredAiProvider,
  aiProviderIds,
} from "../packages/ai-runtime/src/contracts.ts";
import { providerModel } from "../packages/ai-runtime/src/operation-policy.ts";
import { aiTraceSchema } from "../packages/domain/src/process-understanding.ts";

test("runtime defaults to Codex and preserves the Claude compatibility switch", () => {
  expect(aiProviderIds).toEqual(["codex-cli", "claude-cli"]);
  expect(configuredAiProvider(undefined)).toBe("codex-cli");
  expect(configuredAiProvider("claude-cli")).toBe("claude-cli");
  expect(configuredAiModel("codex-cli", undefined)).toBe("gpt-5.6-sol");
  expect(configuredAiModel("claude-cli", undefined)).toBe("opus");
});

test("provider models normalize frozen records and honor an operator override", () => {
  expect(providerModel("codex-cli", "opus", undefined)).toBe("gpt-5.6-sol");
  expect(providerModel("claude-cli", "gpt-5.6-sol", undefined)).toBe("opus");
  expect(providerModel("codex-cli", "opus", "gpt-custom")).toBe("gpt-custom");
  expect(providerModel("claude-cli", "gpt-5.6-sol", "sonnet")).toBe("sonnet");
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
