import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import type { AssessmentAiAdapter } from "../packages/claude/src/assessment-ai-contracts";
import { assessmentConfigSchema } from "../packages/domain/src/assessment";
import { AssessmentRepository } from "../packages/storage/src/assessment-repository";
import { assessmentRoutes } from "../apps/server/src/routes/assessments";
import { comparisonRoutes } from "../apps/server/src/routes/comparisons";
import { rankingRoutes } from "../apps/server/src/routes/ranking";

const roots: string[] = [];
const config = assessmentConfigSchema.parse(
  await Bun.file("defaults/assessment-config.json").json(),
);
const trace = {
  operationId: crypto.randomUUID(),
  model: "test",
  sessionId: null,
  durationMs: 2,
  inputTokens: 3,
  outputTokens: 4,
  sandboxed: true,
};
const unsupported = async (): Promise<never> => {
  throw new Error("not used");
};
const ai: AssessmentAiAdapter = {
  evaluateGateway: async (request) => ({
    value: {
      decisions: request.questions.map((question) => ({
        questionId: question.id,
        decision: "no" as const,
        confidence: 90,
        rationale: "Keine ausreichenden Hinweise",
        evidence: [],
        assumptions: [],
      })),
      followUpQuestion: null,
    },
    trace,
  }),
  reevaluateGateway: unsupported,
  prefillForm: unsupported,
  chatTurn: unsupported,
  discussCriterion: unsupported,
  review: unsupported,
  reviewChat: unsupported,
};

afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);

