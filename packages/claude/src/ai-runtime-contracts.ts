import type { AiTrace } from "../../domain/src/process-understanding.ts";

export interface AiRuntimeModelConfig {
  model: "opus" | "claude-opus-4-8";
  effort: "medium" | "high";
  timeoutMs: number;
  maxOutputTokens: number;
  maxInputCharacters: number;
  maxBudgetUsd: number;
}

export interface AiStructuredResult<T> {
  value: T;
  trace: AiTrace;
}
