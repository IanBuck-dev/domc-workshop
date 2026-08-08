import type { StreamTextResult, ToolSet } from "ai";

export type ChatProcessFlowVerification =
  | { ok: true; revision: string }
  | {
      ok: false;
      errors: Array<{ path: string; code: string; message: string }>;
    };

export interface ChatCaptureTurnRequest {
  processId: string;
  sessionId: string;
  resume: boolean;
  prompt: string;
  systemPrompt: string;
  cwd: string;
  timeoutMs: number;
  maxBudgetUsd: number;
  signal: AbortSignal;
  verifyProcessFlow: () => Promise<ChatProcessFlowVerification>;
}

export interface ChatCaptureTurnStream {
  result: StreamTextResult<ToolSet, any, any>;
  requestedSessionId: string;
  verification: () => { ok: boolean; revision: string | null };
}

export interface ChatCaptureClaudeAdapter {
  startTurn(request: ChatCaptureTurnRequest): Promise<ChatCaptureTurnStream>;
  deleteSession(sessionId: string, cwd: string): Promise<void>;
}
