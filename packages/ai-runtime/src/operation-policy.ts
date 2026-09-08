import {
  configuredAiEffort,
  type AiProviderId,
  type AiRuntimeModelConfig,
} from "./contracts.ts";

export const operationPolicies = {
  "process-follow-ups": { effort: "medium" },
  "process-synthesis": { effort: "medium" },
  "opportunity-hypotheses": { effort: "medium" },
  "opportunity-scenarios": { effort: "medium" },
  "memory-distillation": { effort: "medium" },
  "memory-consolidation": { effort: "medium" },
  "agentic-potential-assessment": { effort: "medium" },
} as const;

export function providerModel(
  provider: AiProviderId,
  configured: string,
  override = process.env.AI_MODEL,
) {
  if (override) return override;
  if (provider === "codex-cli")
    return configured.startsWith("gpt-") ? configured : "gpt-5.6-terra";
  return configured.startsWith("gpt-") ? "opus" : configured;
}

export function runtimeModel(
  provider: AiProviderId,
  configured: AiRuntimeModelConfig,
): AiRuntimeModelConfig {
  return {
    ...configured,
    model: providerModel(provider, configured.model),
    effort: configuredAiEffort(configured.effort),
  };
}
