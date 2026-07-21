import { Hono } from "hono";
import { z } from "zod";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import type {
  AssessmentAiAdapter,
  AiModelConfig,
  SelectedUpload,
} from "../../../../packages/claude/src/assessment-ai-contracts.ts";
import {
  assessmentConfigSchema,
  criterionValueSchema,
  gatewayEvaluationQuestion,
  gatewayHelpText,
  gatewayResponseKindFor,
  gatewaySubmissionAnswerSchema,
  gatewayUserQuestion,
  validateCriterionValue,
  type AssessmentRecord,
  type CriterionValue,
  type ReviewFinding,
  type ReviewRecord,
} from "../../../../packages/domain/src/assessment.ts";
import type { AssessmentRepository } from "../../../../packages/storage/src/assessment-repository.ts";

const createSchema = z.object({
  cover: z.unknown(),
  mode: z.enum(["form", "chat"]),
  config: assessmentConfigSchema,
  demoDataConfirmed: z.literal(true),
});
const selectedUploadsSchema = z.object({
  selectedUploadIds: z.array(z.string().uuid()).max(30).default([]),
});
const gatewayBodySchema = selectedUploadsSchema.extend({
  answers: z.array(gatewaySubmissionAnswerSchema).length(4),
});
const chatBodySchema = selectedUploadsSchema.extend({
  sectionId: z.string().min(1).optional(),
  userMessage: z.string().trim().min(1).max(20_000).optional(),
  message: z.string().trim().min(1).max(20_000).optional(),
  followUp: z.boolean().default(false),
  criterionId: z.string().optional(),
});

function aiModel(record: AssessmentRecord): AiModelConfig {
  const { reasoningEffort, ...rest } = record.configSnapshot.ai;
  return { ...rest, effort: reasoningEffort };
}

function context(
  record: AssessmentRecord,
  instructions: string,
  selectedUploads: SelectedUpload[] = [],
) {
  return {
    assessmentId: record.id,
    configHash: record.configHash,
    model: aiModel(record),
    instructions,
    selectedUploads,
  };
}

function selectedUploads(
  repo: AssessmentRepository,
  record: AssessmentRecord,
  ids: string[],
) {
  const selected = new Set(ids);
  if (selected.size !== ids.length)
    throw new Error("Dateien dürfen nicht doppelt ausgewählt werden.");
  return ids.map((id) => {
    const upload = record.uploads.find((item) => item.id === id);
    if (!upload)
      throw new Error(
        "Eine ausgewählte Datei gehört nicht zu dieser Bewertung.",
      );
    return {
      id,
      name: upload.name,
      path: repo.uploadPath(record.id, id, upload.name),
      size: upload.size,
      sha256: upload.sha256,
    };
  });
}

function gatewayQuestionDefinitions(record: AssessmentRecord) {
  return [...record.configSnapshot.gateway.questions]
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((question) => ({
      id: question.id,
      name: question.name,
      evaluationQuestion: gatewayEvaluationQuestion(question),
      userQuestion: gatewayUserQuestion(question),
      helpText: gatewayHelpText(question),
      displayOrder: question.displayOrder,
    }));
}

function proposalValues(
  record: AssessmentRecord,
  proposals: Array<{
    criterionId: string;
    value: number | boolean;
    rationale: string;
    evidence: string[];
    confidence: number;
  }>,
): CriterionValue[] {
  const now = new Date().toISOString();
  return proposals.map((proposal) =>
    criterionValueSchema.parse({
      ...proposal,
      source: "ai",
      confirmation: "pending",
      updatedBy: "ai",
      updatedAt: now,
    }),
  );
}

function writeAssistantText(
  writer: Parameters<
    Parameters<typeof createUIMessageStream>[0]["execute"]
  >[0]["writer"],
  message: string,
) {
  const textId = crypto.randomUUID();
  writer.write({ type: "text-start", id: textId });
  for (let offset = 0; offset < message.length; offset += 120)
    writer.write({
      type: "text-delta",
      id: textId,
      delta: message.slice(offset, offset + 120),
    });
  writer.write({ type: "text-end", id: textId });
}

function safeStreamError() {
  return "Die Aktion konnte nicht abgeschlossen werden. Ihre bisherigen Angaben bleiben erhalten.";
}

