import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { assessableCriterionIdSchema } from "../packages/domain/src/agentic-potential-assessment.ts";
import {
  aiCapabilitySchema,
  confidenceLevelSchema,
  potentialLevelSchema,
} from "../packages/domain/src/opportunity-discovery.ts";
import { memoryTopicSchema } from "../packages/domain/src/memory.ts";

const text = z.string().trim().min(1).max(4_000);
const shortText = z.string().trim().min(1).max(500);
const belegId = z.string().regex(/^b\d+$/);

const documentSchema = z
  .object({
    source: z.string().regex(/^demo-data\/[a-zA-Z0-9_./-]+$/),
    targetName: z.string().trim().min(1).max(240),
    mediaType: z.enum(["md", "txt", "csv", "pdf"]),
  })
  .strict();

const conversationTurnSchema = z
  .object({
    assistant: text,
    userEvidenceId: belegId,
  })
  .strict();

const hypothesisSchema = z
  .object({
    stepOrder: z.number().int().min(1).max(8),
    title: shortText,
    currentSituation: text,
    aiContribution: text,
    aiCapabilities: z.array(aiCapabilitySchema).min(1).max(6),
    expectedChange: text,
    deterministicAutomation: z.array(shortText).max(10),
    requiredAccess: z.array(shortText).min(1).max(10),
    humanRole: text,
    potentialLevel: potentialLevelSchema,
    potentialRationale: text,
    confidenceLevel: confidenceLevelSchema,
    confidenceRationale: text,
    assumptions: z.array(text).max(10),
    openQuestions: z.array(text).max(10),
  })
  .strict();

const scenarioSchema = z
  .object({
    titles: z
      .object({
        assistive: shortText,
        delegated: shortText,
        agentic: shortText,
      })
      .strict(),
    summaries: z
      .object({ assistive: text, delegated: text, agentic: text })
      .strict(),
    targetStates: z
      .object({ assistive: text, delegated: text, agentic: text })
      .strict(),
    changesFromToday: z.array(text).min(1).max(10),
    aiResponsibilities: z.array(text).min(1).max(10),
    deterministicAutomation: z.array(text).max(10),
    orchestration: z.array(text).max(10),
    humanResponsibilities: z.array(text).min(1).max(10),
    humanOversight: z.array(text).min(1).max(10),
    informationAndDocuments: z.array(text).max(20),
    systemTargets: z.array(shortText).min(1).max(10),
    prerequisites: z.array(text).max(10),
    risks: z.array(text).max(10),
    assumptions: z.array(text).max(10),
    openQuestions: z.array(text).max(10),
    confidenceLevel: confidenceLevelSchema,
    confidenceRationale: text,
  })
  .strict();

const assessmentSchema = z
  .object({
    criterionId: assessableCriterionIdSchema,
    score: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    rationale: text,
  })
  .strict();

const memoryFactSchema = z
  .object({ topic: memoryTopicSchema, fact: text })
  .strict();

export const showcaseJourneyFixtureSchema = z
  .object({
    schemaVersion: z.literal(1),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    expectedScore: z.number().int().min(0).max(100),
    documents: z.array(documentSchema).max(3),
    conversation: z.array(conversationTurnSchema).min(5).max(10),
    hypotheses: z.array(hypothesisSchema).min(2).max(4),
    scenario: scenarioSchema,
    assessment: z.array(assessmentSchema).min(13).max(24),
    memoryFacts: z.array(memoryFactSchema).min(1).max(10),
  })
  .strict()
  .superRefine((fixture, ctx) => {
    const unique = (values: unknown[]) =>
      new Set(values).size === values.length;
    if (!unique(fixture.conversation.map((turn) => turn.userEvidenceId)))
      ctx.addIssue({
        code: "custom",
        path: ["conversation"],
        message: "Jeder Gesprächsbeleg darf nur einmal verwendet werden.",
      });
    if (!unique(fixture.hypotheses.map((item) => item.stepOrder)))
      ctx.addIssue({
        code: "custom",
        path: ["hypotheses"],
        message:
          "Hypothesen müssen unterschiedliche Prozessschritte betreffen.",
      });
    if (!unique(fixture.assessment.map((item) => item.criterionId)))
      ctx.addIssue({
        code: "custom",
        path: ["assessment"],
        message: "Bewertungskriterien müssen eindeutig sein.",
      });
  });

export type ShowcaseJourneyFixture = z.infer<
  typeof showcaseJourneyFixtureSchema
>;

export function showcaseJourneyRoot() {
  return (
    process.env.CLAIMS_AI_SHOWCASE_JOURNEYS ??
    join(process.cwd(), "demo-data", "journeys")
  );
}

export async function listShowcaseJourneyFixtures() {
  const root = showcaseJourneyRoot();
  const names = (await readdir(root))
    .filter((name) => name.endsWith(".json"))
    .sort();
  const fixtures: ShowcaseJourneyFixture[] = [];
  for (const name of names) {
    const raw = JSON.parse(await readFile(join(root, name), "utf8"));
    const parsed = showcaseJourneyFixtureSchema.safeParse(raw);
    if (!parsed.success)
      throw new Error(
        `Die Showcase-Journey „${name}" ist ungültig:\n${parsed.error.issues
          .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
          .join("\n")}`,
      );
    if (parsed.data.slug !== name.replace(/\.json$/, ""))
      throw new Error(
        `Die Showcase-Journey „${name}" trägt den abweichenden Slug „${parsed.data.slug}".`,
      );
    fixtures.push(parsed.data);
  }
  return fixtures;
}
