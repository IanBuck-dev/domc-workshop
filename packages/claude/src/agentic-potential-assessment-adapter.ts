import {
  agenticAssessmentAiResultSchema,
  type AgenticAssessmentSourceSnapshot,
} from "../../domain/src/agentic-potential-assessment.ts";
import type {
  AiRuntimeModelConfig,
  AiRuntimeProvider,
  StructuredAiResult as AiStructuredResult,
} from "../../ai-runtime/src/contracts.ts";
import type { SandboxRunnerOptions } from "./sandbox-runner.ts";
import { providerRuntime } from "./provider-runtime.ts";

export interface AgenticPotentialAssessmentAiAdapter {
  assess(request: {
    processId: string;
    configHash: string;
    model: AiRuntimeModelConfig;
    sourceSnapshot: AgenticAssessmentSourceSnapshot;
    contracts: { prompt: string; schema: object };
    signal?: AbortSignal;
  }): Promise<AiStructuredResult<unknown>>;
}
export class ClaudeAgenticPotentialAssessmentAdapter implements AgenticPotentialAssessmentAiAdapter {
  private readonly runner: AiRuntimeProvider;
  constructor(options: AiRuntimeProvider | SandboxRunnerOptions = {}) {
    this.runner = providerRuntime(options);
  }
  assess(
    request: Parameters<AgenticPotentialAssessmentAiAdapter["assess"]>[0],
  ) {
    const prompt = JSON.stringify(request.sourceSnapshot, null, 2);
    if (prompt.length > request.model.maxInputCharacters)
      throw new Error(
        "Der Bewertungssnapshot überschreitet das sichere KI-Eingabelimit.",
      );
    return this.runner.runStructured({
      processId: request.processId,
      operationName: "agentic-potential-assessment",
      prompt: `## Eingefrorener Bewertungssnapshot\n${prompt}`,
      systemPrompt: request.contracts.prompt,
      responseSchema: agenticAssessmentAiResultSchema,
      responseJsonSchema: request.contracts.schema,
      model: request.model,
      tools: "none",
      signal: request.signal,
    });
  }
}
