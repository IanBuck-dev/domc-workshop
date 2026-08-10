import { memoryOperationListSchema } from "../../domain/src/memory.ts";
import type { MemoryDistillationRequest } from "./memory-distillation-contracts.ts";
import { SandboxRunner, type SandboxRunnerOptions } from "./sandbox-runner.ts";

function boundedJson(value: unknown, maximum: number) {
  const json = JSON.stringify(value, null, 2);
  if (json.length > maximum)
    throw new Error(
      "Der Destillationskontext überschreitet das sichere Eingabelimit.",
    );
  return json;
}

export class MemoryDistillationAdapter {
  constructor(private readonly runner: SandboxRunner) {}

  run(request: MemoryDistillationRequest) {
    const input = {
      transcript: request.transcript,
      confirmedUnderstanding: request.understanding,
      topicFiles: request.topicFiles,
    };
    return this.runner.runStructured({
      processId: request.processId,
      operationName: "memory-distillation",
      prompt: `## Zulässige Eingaben\n${boundedJson(input, request.model.maxInputCharacters)}`,
      systemPrompt: request.contracts.prompt,
      responseSchema: memoryOperationListSchema,
      responseJsonSchema: request.contracts.responseSchema,
      model: request.model,
      tools: "none",
      signal: request.signal,
    });
  }
}

export class ClaudeMemoryDistillationAdapter extends MemoryDistillationAdapter {
  constructor(options: SandboxRunnerOptions | SandboxRunner = {}) {
    super(
      options instanceof SandboxRunner ? options : new SandboxRunner(options),
    );
  }

  distill(request: MemoryDistillationRequest) {
    return this.run(request);
  }
}
