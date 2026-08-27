import { resolve } from "node:path";
import { processCaptureConfigSchema } from "../../../packages/domain/src/process-understanding.ts";
import type { AiRuntimeModelConfig } from "../../../packages/claude/src/ai-runtime-contracts.ts";
import type { MemoryConsolidationContracts } from "../../../packages/claude/src/memory-consolidation-contracts.ts";

const consolidationInputCharacters = 1_100_000;
const consolidationOutputTokens = 160_000;

function freeze(value: object): object {
  for (const child of Object.values(value))
    if (child && typeof child === "object") freeze(child as object);
  return Object.freeze(value);
}

function responseSchema(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (value as Record<string, unknown>).type !== "object" ||
    !((value as Record<string, unknown>).properties as Record<string, unknown>)
      ?.topicFiles
  )
    throw new Error("Ungültiges KI-Antwortschema: memory-consolidation");
  return freeze(structuredClone(value as object));
}

export async function loadMemoryConsolidationDefaults(
  rootOverride?: string,
): Promise<{
  contracts: MemoryConsolidationContracts;
  model: AiRuntimeModelConfig;
}> {
  const root =
    rootOverride ??
    process.env.CLAIMS_AI_DEFAULTS_DIR ??
    resolve(process.cwd(), "defaults");
  const [config, promptFile, schemaFile] = await Promise.all([
    Bun.file(resolve(root, "process-capture-config.json"))
      .json()
      .then((value) => processCaptureConfigSchema.parse(value)),
    Bun.file(resolve(root, "prompts", "memory-consolidation.md")),
    Bun.file(resolve(root, "ai-schemas", "memory-consolidation.json")),
  ]);
  if (!(await promptFile.exists()))
    throw new Error("Fehlender KI-Prompt: memory-consolidation");
  if (!(await schemaFile.exists()))
    throw new Error("Fehlendes KI-Antwortschema: memory-consolidation");
  const prompt = await promptFile.text();
  if (!prompt.trim() || prompt.length > 50_000)
    throw new Error("Ungültiger KI-Prompt: memory-consolidation");
  return {
    contracts: {
      prompt,
      responseSchema: responseSchema(await schemaFile.json()),
    },
    model: {
      model: config.ai.model === "sonnet" ? "opus" : config.ai.model,
      effort: config.ai.reasoningEffort,
      timeoutMs: config.ai.timeoutMs,
      // The transport derives its response buffer from this field. It must hold
      // five valid 200,000-character topic files plus the JSON envelope.
      maxOutputTokens: consolidationOutputTokens,
      maxInputCharacters: consolidationInputCharacters,
      maxBudgetUsd: config.ai.maxBudgetUsd,
    },
  };
}
