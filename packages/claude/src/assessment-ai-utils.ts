import { resolve } from "node:path";
import type { ZodType } from "zod";
import type {
  AiCriterionDefinition,
  AiExecutionContext,
  AiOperationResult,
} from "./assessment-ai-contracts.ts";
import type {
  CriteriaProposalsResult,
  ReviewResult,
} from "./response-schemas.ts";

export async function loadPrompt(
  name:
    "gateway" | "gateway-elicitation" | "form-prefill" | "chat" | "reviewer",
) {
  const root =
    process.env.CLAIMS_AI_DEFAULTS_DIR ?? resolve(process.cwd(), "defaults");
  const file = Bun.file(resolve(root, "prompts", `${name}.md`));
  if (!(await file.exists()))
    throw new Error(`Missing versioned AI prompt: ${name}.md`);
  const text = await file.text();
  if (!text.trim() || text.length > 50_000)
    throw new Error(`Invalid versioned AI prompt: ${name}.md`);
  return text;
}

export async function loadResponseJsonSchema(
  name:
    | "gateway-result"
    | "gateway-elicitation"
    | "criteria-proposals"
    | "review-result"
    | "review-chat",
) {
  const root =
    process.env.CLAIMS_AI_DEFAULTS_DIR ?? resolve(process.cwd(), "defaults");
  const file = Bun.file(resolve(root, "ai-schemas", `${name}.json`));
  if (!(await file.exists()))
    throw new Error(`Missing versioned AI response schema: ${name}.json`);
  const value: unknown = await file.json();
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (value as Record<string, unknown>).type !== "object" ||
    typeof (value as Record<string, unknown>).properties !== "object"
  )
    throw new Error(`Invalid versioned AI response schema: ${name}.json`);
  return value as object;
}

export function systemPrompt(base: string, context: AiExecutionContext) {
  return `${base}\n\n## Konfigurierbare Workshop-Anweisung\n${context.instructions}`;
}

export function boundedJson(value: unknown, maximumCharacters: number) {
  const json = JSON.stringify(value, null, 2);
  if (json.length > maximumCharacters)
    throw new Error(
      "The selected assessment context exceeds the configured AI input limit.",
    );
  return json;
}

function numericValue(value: number | boolean) {
  return typeof value === "boolean" ? Number(value) : value;
}

export function assertCriteriaProposals(
  result: AiOperationResult<CriteriaProposalsResult>,
  criteria: AiCriterionDefinition[],
  questionsRemaining?: number,
) {
  const byId = new Map(criteria.map((criterion) => [criterion.id, criterion]));
  const seen = new Set<string>();
  for (const proposal of result.value.proposals) {
    const criterion = byId.get(proposal.criterionId);
    if (!criterion)
      throw new Error(`AI proposed unknown criterion: ${proposal.criterionId}`);
    if (seen.has(proposal.criterionId))
      throw new Error(
        `AI proposed a criterion more than once: ${proposal.criterionId}`,
      );
    seen.add(proposal.criterionId);
    const numeric = numericValue(proposal.value);
    if (
      criterion.inputType === "boolean" &&
      typeof proposal.value !== "boolean"
    )
      throw new Error(`AI proposed a non-boolean value for ${criterion.id}`);
    if (
      criterion.inputType !== "boolean" &&
      typeof proposal.value === "boolean"
    )
      throw new Error(`AI proposed a boolean value for ${criterion.id}`);
    if (criterion.inputType === "integer" && !Number.isInteger(numeric))
      throw new Error(`AI proposed a non-integer value for ${criterion.id}`);
    if (numeric < criterion.minimum || numeric > criterion.maximum)
      throw new Error(`AI proposed an out-of-range value for ${criterion.id}`);
  }
  if ((questionsRemaining ?? 1) <= 0 && result.value.askFollowUp)
    throw new Error(
      "AI requested a follow-up after the section question budget was exhausted.",
    );
  return result;
}

export function assertReviewResult(
  result: AiOperationResult<ReviewResult>,
  criteria: AiCriterionDefinition[],
) {
  const byId = new Map(criteria.map((criterion) => [criterion.id, criterion]));
  const findingIds = new Set<string>();
  const findings = result.value.findings.map((finding) => ({
    ...finding,
    criterionIds: finding.criterionIds.filter((criterionId) =>
      byId.has(criterionId),
    ),
  }));
  for (const finding of findings) {
    if (findingIds.has(finding.id))
      throw new Error(`Duplicate review finding ID: ${finding.id}`);
    findingIds.add(finding.id);
    const correction = finding.proposedCorrection;
    if (!correction) continue;
    const criterion = byId.get(correction.criterionId);
    if (!criterion)
      throw new Error(
        `Review correction references unknown criterion: ${correction.criterionId}`,
      );
    const numeric = numericValue(correction.value);
    if (
      criterion.inputType === "boolean" &&
      typeof correction.value !== "boolean"
    )
      throw new Error(
        `Review proposed a non-boolean correction for ${criterion.id}`,
      );
    if (
      criterion.inputType !== "boolean" &&
      typeof correction.value === "boolean"
    )
      throw new Error(
        `Review proposed a boolean correction for ${criterion.id}`,
      );
    if (criterion.inputType === "integer" && !Number.isInteger(numeric))
      throw new Error(
        `Review proposed a non-integer correction for ${criterion.id}`,
      );
    if (numeric < criterion.minimum || numeric > criterion.maximum)
      throw new Error(
        `Review proposed an out-of-range correction for ${criterion.id}`,
      );
  }
  return { ...result, value: { ...result.value, findings } };
}

export function parseAsset<T>(
  schema: ZodType<T>,
  raw: unknown,
  label: string,
): T {
  const result = schema.safeParse(raw);
  if (!result.success)
    throw new Error(`Invalid ${label}: ${result.error.message}`);
  return result.data;
}
