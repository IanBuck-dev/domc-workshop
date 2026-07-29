import { SandboxRunner } from "./sandbox-runner.ts";
import type {
  ProcessAiResult,
  SynthesisRequest,
} from "./process-ai-contracts.ts";
import {
  normalizeProcessSynthesisResult,
  type ProcessUnderstanding,
} from "../../domain/src/process-understanding.ts";
import { processSynthesisResultSchema } from "./process-response-schemas.ts";
import {
  boundedProcessJson,
  composeProcessSystemPrompt,
  loadProcessPrompt,
  loadProcessSchema,
} from "./process-ai-utils.ts";

export class ProcessSynthesisAdapter {
  constructor(private readonly runner: SandboxRunner) {}
  async run(
    request: SynthesisRequest,
  ): Promise<ProcessAiResult<ProcessUnderstanding>> {
    const [basePrompt, prompt] = await Promise.all([
      loadProcessPrompt("process-base"),
      loadProcessPrompt("process-synthesis"),
    ]);
    const jsonSchema = await loadProcessSchema("process-understanding");
    const result = await this.runner.runStructured({
      processId: request.processId,
      operationName: "process-synthesis",
      prompt: `## Prozessangaben\n${boundedProcessJson({ cover: request.cover, topics: request.topics, currentInput: { mainAnswers: request.mainAnswers, workCharacteristics: request.workCharacteristicDefinitions.map((definition) => ({ id: definition.id, topicId: definition.topicId, question: definition.question, selectedAnswers: request.workCharacteristicAnswers.find((answer) => answer.characteristicId === definition.id)?.selectedOptionIds.map((optionId) => definition.options.find((option) => option.id === optionId)?.label ?? optionId) ?? [] })), selectedUploads: request.selectedUploads.map(({ id, name }) => ({ id, name })) }, openQuestions: request.followUps, legacyFollowUpAnswers: request.followUpAnswers, validationHistory: request.validationHistory.map((run) => ({ runNumber: run.runNumber, completedAt: run.completedAt, questions: run.questions, previousQuestionReviews: run.previousQuestionReviews })) }, request.model.maxInputCharacters)}`,
      systemPrompt: composeProcessSystemPrompt(
        basePrompt,
        prompt,
        request.instructions,
      ),
      responseSchema: processSynthesisResultSchema,
      responseJsonSchema: jsonSchema,
      structuredOutput: "prompted",
      model: request.model,
      tools: request.selectedUploads.length ? "workspace" : "none",
      selectedUploads: request.selectedUploads,
      signal: request.signal,
    });
    return {
      ...result,
      value: normalizeProcessSynthesisResult(result.value),
    };
  }
}
