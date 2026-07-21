import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Hono } from "hono";
import { comparisonRoutes } from "../apps/server/src/routes/comparisons";
import { assessmentConfigSchema } from "../packages/domain/src/assessment";
import { AssessmentRepository } from "../packages/storage/src/assessment-repository";

const roots: string[] = [];
const config = assessmentConfigSchema.parse(
  await Bun.file("defaults/assessment-config.json").json(),
);
const cover = {
  department: "Schaden",
  participantName: "Workshop Test",
  participantEmail: "workshop@example.invalid",
  processName: "Vergleichsprozess",
};
const operation = {
  operationId: crypto.randomUUID(),
  model: "test-model",
  sessionId: null,
  durationMs: 5,
  inputTokens: 10,
  outputTokens: 20,
};

afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);

async function qualify(repo: AssessmentRepository, id: string) {
  const record = await repo.get(id);
  if (!record) throw new Error("missing test assessment");
  return repo.saveGateway(id, {
    userAnswers: [],
    decisions: config.gateway.questions.map((question, index) => ({
      questionId: question.id,
      decision: index === 0 ? ("yes" as const) : ("no" as const),
      confidence: 90,
      rationale: "Test",
      evidence: [],
      assumptions: [],
    })),
    followUpQuestion: null,
    followUpAnswer: null,
    followUpsUsed: 0,
    final: true,
    hasClearAiSignal: true,
    operation,
  });
}

async function complete(
  repo: AssessmentRepository,
  id: string,
  annualSavings: number,
) {
  let record = await qualify(repo, id);
  for (const criterion of record.configSnapshot.criteria) {
    const value =
      criterion.id === "annual-savings"
        ? annualSavings
        : criterion.inputType === "boolean"
          ? false
          : criterion.inputType === "currency"
            ? 1_000
            : 1;
    record = await repo.setCriterion(id, criterion.id, value);
  }
  record = await repo.saveReview(id, {
    id: crypto.randomUUID(),
    status: "current",
    reviewedCriteriaUpdatedAt: record.updatedAt,
    deterministicWarnings: [],
    findings: [],
    chatMessagesUsed: 0,
    operation,
    createdAt: new Date().toISOString(),
  });
  return repo.confirmAssessment(id);
}

describe("assessment comparison", () => {
  test("compares equal snapshots with ranks, model usage, tokens and criterion differences", async () => {
    const root = await mkdtemp(join(tmpdir(), "claims-comparison-"));
    roots.push(root);
    const repo = new AssessmentRepository(root);
    const form = await repo.create({ cover, mode: "form", config });
    const chat = await repo.duplicateForComparison(form.id);
    const completedForm = await complete(repo, form.id, 10_000);
    const completedChat = await complete(repo, chat.id, 20_000);
    const app = new Hono();
    app.route("/api/comparisons", comparisonRoutes(repo));
    const response = await app.request(
      `/api/comparisons/${completedChat.comparisonGroupId}`,
    );
    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      assessments: Array<{ id: string }>;
      metrics: Array<Record<string, unknown>>;
      criterionDifferences: Array<{
        criterionId: string;
        differs: boolean;
      }>;
    };
    expect(result.assessments).toHaveLength(2);
    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assessmentId: completedForm.id,
          model: "sonnet",
          inputTokens: 20,
          outputTokens: 40,
          rank: expect.any(Number),
        }),
        expect.objectContaining({
          assessmentId: completedChat.id,
          model: "sonnet",
          inputTokens: 20,
          outputTokens: 40,
          rank: expect.any(Number),
        }),
      ]),
    );
    expect(
      result.criterionDifferences.find(
        (item) => item.criterionId === "annual-savings",
      )?.differs,
    ).toBe(true);
  });
});
