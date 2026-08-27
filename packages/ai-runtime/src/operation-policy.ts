import type { AiProviderId, AiRuntimeModelConfig } from "./contracts.ts";

export const operationPolicies = {
  "process-follow-ups": { effort: "medium" },
  "process-synthesis": { effort: "medium" },
  "opportunity-hypotheses": { effort: "high" },
  "opportunity-scenarios": { effort: "high" },
  "memory-distillation": { effort: "medium" },
  "memory-consolidation": { effort: "medium" },
  "agentic-potential-assessment": { effort: "high" },
} as const;

export function providerModel(
  provider: AiProviderId,
  configured: string,
  override = process.env.AI_MODEL,
) {
  if (override) return override;
  if (provider === "codex-cli")
    return configured.startsWith("gpt-") ? configured : "gpt-5.6-sol";
  return configured.startsWith("gpt-") ? "opus" : configured;
}

export function runtimeModel(
  provider: AiProviderId,
  configured: AiRuntimeModelConfig,
): AiRuntimeModelConfig {
  return {
    ...configured,
    model: providerModel(provider, configured.model),
  };
}
