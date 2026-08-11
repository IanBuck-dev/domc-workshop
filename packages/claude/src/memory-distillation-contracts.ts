import type { ChatTranscriptEvent } from "../../domain/src/chat-capture.ts";
import type {
  MemoryOperationList,
  MemoryTopic,
} from "../../domain/src/memory.ts";
import type { ProcessUnderstanding } from "../../domain/src/process-understanding.ts";
import type {
  AiRuntimeModelConfig,
  AiStructuredResult,
} from "./ai-runtime-contracts.ts";

export interface MemoryDistillationContracts {
  prompt: string;
  responseSchema: object;
}

export interface MemoryDistillationRequest {
  processId: string;
  transcript: ChatTranscriptEvent[];
  understanding: ProcessUnderstanding;
  topicFiles: Record<MemoryTopic, string>;
  contracts: MemoryDistillationContracts;
  model: AiRuntimeModelConfig;
  signal?: AbortSignal;
}

export interface MemoryDistillationAiAdapter {
  distill(
    request: MemoryDistillationRequest,
  ): Promise<AiStructuredResult<MemoryOperationList>>;
}
