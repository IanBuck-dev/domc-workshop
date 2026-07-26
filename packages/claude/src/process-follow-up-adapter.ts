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
    return this.runner.runStructured({
      processId: request.processId,
      operationName: "process-follow-ups",
      prompt: `## Prozessangaben\n${boundedProcessJson({ cover: request.cover, topics: request.topics, mainAnswers: request.mainAnswers, workCharacteristics: request.workCharacteristicDefinitions.map((definition) => ({ id: definition.id, topicId: definition.topicId, question: definition.question, selectedAnswers: request.workCharacteristicAnswers.find((answer) => answer.characteristicId === definition.id)?.selectedOptionIds.map((optionId) => definition.options.find((option) => option.id === optionId)?.label ?? optionId) ?? [] })) }, request.model.maxInputCharacters)}`,
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
  }
}
