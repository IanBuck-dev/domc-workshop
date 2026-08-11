import { memoryConsolidationResultSchema } from "../../domain/src/memory.ts";
import type { MemoryConsolidationRequest } from "./memory-consolidation-contracts.ts";
import { SandboxRunner, type SandboxRunnerOptions } from "./sandbox-runner.ts";

function boundedJson(value: unknown, maximum: number) {
  const json = JSON.stringify(value, null, 2);
  if (json.length > maximum)
    throw new Error(
      "Der Konsolidierungskontext überschreitet das sichere Eingabelimit.",
    );
  return json;
}

export class MemoryConsolidationAdapter {
  constructor(private readonly runner: SandboxRunner) {}

  run(request: MemoryConsolidationRequest) {
    return this.runner.runStructured({
      processId: "memory-consolidation",
      operationName: "memory-consolidation",
      prompt: `## Aktuelle Themen-Dateien\n${boundedJson(request.topicFiles, request.model.maxInputCharacters)}`,
      systemPrompt: request.contracts.prompt,
      responseSchema: memoryConsolidationResultSchema,
      responseJsonSchema: request.contracts.responseSchema,
      model: request.model,
      tools: "none",
      signal: request.signal,
    });
  }
}

export class ClaudeMemoryConsolidationAdapter extends MemoryConsolidationAdapter {
  constructor(options: SandboxRunnerOptions | SandboxRunner = {}) {
    super(
      options instanceof SandboxRunner ? options : new SandboxRunner(options),
    );
  }

  consolidate(request: MemoryConsolidationRequest) {
    return this.run(request);
  }
}
