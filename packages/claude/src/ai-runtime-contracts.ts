import type { AiTrace } from "../../domain/src/process-understanding.ts";

export interface AiRuntimeModelConfig {
  model: "sonnet";
  effort: "medium";
  timeoutMs: number;
  maxOutputTokens: number;
  maxInputCharacters: number;
  maxBudgetUsd: number;
}

export interface AiStructuredResult<T> {
  value: T;
  trace: AiTrace;
}