async function auditedAiOperation<T>(
  repo: AssessmentRepository,
  assessmentId: string,
  operationName: string,
  action: () => Promise<T>,
) {
  try {
    return await action();
  } catch (error) {
    await repo.recordAiOperationError(assessmentId, operationName, error);
    throw error;
  }
}

function deterministicWarnings(record: AssessmentRecord): ReviewFinding[] {
  return record.configSnapshot.criteria
    .filter((criterion) => criterion.inputType === "currency")
    .flatMap((criterion) => {
      const value = record.criteria.find(
        (item) => item.criterionId === criterion.id,
      )?.value;
      return typeof value === "number" &&
        value >= record.configSnapshot.scoring.plausibilityWarningAmount
        ? [
            {
              id: `amount-${criterion.id}`,
              severity: "warning" as const,
              criterionIds: [criterion.id],
              evidence: [
                `Eingetragener Wert: ${value.toLocaleString("de-DE")} EUR`,
              ],
              explanation:
                "Der Betrag überschreitet die konfigurierte Plausibilitätsgrenze. Bitte prüfen Sie insbesondere zusätzliche Nullen und Dezimalstellen.",
              proposedCorrection: null,
              acknowledgedAt: null,
            },
          ]
        : [];
    });
}

export function assessmentRoutes(
  repo: AssessmentRepository,
  ai: AssessmentAiAdapter,
) {
  const app = new Hono();
  app.get("/", async (c) => c.json(await repo.list()));
  app.post("/", async (c) => {
    const body = createSchema.parse(await c.req.json());
    return c.json(await repo.create(body), 201);
  });
  app.get("/:id", async (c) => {
    const record = await repo.get(c.req.param("id"));
    return record ? c.json(record) : c.json({ error: "Nicht gefunden" }, 404);
  });
  app.get("/:id/history", async (c) =>
    c.json(await repo.history(c.req.param("id"))),
  );
  app.get("/:id/chat-history", async (c) =>
    c.json(await repo.chatMessages(c.req.param("id"))),
  );
  app.post("/:id/duplicate-for-comparison", async (c) =>
    c.json(await repo.duplicateForComparison(c.req.param("id")), 201),
  );

  app.post("/:id/gateway/prepare", async (c) => {
    const record = await required(repo, c.req.param("id"));
    if (record.mode !== "chat" || record.state !== "gateway_in_progress")
      throw new Error(
        "Die adaptive Prozessaufnahme ist in diesem Status nicht verfügbar.",
      );
    if (!ai.prepareGateway)
      throw new Error("Die adaptive Prozessaufnahme ist nicht konfiguriert.");
    const { selectedUploadIds } = selectedUploadsSchema.parse(
      await c.req.json().catch(() => ({})),
    );
    const result = await auditedAiOperation(
      repo,
      record.id,
      "gateway-prepare",
      () =>
        ai.prepareGateway!({
          ...context(
            record,
            record.configSnapshot.instructions.gateway,
            selectedUploads(repo, record, selectedUploadIds),
          ),
          cover: record.cover,
          questions: gatewayQuestionDefinitions(record),
        }),
    );
    return c.json(
      await repo.saveGatewayElicitation(
        record.id,
        { ...result.value, operation: result.trace },
        selectedUploadIds,
      ),
    );
  });

  app.post("/:id/gateway/evaluate", async (c) => {
    const record = await required(repo, c.req.param("id"));
    if (record.mode === "chat" && !record.gateway.elicitation)
      throw new Error("Bitte starten Sie zuerst die adaptive Prozessaufnahme.");
    const parsedBody = gatewayBodySchema.parse(await c.req.json());
    const selectedUploadIds = parsedBody.selectedUploadIds;
    const answers = parsedBody.answers.map((answer) => ({
      ...answer,
      responseKind: gatewayResponseKindFor(
        answer.response,
        answer.responseKind,
      ),
    }));
    const expectedIds = record.configSnapshot.gateway.questions
      .map((item) => item.id)
      .sort();
    if (
      answers
        .map((item) => item.questionId)
        .sort()
        .join("|") !== expectedIds.join("|")
    )
      throw new Error("Bitte beantworten Sie jede Gateway-Frage genau einmal.");
    const answerById = new Map(answers.map((item) => [item.questionId, item]));
    const result = await auditedAiOperation(
      repo,
      record.id,
      "gateway-evaluate",
      () =>
        ai.evaluateGateway({
          ...context(
            record,
            record.configSnapshot.instructions.gateway,
            selectedUploads(repo, record, selectedUploadIds),
          ),
          cover: record.cover,
          questions: [...record.configSnapshot.gateway.questions]
            .sort((left, right) => left.displayOrder - right.displayOrder)
            .map((question) => {
              const answer = answerById.get(question.id)!;
              return {
                id: question.id,
                name: question.name,
                evaluationQuestion: gatewayEvaluationQuestion(question),
                userQuestion: gatewayUserQuestion(question),
                helpText: gatewayHelpText(question),
                displayOrder: question.displayOrder,
                elicitedQuestion: record.gateway.elicitation?.questions.find(
                  (item) => item.questionId === question.id,
                )?.question,
                response: answer.response,
                responseKind: answer.responseKind,
              };
            }),
          followUpAllowed: record.configSnapshot.gateway.maxFollowUps > 0,
        }),
    );
    const unclear = result.value.decisions.some(
      (item) => item.decision === "unclear",
    );
    if (
      result.value.decisions
        .map((item) => item.questionId)
        .sort()
        .join("|") !== expectedIds.join("|")
    )
      throw new Error(
        "Die KI-Antwort enthält nicht genau die konfigurierten Gateway-Fragen.",
      );
    const followUpQuestion = unclear ? result.value.followUpQuestion : null;
    if (
      unclear &&
      record.configSnapshot.gateway.maxFollowUps > 0 &&
      !followUpQuestion
    ) {
      const error = new Error(
        "Die KI-Antwort benötigt bei unklaren Einstiegsfragen genau eine gebündelte Rückfrage.",
      );
      await repo.recordAiOperationError(record.id, "gateway-evaluate", error);
      throw error;
    }
    const gateway = {
      userAnswers: answers,
      selectedUploadIds,
      elicitation: record.gateway.elicitation,
      decisions: result.value.decisions,
      followUpQuestion,
      followUpAnswer: null,
      followUpsUsed: 0,
      final: !followUpQuestion,
      hasClearAiSignal: followUpQuestion
        ? null
        : result.value.decisions.some((item) => item.decision === "yes"),
      operation: result.trace,
    };
    return c.json(await repo.saveGateway(record.id, gateway));
  });
  app.post("/:id/gateway/follow-up", async (c) => {
    const record = await required(repo, c.req.param("id"));
    const { answer } = z
      .object({ answer: z.string().trim().min(1).max(8_000) })
      .parse(await c.req.json());
    if (
      !record.gateway.followUpQuestion ||
      record.gateway.followUpsUsed >= record.configSnapshot.gateway.maxFollowUps
    )
      throw new Error("Es ist keine weitere Gateway-Rückfrage vorgesehen.");
    const followUpQuestion = record.gateway.followUpQuestion;
    const answerById = new Map(
      record.gateway.userAnswers.map((item) => [item.questionId, item]),
    );
    const result = await auditedAiOperation(
      repo,
      record.id,
      "gateway-reevaluate",
      () =>
        ai.reevaluateGateway({
          ...context(
            record,
            record.configSnapshot.instructions.gateway,
            selectedUploads(repo, record, record.gateway.selectedUploadIds),
          ),
          cover: record.cover,
          questions: [...record.configSnapshot.gateway.questions]
            .sort((left, right) => left.displayOrder - right.displayOrder)
            .map((question) => {
              const prior = answerById.get(question.id)!;
              return {
                id: question.id,
                name: question.name,
                evaluationQuestion: gatewayEvaluationQuestion(question),
                userQuestion: gatewayUserQuestion(question),
                helpText: gatewayHelpText(question),
                displayOrder: question.displayOrder,
                elicitedQuestion: record.gateway.elicitation?.questions.find(
                  (item) => item.questionId === question.id,
                )?.question,
                response: prior.response,
                responseKind: prior.responseKind,
              };
            }),
          followUpAllowed: false,
          previousResult: {
            decisions: record.gateway.decisions,
            followUpQuestion,
          },
          followUpQuestion,
          followUpAnswer: answer,
        }),
    );
    const expectedIds = record.configSnapshot.gateway.questions
      .map((item) => item.id)
      .sort()
      .join("|");
    if (
      result.value.decisions
        .map((item) => item.questionId)
        .sort()
        .join("|") !== expectedIds
    )
      throw new Error(
        "Die KI-Antwort enthält nicht genau die konfigurierten Gateway-Fragen.",
      );
    return c.json(
      await repo.saveGateway(record.id, {
        ...record.gateway,
        decisions: result.value.decisions,
        followUpAnswer: answer,
        followUpsUsed: 1,
        final: true,
        hasClearAiSignal: result.value.decisions.some(
          (item) => item.decision === "yes",
        ),
        operation: result.trace,
      }),
    );
  });

  app.post("/:id/form/prefill", async (c) => {
    const record = await required(repo, c.req.param("id"));
    if (record.mode !== "form" || record.state !== "criteria_in_progress")
      throw new Error(
        "Das Vorbefüllen ist nur zu Beginn des Formularmodus möglich.",
      );
    const result = await auditedAiOperation(
      repo,
      record.id,
      "form-prefill",
      () =>
        ai.prefillForm({
          ...context(record, record.configSnapshot.instructions.formPrefill),
          cover: record.cover,
          gateway: record.gateway,
          criteria: record.configSnapshot.criteria,
        }),
    );
    return c.json(
      await repo.applyAiCriteria(
        record.id,
        proposalValues(record, result.value.proposals),
        result.trace,
      ),
    );
  });
  app.patch("/:id/criteria/:criterionId", async (c) => {
    const body = z
      .object({
        value: z.union([z.number().finite(), z.boolean()]).nullable(),
        rationale: z.string().max(4_000).optional(),
        evidence: z.array(z.string().max(1_000)).max(50).optional(),
      })
      .parse(await c.req.json());
    return c.json(
      await repo.setCriterion(
        c.req.param("id"),
        c.req.param("criterionId"),
        body.value,
        body,
      ),
    );
  });
  app.post("/:id/criteria/:criterionId/confirm", async (c) =>
    c.json(
      await repo.confirmCriterion(
        c.req.param("id"),
        c.req.param("criterionId"),
      ),
    ),
  );

  app.post("/:id/chat", async (c) => {
    const record = await required(repo, c.req.param("id"));
    if (
      record.mode !== "chat" ||
      !["criteria_in_progress", "ready_for_review"].includes(record.state)
    )
      throw new Error("Das Gespräch ist in diesem Status nicht verfügbar.");
    const body = chatBodySchema.parse(await c.req.json());
    const userMessage = body.userMessage ?? body.message;
    if (!userMessage) throw new Error("Bitte geben Sie eine Nachricht ein.");
    const criterionSectionId = body.criterionId
      ? record.configSnapshot.criteria.find(
          (criterion) => criterion.id === body.criterionId,
        )?.sectionId
      : undefined;
    if (body.criterionId && !criterionSectionId)
      throw new Error("Unbekanntes Kriterium für das Gespräch.");
    const messages = await repo.chatMessages(record.id);
    const completedSectionIds = new Set(
      messages.flatMap((message) =>
        message.role === "assistant" &&
        message.sectionId &&
        message.askFollowUp === false &&
        !message.criterionDiscussion
          ? [message.sectionId]
          : [],
      ),
    );
    const requestedSectionId = criterionSectionId ?? body.sectionId;
    const section = requestedSectionId
      ? record.configSnapshot.chat.sections.find(
          (item) => item.id === requestedSectionId,
        )
      : ([...record.configSnapshot.chat.sections]
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .find((candidate) => !completedSectionIds.has(candidate.id)) ??
        record.configSnapshot.chat.sections.at(-1));
    if (!section) throw new Error("Unbekannter Gesprächsbereich.");
    const transcript = messages.map(({ role, content }) => ({ role, content }));
    const sectionEvents = (await repo.history(record.id)).filter(
      (item) =>
        item.event === "chat-message" &&
        (item.detail as { sectionId?: string }).sectionId === section.id &&
        (item.detail as { role?: string }).role === "user" &&
        !(item.detail as { criterionDiscussion?: boolean }).criterionDiscussion,
    );
    const latestSectionAssistant = [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" &&
          message.sectionId === section.id &&
          !message.criterionDiscussion,
      );
    if (
      !body.criterionId &&
      sectionEvents.length >=
        1 + record.configSnapshot.chat.maxFollowUpsPerSection
    )
      throw new Error(
        "Für diesen Bereich ist die maximale Zahl an Rückfragen erreicht.",
      );
    if (!body.followUp && sectionEvents.length > 0 && !body.criterionId)
      throw new Error(
        "Die Hauptfrage dieses Bereichs wurde bereits beantwortet.",
      );
    if (body.followUp && sectionEvents.length === 0 && !body.criterionId)
      throw new Error("Dieser Bereich beginnt mit seiner Hauptfrage.");
    if (
      body.followUp &&
      latestSectionAssistant?.askFollowUp !== true &&
      !body.criterionId
    )
      throw new Error("Für diesen Bereich ist keine weitere Rückfrage offen.");
    const uploads = selectedUploads(repo, record, body.selectedUploadIds);
    const request = {
      ...context(record, record.configSnapshot.instructions.chat, uploads),
      sessionId: record.id,
      cover: record.cover,
      section,
      criteria: record.configSnapshot.criteria.filter(
        (item) => item.sectionId === section.id,
      ),
      currentValues: record.criteria,
      transcript,
      userMessage,
      questionsRemaining: Math.max(
        0,
        1 +
          record.configSnapshot.chat.maxFollowUpsPerSection -
          sectionEvents.length -
          1,
      ),
    };
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const result = await auditedAiOperation(
          repo,
          record.id,
          body.criterionId ? "criterion-discussion" : "chat-turn",
          () =>
            body.criterionId
              ? ai.discussCriterion({
                  ...request,
                  criterionId: body.criterionId,
                })
              : ai.chatTurn(request),
        );
        await repo.appendChat(record.id, {
          role: "user",
          content: userMessage,
          sectionId: section.id,
          followUp: body.followUp,
          criterionId: body.criterionId ?? null,
          criterionDiscussion: !!body.criterionId,
        });
        await repo.appendChat(record.id, {
          role: "assistant",
          content: result.value.message,
          sectionId: section.id,
          proposals: result.value.proposals,
          askFollowUp: result.value.askFollowUp,
          criterionDiscussion: !!body.criterionId,
          trace: result.trace,
        });
        const updated = await repo.applyAiCriteria(
          record.id,
          proposalValues(record, result.value.proposals),
          result.trace,
        );
        writeAssistantText(writer, result.value.message);
        writer.write({
          type: "data-assessment",
          data: {
            assessment: updated,
            askFollowUp: result.value.askFollowUp,
          },
        });
      },
      onError: safeStreamError,
    });
    return createUIMessageStreamResponse({ stream });
  });

  app.post("/:id/uploads", async (c) => {
    const file = (await c.req.parseBody()).file;
    if (!(file instanceof File))
      return c.json({ error: "Keine Datei ausgewählt." }, 400);
    return c.json(
      await repo.saveUpload(
        c.req.param("id"),
        file.name,
        file.type || "application/octet-stream",
        new Uint8Array(await file.arrayBuffer()),
      ),
      201,
    );
  });
  app.post("/:id/review", async (c) => {
    const record = await required(repo, c.req.param("id"));
    if (record.state !== "ready_for_review" || !record.calculatedResults)
      throw new Error("Die Bewertung ist noch nicht vollständig prüfbar.");
    const calculatedResults = record.calculatedResults;
    const body = selectedUploadsSchema.parse(
      await c.req.json().catch(() => ({})),
    );
    const uploads = selectedUploads(repo, record, body.selectedUploadIds);
    const conversationEvidence = await repo.chatEvidence(record.id);
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const result = await auditedAiOperation(
          repo,
          record.id,
          "review",
          async () =>
            ai.review({
              ...context(
                record,
                record.configSnapshot.instructions.reviewer,
                uploads,
              ),
              cover: record.cover,
              configSnapshot: record.configSnapshot,
              gateway: record.gateway,
              criterionDefinitions: record.configSnapshot.criteria,
              criteria: record.criteria,
              calculatedResults,
              conversationEvidence,
              plausibilityWarningEuro:
                record.configSnapshot.scoring.plausibilityWarningAmount,
            }),
        );
        for (const finding of result.value.findings) {
          for (const criterionId of finding.criterionIds)
            if (
              !record.configSnapshot.criteria.some(
                (item) => item.id === criterionId,
              )
            )
              throw new Error(
                "Die KI-Prüfung verweist auf ein unbekanntes Kriterium.",
              );
          if (finding.proposedCorrection)
            validateCriterionValue(
              record.configSnapshot,
              finding.proposedCorrection.criterionId,
              finding.proposedCorrection.value,
            );
        }
        const review: ReviewRecord = {
          id: crypto.randomUUID(),
          status: "current",
          reviewedCriteriaUpdatedAt:
            record.criteria
              .map((item) => item.updatedAt)
              .filter((item): item is string => !!item)
              .sort()
              .at(-1) ?? record.updatedAt,
          deterministicWarnings: deterministicWarnings(record),
          findings: result.value.findings.map((item) => ({
            ...item,
            proposedCorrection: item.proposedCorrection
              ? {
                  criterionId: item.proposedCorrection.criterionId,
                  value: item.proposedCorrection.value,
                }
              : null,
            acknowledgedAt: null,
          })),
          chatMessagesUsed: 0,
          operation: result.trace,
          createdAt: new Date().toISOString(),
        };
        writer.write({
          type: "data-assessment",
          data: await repo.saveReview(record.id, review),
        });
      },
      onError: safeStreamError,
    });
    return createUIMessageStreamResponse({ stream });
  });
  app.post("/:id/review/chat", async (c) => {
    const record = await required(repo, c.req.param("id"));
    const body = selectedUploadsSchema
      .extend({ message: z.string().trim().min(1).max(20_000) })
      .parse(await c.req.json());
    if (
      !record.review ||
      record.review.status !== "current" ||
      !record.calculatedResults
    )
      throw new Error("Es liegt keine aktuelle Prüfung vor.");
    if (
      record.review.chatMessagesUsed >=
      record.configSnapshot.ai.reviewerChatLimit
    )
      throw new Error(
        "Die maximale Zahl an Rückfragen zur Prüfung ist erreicht.",
      );
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const result = await auditedAiOperation(
          repo,
          record.id,
          "review-chat",
          async () =>
            ai.reviewChat({
              ...context(
                record,
                record.configSnapshot.instructions.reviewer,
                selectedUploads(repo, record, body.selectedUploadIds),
              ),
              sessionId: record.review!.id,
              review: record.review!,
              assessmentSummary: {
                gateway: record.gateway,
                criteria: record.criteria,
                calculatedResults: record.calculatedResults!,
              },
              transcript: await repo.reviewChatEvidence(record.id),
              userMessage: body.message,
              messagesRemaining:
                record.configSnapshot.ai.reviewerChatLimit -
                record.review!.chatMessagesUsed,
            }),
        );
        await repo.recordReviewChat(
          record.id,
          body.message,
          result.value.message,
          result.trace,
        );
        writeAssistantText(writer, result.value.message);
      },
      onError: safeStreamError,
    });
    return createUIMessageStreamResponse({ stream });
  });
  app.post("/:id/review/acknowledge", async (c) => {
    const { findingId } = z
      .object({ findingId: z.string().min(1).max(100) })
      .parse(await c.req.json());
    return c.json(await repo.acknowledgeFinding(c.req.param("id"), findingId));
  });
  app.post("/:id/confirm", async (c) =>
    c.json(await repo.confirmAssessment(c.req.param("id"))),
  );
  app.patch("/:id/facilitator-ratings", async (c) => {
    const ratings = z
      .object({
        completeness: z.number().int().min(1).max(5),
        plausibility: z.number().int().min(1).max(5),
        traceability: z.number().int().min(1).max(5),
        userEffort: z.number().int().min(1).max(5),
      })
      .parse(await c.req.json());
    return c.json(
      await repo.saveFacilitatorRatings(c.req.param("id"), ratings),
    );
  });
  app.get("/:id/export", async (c) => {
    const record = await required(repo, c.req.param("id"));
    return new Response(JSON.stringify(record, null, 2) + "\n", {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${record.id}.json"`,
      },
    });
  });
  return app;
}

async function required(repo: AssessmentRepository, id: string) {
  const record = await repo.get(id);
  if (!record) throw new Error("Bewertung nicht gefunden.");
  return record;
}
