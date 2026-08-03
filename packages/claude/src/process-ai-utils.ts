import { resolve } from "node:path";

export async function loadProcessPrompt(
  name: "process-base" | "process-follow-ups" | "process-synthesis",
  rootOverride?: string,
) {
  const root =
    rootOverride ??
    process.env.CLAIMS_AI_DEFAULTS_DIR ??
    resolve(process.cwd(), "defaults");
  const file = Bun.file(resolve(root, "prompts", `${name}.md`));
  if (!(await file.exists()))
    throw new Error(`Missing versioned AI prompt: ${name}.md`);
  const text = await file.text();
  if (!text.trim() || text.length > 50_000)
    throw new Error(`Invalid versioned AI prompt: ${name}.md`);
  return text;
}
export async function loadChatCaptureContracts(rootOverride?: string) {
  const root =
    rootOverride ??
    process.env.CLAIMS_AI_DEFAULTS_DIR ??
    resolve(process.cwd(), "defaults");
  const [prompt, schema] = await Promise.all([
    Bun.file(resolve(root, "prompts", "process-chat.md")).text(),
    Bun.file(resolve(root, "ai-schemas", "process-understanding.json")).json(),
  ]);
  if (
    !prompt.trim() ||
    prompt.length > 50_000 ||
    !schema ||
    typeof schema !== "object" ||
    Array.isArray(schema)
  )
    throw new Error("Invalid Chat Capture contracts.");
  return { prompt, schema: schema as object };
}
export function composeProcessSystemPrompt(
  basePrompt: string,
  operationPrompt: string,
  configurableInstruction: string,
) {
  return `${basePrompt}\n\n${composeProcessOperationPrompt(operationPrompt, configurableInstruction)}`;
}
export function composeProcessOperationPrompt(
  operationPrompt: string,
  configurableInstruction: string,
) {
  return `${operationPrompt}\n\n## Konfigurierbare Anweisung\n${configurableInstruction}`;
}
export async function loadProcessSchema(
  name: "process-follow-ups" | "process-understanding",
) {
  const root =
    process.env.CLAIMS_AI_DEFAULTS_DIR ?? resolve(process.cwd(), "defaults");
  const file = Bun.file(resolve(root, "ai-schemas", `${name}.json`));
  if (!(await file.exists()))
    throw new Error(`Missing versioned AI schema: ${name}.json`);
  const value: unknown = await file.json();
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (value as Record<string, unknown>).type !== "object"
  )
    throw new Error(`Invalid versioned AI schema: ${name}.json`);
  return value as object;
}
export function boundedProcessJson(value: unknown, limit: number) {
  const json = JSON.stringify(value, null, 2);
  if (json.length > limit)
    throw new Error(
      "Der ausgewählte Prozesskontext überschreitet das sichere KI-Eingabelimit.",
    );
  return json;
}
