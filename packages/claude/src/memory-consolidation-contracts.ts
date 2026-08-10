import type {
  MemoryConsolidationResult,
  MemoryTopic,
} from "../../domain/src/memory.ts";
import type {
  AiRuntimeModelConfig,
  AiStructuredResult,
} from "./ai-runtime-contracts.ts";

export interface MemoryConsolidationContracts {
  prompt: string;
  responseSchema: object;
}

export interface MemoryConsolidationRequest {
  topicFiles: Record<MemoryTopic, string>;
  contracts: MemoryConsolidationContracts;
  model: AiRuntimeModelConfig;
  signal?: AbortSignal;
}

export interface MemoryConsolidationAiAdapter {
  consolidate(
    request: MemoryConsolidationRequest,
  ): Promise<AiStructuredResult<MemoryConsolidationResult>>;
}
