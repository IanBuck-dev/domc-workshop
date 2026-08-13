import { resolve } from "node:path";
import { agenticPotentialAssessmentConfigSchema } from "../../../packages/domain/src/agentic-potential-assessment.ts";
export async function loadAgenticAssessmentDefaults(rootOverride?: string) {
  const root =
    rootOverride ??
    process.env.CLAIMS_AI_DEFAULTS_DIR ??
    resolve(process.cwd(), "defaults");
  const [config, prompt, schema] = await Promise.all([
    Bun.file(resolve(root, "agentic-potential-assessment-config.json")).json(),
    Bun.file(resolve(root, "prompts/agentic-potential-assessment.md")).text(),
    Bun.file(
      resolve(root, "ai-schemas/agentic-potential-assessment.json"),
    ).json(),
  ]);
  if (
    !prompt.trim() ||
    prompt.length > 50_000 ||
    !schema ||
    typeof schema !== "object" ||
    Array.isArray(schema)
  )
    throw new Error(
      "Der Vertrag der agentischen Potenzialbewertung ist ungültig.",
    );
  return {
    config: agenticPotentialAssessmentConfigSchema.parse(config),
    contracts: { prompt, schema: schema as object },
  };
}
