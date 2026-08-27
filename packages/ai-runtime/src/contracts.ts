import type { ZodType } from "zod";
import type { AiTrace } from "../../domain/src/process-understanding.ts";

export const aiProviderIds = ["codex-cli", "claude-cli"] as const;
export type AiProviderId = (typeof aiProviderIds)[number];

export interface AiRuntimeModelConfig {
  model: string;
  effort: "medium" | "high";
  timeoutMs: number;
  maxOutputTokens: number;
  maxInputCharacters: number;
  /** Claude enforces this value. Codex records but cannot enforce it. */
  maxBudgetUsd: number;
}

export interface AiSelectedUpload {
  id: string;
  name: string;
  path: string;
  size: number;
  sha256: string;
}

export interface StructuredAiRequest<T> {
  processId: string;
  operationName: string;
  prompt: string;
  systemPrompt: string;
  responseSchema: ZodType<T>;
  responseJsonSchema: object;
  structuredOutput?: "constrained" | "prompted";
  model: AiRuntimeModelConfig;
  tools: "none" | "workspace";
  selectedUploads?: AiSelectedUpload[];
  sessionId?: string;
  signal?: AbortSignal;
}

export interface StructuredAiResult<T> {
  value: T;
  trace: AiTrace;
}

export interface AiRuntimeProvider {
  readonly id: AiProviderId;
  runStructured<T>(
    request: StructuredAiRequest<T>,
  ): Promise<StructuredAiResult<T>>;
}

export interface NormalizedChatTurnHandle {
  result: {
    text: PromiseLike<string>;
    finalStep: PromiseLike<{ providerMetadata?: Record<string, unknown> }>;
    finishReason: PromiseLike<string>;
    fullStream: AsyncIterable<unknown>;
  };
  requestedSessionId: string;
  verification: () => { ok: boolean; revision: string | null };
}

export type ChatProcessFlowVerification =
  | { ok: true; revision: string }
  | {
      ok: false;
      errors: Array<{ path: string; code: string; message: string }>;
    };

export interface AiChatTurnRequest {
  processId: string;
  sessionId: string;
  resume: boolean;
  prompt: string;
  systemPrompt: string;
  model: string;
  cwd: string;
  timeoutMs: number;
  maxBudgetUsd: number;
  signal: AbortSignal;
  writeProcessFlow: (value: string) => Promise<ChatProcessFlowVerification>;
  verifyProcessFlow: () => Promise<ChatProcessFlowVerification>;
}

export interface ChatCaptureAiAdapter {
  startTurn(request: AiChatTurnRequest): Promise<NormalizedChatTurnHandle>;
  deleteSession(sessionId: string, cwd: string): Promise<void>;
}

export function configuredAiProvider(
  value = process.env.AI_PROVIDER,
): AiProviderId {
  if (!value || value === "codex-cli") return "codex-cli";
  if (value === "claude-cli") return value;
  throw new Error("AI_PROVIDER must be codex-cli or claude-cli.");
}

export function configuredAiModel(
  provider: AiProviderId,
  override = process.env.AI_MODEL,
) {
  if (override) return override;
  return provider === "codex-cli" ? "gpt-5.6-sol" : "opus";
}
