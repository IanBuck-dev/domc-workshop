import { SandboxRunner } from "./sandbox-runner.ts";
import type {
  FollowUpRequest,
  FollowUpResult,
  ProcessAiResult,
} from "./process-ai-contracts.ts";
import { processFollowUpResultSchema } from "./process-response-schemas.ts";
import {
  boundedProcessJson,
  composeProcessSystemPrompt,
  loadProcessPrompt,
  loadProcessSchema,
} from "./process-ai-utils.ts";

export class ProcessFollowUpAdapter {
  constructor(private readonly runner: SandboxRunner) {}
  async run(
    request: FollowUpRequest,
  ): Promise<ProcessAiResult<FollowUpResult>> {
    const [basePrompt, prompt] = await Promise.all([
      loadProcessPrompt("process-base"),
      loadProcessPrompt("process-follow-ups"),
    ]);
    const jsonSchema = await loadProcessSchema("process-follow-ups");
    const previousRun = request.validationHistory.at(-1);
    const result = await this.runner.runStructured({
      processId: request.processId,
      operationName: "process-follow-ups",
      prompt: `## Prozessangaben\n${boundedProcessJson({ cover: request.cover, topics: request.topics, currentInput: { mainAnswers: request.mainAnswers, workCharacteristics: request.workCharacteristicDefinitions.map((definition) => ({ id: definition.id, topicId: definition.topicId, question: definition.question, selectedAnswers: request.workCharacteristicAnswers.find((answer) => answer.characteristicId === definition.id)?.selectedOptionIds.map((optionId) => definition.options.find((option) => option.id === optionId)?.label ?? optionId) ?? [] })), selectedUploadIds: request.selectedUploads.map((upload) => upload.id) }, previousValidation: previousRun ? { inputSnapshot: previousRun.inputSnapshot, questions: previousRun.questions } : null, earlierQuestions: request.validationHistory.slice(0, -1).flatMap((run) => run.questions.map(({ id, topicId, question }) => ({ id, topicId, question }))) }, request.model.maxInputCharacters)}`,
      systemPrompt: composeProcessSystemPrompt(
        basePrompt,
        prompt,
        request.instructions,
      ),
      responseSchema: processFollowUpResultSchema,
      responseJsonSchema: jsonSchema,
      model: request.model,
      tools: request.selectedUploads.length ? "workspace" : "none",
      selectedUploads: request.selectedUploads,
      signal: request.signal,
    });
    const expected = new Map(
      (previousRun?.questions ?? []).map((question) => [
        question.id,
        question.topicId,
      ]),
    );
    const reviews = result.value.previousQuestionReviews;
    if (
      new Set(reviews.map((review) => review.questionId)).size !==
        reviews.length ||
      reviews.length !== expected.size ||
      reviews.some(
        (review) => expected.get(review.questionId) !== review.topicId,
      )
    )
      throw new Error(
        "Every question from the previous validation must be reviewed exactly once.",
      );
    return result;
  }
}
