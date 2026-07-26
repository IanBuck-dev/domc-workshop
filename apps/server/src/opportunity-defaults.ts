import { resolve } from "node:path";
import {
  opportunityDiscoveryConfigSchema,
  type OpportunityContractSnapshot,
} from "../../../packages/domain/src/opportunity-discovery.ts";

function schema(value: unknown, name: string) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (value as Record<string, unknown>).type !== "object"
  )
    throw new Error(`Ungültiges KI-Antwortschema: ${name}`);
  return value as object;
}

export async function loadOpportunityDefaults(rootOverride?: string) {
  const root =
    rootOverride ??
    process.env.CLAIMS_AI_DEFAULTS_DIR ??
    resolve(process.cwd(), "defaults");
  const prompt = async (name: string) => {
    const file = Bun.file(resolve(root, "prompts", `${name}.md`));
    if (!(await file.exists())) throw new Error(`Fehlender KI-Prompt: ${name}`);
    const text = await file.text();
    if (!text.trim() || text.length > 50_000)
      throw new Error(`Ungültiger KI-Prompt: ${name}`);
    return text;
  };
  const jsonSchema = async (name: string) => {
    const file = Bun.file(resolve(root, "ai-schemas", `${name}.json`));
    if (!(await file.exists()))
      throw new Error(`Fehlendes KI-Antwortschema: ${name}`);
    return schema(await file.json(), name);
  };
  const [
    config,
    basePrompt,
    hypothesesPrompt,
    scenariosPrompt,
    hypothesesSchema,
    scenariosSchema,
  ] = await Promise.all([
    Bun.file(resolve(root, "opportunity-discovery-config.json"))
      .json()
      .then((value) => opportunityDiscoveryConfigSchema.parse(value)),
    prompt("opportunity-base"),
    prompt("opportunity-hypotheses"),
    prompt("opportunity-scenarios"),
    jsonSchema("opportunity-hypotheses"),
    jsonSchema("opportunity-scenarios"),
  ]);
  const contracts: OpportunityContractSnapshot = {
    basePrompt,
    hypothesesPrompt,
    scenariosPrompt,
    hypothesesSchema,
    scenariosSchema,
  };
  return { config, contracts };
}
