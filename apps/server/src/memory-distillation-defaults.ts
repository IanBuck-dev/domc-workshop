import { resolve } from "node:path";
import type { MemoryDistillationContracts } from "../../../packages/claude/src/memory-distillation-contracts.ts";

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
    !(
      (value as Record<string, unknown>).properties as
        Record<string, unknown> | undefined
    )?.operations
  )
    throw new Error("Ungültiges KI-Antwortschema: memory-distillation");
  return freeze(structuredClone(value as object));
}

export async function loadMemoryDistillationDefaults(
  rootOverride?: string,
): Promise<MemoryDistillationContracts> {
  const root =
    rootOverride ??
    process.env.CLAIMS_AI_DEFAULTS_DIR ??
    resolve(process.cwd(), "defaults");
  const promptFile = Bun.file(
    resolve(root, "prompts", "memory-distillation.md"),
  );
  const schemaFile = Bun.file(
    resolve(root, "ai-schemas", "memory-distillation.json"),
  );
  if (!(await promptFile.exists()))
    throw new Error("Fehlender KI-Prompt: memory-distillation");
  if (!(await schemaFile.exists()))
    throw new Error("Fehlendes KI-Antwortschema: memory-distillation");
  const prompt = await promptFile.text();
  if (!prompt.trim() || prompt.length > 50_000)
    throw new Error("Ungültiger KI-Prompt: memory-distillation");
  return { prompt, responseSchema: responseSchema(await schemaFile.json()) };
}
