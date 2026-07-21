import type {
  ReviewChatRequest,
  ReviewRequest,
} from "./assessment-ai-contracts.ts";
import {
  reviewChatResultSchema,
  reviewResultSchema,
} from "./response-schemas.ts";
import {
  assertReviewResult,
  boundedJson,
  loadPrompt,
  loadResponseJsonSchema,
  systemPrompt,
} from "./assessment-ai-utils.ts";
import { SandboxRunner } from "./sandbox-runner.ts";

export class ReviewClaudeAdapter {
  constructor(private readonly runner: SandboxRunner) {}

  async review(request: ReviewRequest) {
    const basePrompt = await loadPrompt("reviewer");
    const responseJsonSchema = await loadResponseJsonSchema("review-result");
    const input = {
      cover: request.cover,
      configSnapshot: request.configSnapshot,
      gateway: request.gateway,
      criterionDefinitions: request.criterionDefinitions,
      criteria: request.criteria,
      calculatedResults: request.calculatedResults,
      calculationSemantics: {
        profitabilityPercent:
          "Summe der Punkte für Amortisation, Nettoertrag im ersten Jahr und ROI, geteilt durch 12 und mit 100 multipliziert.",
        strategicRelevancePercent:
          "Gewichtete Abschnittspunkte geteilt durch das gewichtete Maximum, skaliert auf 0 bis 100.",
        implementationFactorPercent:
          "Gewichtete Abschnittspunkte geteilt durch das gewichtete Maximum, skaliert auf 0 bis 200. Der neutrale Mittelpunkt ist 100 und kein Rechenfehler.",
        technicalAttractivenessPercent:
          "Gewichtete Abschnittspunkte geteilt durch das gewichtete Maximum, skaliert auf 0 bis 200. Der neutrale Mittelpunkt ist 100 und kein Rechenfehler.",
        overallScore:
          "(profitabilityWeight × profitabilityPercent + strategicWeight × strategicRelevancePercent) × implementationFactorPercent/100 × technicalAttractivenessPercent/100 + alternativlosigkeitPoints.",
      },
      conversationEvidence: request.conversationEvidence,
      plausibilityWarningEuro: request.plausibilityWarningEuro,
    };
    const result = await this.runner.runStructured({
      assessmentId: request.assessmentId,
      operationName: "review",
      prompt: `## Unabhängig zu prüfende Bewertung\n${boundedJson(input, request.model.maxInputCharacters)}`,
      systemPrompt: systemPrompt(basePrompt, request),
      responseSchema: reviewResultSchema,
      responseJsonSchema,
      model: request.model,
      tools: "workspace",
      selectedUploads: request.selectedUploads,
      signal: request.signal,
    });
    return assertReviewResult(result, request.criterionDefinitions);
  }

  async chat(request: ReviewChatRequest) {
    if (request.messagesRemaining <= 0 || request.messagesRemaining > 3)
      throw new Error(
        "The reviewer chat message budget is exhausted or invalid.",
      );
    const basePrompt = await loadPrompt("reviewer");
    const responseJsonSchema = await loadResponseJsonSchema("review-chat");
    const input = {
      review: request.review,
      assessmentSummary: request.assessmentSummary,
      transcript: request.transcript,
      userMessage: request.userMessage,
      messagesRemaining: request.messagesRemaining,
    };
    return this.runner.runStructured({
      assessmentId: request.assessmentId,
      operationName: "review-chat",
      prompt: `## Prüfdialog\n${boundedJson(input, request.model.maxInputCharacters)}`,
      systemPrompt: systemPrompt(basePrompt, request),
      responseSchema: reviewChatResultSchema,
      responseJsonSchema,
      model: request.model,
      tools: "workspace",
      selectedUploads: request.selectedUploads,
      sessionId: request.sessionId,
      signal: request.signal,
    });
  }
}
