import type {
  AssessmentChatRequest,
  CriterionDiscussionRequest,
} from "./assessment-ai-contracts.ts";
import { criteriaProposalsResultSchema } from "./response-schemas.ts";
import {
  assertCriteriaProposals,
  boundedJson,
  loadPrompt,
  loadResponseJsonSchema,
  systemPrompt,
} from "./assessment-ai-utils.ts";
import { SandboxRunner } from "./sandbox-runner.ts";

export class AssessmentChatClaudeAdapter {
  constructor(private readonly runner: SandboxRunner) {}

  turn(request: AssessmentChatRequest) {
    return this.run("chat-turn", request);
  }

  discuss(request: CriterionDiscussionRequest) {
    if (
      !request.criteria.some(
        (criterion) => criterion.id === request.criterionId,
      )
    )
      throw new Error("Cannot discuss an unknown criterion.");
    return this.run("criterion-discussion", request, request.criterionId);
  }

  private async run(
    operationName: string,
    request: AssessmentChatRequest,
    criterionId?: string,
  ) {
    if (request.questionsRemaining < 0 || request.questionsRemaining > 3)
      throw new Error("Invalid section question budget.");
    const basePrompt = await loadPrompt("chat");
    const responseJsonSchema =
      await loadResponseJsonSchema("criteria-proposals");
    const input = {
      cover: request.cover,
      section: request.section,
      criteria: request.criteria,
      currentValues: request.currentValues,
      transcript: request.transcript,
      userMessage: request.userMessage,
      questionsRemaining: request.questionsRemaining,
      criterionDiscussion: criterionId ?? null,
    };
    const result = await this.runner.runStructured({
      assessmentId: request.assessmentId,
      operationName,
      prompt: `## Gesprächskontext\n${boundedJson(input, request.model.maxInputCharacters)}`,
      systemPrompt: systemPrompt(basePrompt, request),
      responseSchema: criteriaProposalsResultSchema,
      responseJsonSchema,
      model: request.model,
      tools: "workspace",
      selectedUploads: request.selectedUploads,
      sessionId: request.sessionId,
      signal: request.signal,
    });
    return assertCriteriaProposals(
      result,
      request.criteria,
      request.questionsRemaining,
    );
  }
}