describe("assessment API", () => {
  test("creates a frozen assessment, completes a no-signal gateway neutrally, and serves comparisons", async () => {
    const root = await mkdtemp(join(tmpdir(), "claims-api-"));
    roots.push(root);
    const repo = new AssessmentRepository(root);
    const app = new Hono();
    app.onError((error, c) => c.json({ error: error.message }, 400));
    app.route("/api/assessments", assessmentRoutes(repo, ai));
    app.route("/api/ranking", rankingRoutes(repo));
    app.route("/api/comparisons", comparisonRoutes(repo));
    const createdResponse = await app.request("/api/assessments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cover: {
          department: "Schaden",
          participantName: "Test Person",
          participantEmail: "test@example.invalid",
          processName: "Schadenprüfung",
        },
        mode: "form",
        config,
        demoDataConfirmed: true,
      }),
    });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()) as {
      id: string;
      configHash: string;
    };
    const answers = config.gateway.questions.map((question) => ({
      questionId: question.id,
      response: "Der Ablauf folgt vollständig festen Regeln.",
      responseKind: "description",
    }));
    const legacyChoiceResponse = await app.request(
      `/api/assessments/${created.id}/gateway/evaluate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: config.gateway.questions.map((question) => ({
            questionId: question.id,
            answer: "yes",
            context: "",
          })),
        }),
      },
    );
    expect(legacyChoiceResponse.status).toBe(400);
    const gatewayResponse = await app.request(
      `/api/assessments/${created.id}/gateway/evaluate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers }),
      },
    );
    expect(gatewayResponse.status).toBe(200);
    expect(((await gatewayResponse.json()) as { state: string }).state).toBe(
      "submitted_without_clear_ai_signal",
    );
    expect(await (await app.request("/api/ranking")).json()).toEqual([]);
    const duplicateResponse = await app.request(
      `/api/assessments/${created.id}/duplicate-for-comparison`,
      { method: "POST" },
    );
    const duplicate = (await duplicateResponse.json()) as {
      comparisonGroupId: string;
      configHash: string;
    };
    expect(duplicate.configHash).toBe(created.configHash);
    const comparisonResponse = await app.request(
      `/api/comparisons/${duplicate.comparisonGroupId}`,
    );
    expect(comparisonResponse.status).toBe(200);
    const comparison = (await comparisonResponse.json()) as {
      assessments: unknown[];
      metrics: unknown[];
      criterionDifferences: unknown[];
    };
    expect(comparison.assessments).toHaveLength(2);
    expect(comparison.metrics).toHaveLength(2);
    expect(comparison.criterionDifferences).toHaveLength(28);
    const ratingsResponse = await app.request(
      `/api/assessments/${created.id}/facilitator-ratings`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          completeness: 4,
          plausibility: 3,
          traceability: 5,
          userEffort: 2,
        }),
      },
    );
    expect(ratingsResponse.status).toBe(200);
    expect(
      (
        (await ratingsResponse.json()) as {
          metrics: { facilitatorRatings: { traceability: number } };
        }
      ).metrics.facilitatorRatings.traceability,
    ).toBe(5);
  });

  test("requires the unchanged per-session demo-data confirmation", async () => {
    const root = await mkdtemp(join(tmpdir(), "claims-api-"));
    roots.push(root);
    const app = new Hono();
    app.onError((error, c) => c.json({ error: error.message }, 400));
    app.route(
      "/api/assessments",
      assessmentRoutes(new AssessmentRepository(root), ai),
    );
    const response = await app.request("/api/assessments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cover: {},
        mode: "form",
        config,
        demoDataConfirmed: false,
      }),
    });
    expect(response.status).toBe(400);
  });

  test("prepares a bounded adaptive chat gateway before accepting descriptive evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "claims-api-"));
    roots.push(root);
    const repo = new AssessmentRepository(root);
    let elicitedQuestion = "";
    const adaptiveAi: AssessmentAiAdapter = {
      ...ai,
      prepareGateway: async (request) => ({
        value: {
          assistantMessage:
            "Beschreiben Sie den Ablauf bitte in Ihrer fachlichen Sprache.",
          questions: request.questions.map((question) => ({
            questionId: question.id,
            question: `Bei ${request.cover.processName}: ${question.userQuestion}`,
            recognitionAids: ["Fotos werden geprüft"],
          })),
        },
        trace,
      }),
      evaluateGateway: async (request) => {
        elicitedQuestion = request.questions[0]?.elicitedQuestion ?? "";
        return {
          value: {
            decisions: request.questions.map((question, index) => ({
              questionId: question.id,
              decision: index === 0 ? ("yes" as const) : ("no" as const),
              confidence: 90,
              rationale: "Nutzerbestätigte Beschreibung",
              evidence: [question.response],
              assumptions: [],
            })),
            followUpQuestion: null,
          },
          trace,
        };
      },
    };
    const app = new Hono();
    app.onError((error, c) => c.json({ error: error.message }, 400));
    app.route("/api/assessments", assessmentRoutes(repo, adaptiveAi));
    const record = await repo.create({
      cover: {
        department: "Schaden",
        participantName: "Test Person",
        participantEmail: "test@example.invalid",
        processName: "App-Schadenmeldung",
        currentProcessDescription:
          "Die Meldung kommt über die App und landet im CRM.",
      },
      mode: "chat",
      config,
    });
    const answers = config.gateway.questions.map((question) => ({
      questionId: question.id,
      response: "Trifft zu: Fotos werden geprüft",
      responseKind: "description",
    }));
    const premature = await app.request(
      `/api/assessments/${record.id}/gateway/evaluate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers }),
      },
    );
    expect(premature.status).toBe(400);
    const prepared = await app.request(
      `/api/assessments/${record.id}/gateway/prepare`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ selectedUploadIds: [] }),
      },
    );
    expect(prepared.status).toBe(200);
    const preparedRecord = (await prepared.json()) as {
      gateway: {
        decisions: unknown[];
        elicitation: {
          questions: Array<{ recognitionAids: string[] }>;
        };
      };
    };
    expect(preparedRecord.gateway.decisions).toEqual([]);
    expect(
      preparedRecord.gateway.elicitation.questions[0]?.recognitionAids,
    ).toEqual(["Fotos werden geprüft"]);
    const evaluated = await app.request(
      `/api/assessments/${record.id}/gateway/evaluate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers }),
      },
    );
    expect(evaluated.status).toBe(200);
    expect(elicitedQuestion).toContain("App-Schadenmeldung");
  });

  test("asks one combined gateway follow-up even when another answer is already yes", async () => {
    const root = await mkdtemp(join(tmpdir(), "claims-api-"));
    roots.push(root);
    const repo = new AssessmentRepository(root);
    const gatewayAi: AssessmentAiAdapter = {
      ...ai,
      evaluateGateway: async (request) => ({
        value: {
          decisions: request.questions.map((question, index) => ({
            questionId: question.id,
            decision:
              index === 0
                ? ("yes" as const)
                : index === 1
                  ? ("unclear" as const)
                  : ("no" as const),
            confidence: 80,
            rationale: "Test",
            evidence: [],
            assumptions: [],
          })),
          followUpQuestion: "Welche unstrukturierten Unterlagen fallen an?",
        },
        trace,
      }),
      reevaluateGateway: async (request) => ({
        value: {
          decisions: request.questions.map((question, index) => ({
            questionId: question.id,
            decision: index === 0 ? ("yes" as const) : ("no" as const),
            confidence: 90,
            rationale: "Nach Rückfrage geklärt",
            evidence: [request.followUpAnswer],
            assumptions: [],
          })),
          followUpQuestion: null,
        },
        trace,
      }),
    };
    const app = new Hono();
    app.onError((error, c) => c.json({ error: error.message }, 400));
    app.route("/api/assessments", assessmentRoutes(repo, gatewayAi));
    const record = await repo.create({
      cover: {
        department: "Schaden",
        participantName: "Test Person",
        participantEmail: "test@example.invalid",
        processName: "Schadenprüfung",
      },
      mode: "form",
      config,
    });
    const evaluated = await app.request(
      `/api/assessments/${record.id}/gateway/evaluate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: config.gateway.questions.map((question) => ({
            questionId: question.id,
            response: "Weiß ich nicht",
            responseKind: "unknown",
          })),
        }),
      },
    );
    expect(evaluated.status).toBe(200);
    expect((await evaluated.json()) as object).toEqual(
      expect.objectContaining({
        state: "gateway_in_progress",
        gateway: expect.objectContaining({
          followUpQuestion: "Welche unstrukturierten Unterlagen fallen an?",
          followUpsUsed: 0,
          final: false,
        }),
      }),
    );
    const followedUp = await app.request(
      `/api/assessments/${record.id}/gateway/follow-up`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer: "Freitexte und PDF-Dokumente." }),
      },
    );
    expect(followedUp.status).toBe(200);
    expect((await followedUp.json()) as object).toEqual(
      expect.objectContaining({
        state: "criteria_in_progress",
        gateway: expect.objectContaining({ followUpsUsed: 1, final: true }),
      }),
    );
    expect(
      (
        await app.request(`/api/assessments/${record.id}/gateway/follow-up`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answer: "Noch eine Antwort" }),
        })
      ).status,
    ).toBe(400);
  });

  test("streams chat turns as AI SDK UI messages and persists the result", async () => {
    const root = await mkdtemp(join(tmpdir(), "claims-api-"));
    roots.push(root);
    const repo = new AssessmentRepository(root);
    let record = await repo.create({
      cover: {
        department: "Schaden",
        participantName: "Test Person",
        participantEmail: "test@example.invalid",
        processName: "Schadenprüfung",
      },
      mode: "chat",
      config,
    });
    record = await repo.saveGateway(record.id, {
      userAnswers: config.gateway.questions.map((question) => ({
        questionId: question.id,
        response: "Mehrere Unterlagen werden fachlich zusammengeführt.",
        responseKind: "description" as const,
      })),
      decisions: config.gateway.questions.map((question) => ({
        questionId: question.id,
        decision: "yes" as const,
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
      operation: trace,
    });
    const visitedSections: string[] = [];
    const streamAi: AssessmentAiAdapter = {
      ...ai,
      chatTurn: async (request) => {
        visitedSections.push(request.section.id);
        return {
          value: {
            message: "Die Angaben dieses Bereichs wurden aufgenommen.",
            proposals: [],
            askFollowUp: false,
          },
          trace,
        };
      },
    };
    const app = new Hono();
    app.route("/api/assessments", assessmentRoutes(repo, streamAi));
    const response = await app.request(`/api/assessments/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Wir sparen Bearbeitungszeit." }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("x-vercel-ai-ui-message-stream")).toBe("v1");
    const body = await response.text();
    expect(body).toContain('"type":"text-delta"');
    expect(body).toContain('"type":"data-assessment"');
    expect(body).toContain("Die Angaben dieses Bereichs wurden aufgenommen.");
    const secondResponse = await app.request(
      `/api/assessments/${record.id}/chat`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Nun zur strategischen Wirkung." }),
      },
    );
    expect(secondResponse.status).toBe(200);
    await secondResponse.text();
    expect(visitedSections).toEqual(["financial", "strategic"]);
    expect(await repo.chatEvidence(record.id)).toContainEqual({
      role: "user",
      content: "Wir sparen Bearbeitungszeit.",
    });
  });

  test("rejects stale or exhausted reviewer chats before invoking AI", async () => {
    const root = await mkdtemp(join(tmpdir(), "claims-api-"));
    roots.push(root);
    const repo = new AssessmentRepository(root);
    let reviewCalls = 0;
    const reviewAi: AssessmentAiAdapter = {
      ...ai,
      reviewChat: async () => {
        reviewCalls++;
        return { value: { message: "Nicht aufrufen" }, trace };
      },
    };
    const app = new Hono();
    app.onError((error, c) => c.json({ error: error.message }, 400));
    app.route("/api/assessments", assessmentRoutes(repo, reviewAi));

    async function reviewedAssessment() {
      let record = await repo.create({
        cover: {
          department: "Schaden",
          participantName: "Test Person",
          participantEmail: "test@example.invalid",
          processName: "Schadenprüfung",
        },
        mode: "chat",
        config,
      });
      record = await repo.saveGateway(record.id, {
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
        operation: trace,
      });
      record = await repo.applyAiCriteria(
        record.id,
        record.criteria.map((item) => {
          const definition = config.criteria.find(
            (criterion) => criterion.id === item.criterionId,
          )!;
          return {
            ...item,
            value:
              definition.inputType === "boolean"
                ? false
                : definition.inputType === "currency"
                  ? 1_000
                  : 1,
            source: "ai" as const,
            confirmation: "pending" as const,
            rationale: "Test",
            confidence: 80,
            updatedBy: "ai" as const,
            updatedAt: new Date().toISOString(),
          };
        }),
        trace,
      );
      return repo.saveReview(record.id, {
        id: crypto.randomUUID(),
        status: "current",
        reviewedCriteriaUpdatedAt: record.updatedAt,
        deterministicWarnings: [],
        findings: [],
        chatMessagesUsed: 0,
        operation: trace,
        createdAt: new Date().toISOString(),
      });
    }

    let exhausted = await reviewedAssessment();
    for (let index = 0; index < config.ai.reviewerChatLimit; index++)
      exhausted = await repo.recordReviewChat(
        exhausted.id,
        `Frage ${index + 1}`,
        `Antwort ${index + 1}`,
        trace,
      );
    const exhaustedResponse = await app.request(
      `/api/assessments/${exhausted.id}/review/chat`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Noch eine Frage" }),
      },
    );
    expect(exhaustedResponse.status).toBe(400);

    let stale = await reviewedAssessment();
    stale = await repo.setCriterion(stale.id, "annual-savings", 2_000);
    expect(stale.review?.status).toBe("stale");
    const staleResponse = await app.request(
      `/api/assessments/${stale.id}/review/chat`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Frage zur alten Prüfung" }),
      },
    );
    expect(staleResponse.status).toBe(400);
    expect(reviewCalls).toBe(0);
  });

  test("records a failed AI operation without changing canonical input", async () => {
    const root = await mkdtemp(join(tmpdir(), "claims-api-"));
    roots.push(root);
    const repo = new AssessmentRepository(root);
    const record = await repo.create({
      cover: {
        department: "Schaden",
        participantName: "Test Person",
        participantEmail: "test@example.invalid",
        processName: "Schadenprüfung",
      },
      mode: "form",
      config,
    });
    const failingAi: AssessmentAiAdapter = {
      ...ai,
      evaluateGateway: async () => {
        throw new Error("simulierter Providerfehler");
      },
    };
    const app = new Hono();
    app.onError((error, c) => c.json({ error: error.message }, 500));
    app.route("/api/assessments", assessmentRoutes(repo, failingAi));
    const response = await app.request(
      `/api/assessments/${record.id}/gateway/evaluate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: config.gateway.questions.map((question) => ({
            questionId: question.id,
            response: "Trifft in diesem Prozess nicht zu",
            responseKind: "not_applicable",
          })),
        }),
      },
    );
    expect(response.status).toBe(500);
    expect((await repo.get(record.id))?.state).toBe("gateway_in_progress");
    expect(await repo.history(record.id)).toContainEqual(
      expect.objectContaining({
        event: "ai-operation-error",
        detail: expect.objectContaining({ operationName: "gateway-evaluate" }),
      }),
    );
  });
});
