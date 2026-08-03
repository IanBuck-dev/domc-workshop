import type { StreamTextResult, ToolSet } from "ai";

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
}

export interface ChatCaptureTurnStream {
  result: StreamTextResult<ToolSet, any, any>;
  requestedSessionId: string;
}

export interface ChatCaptureClaudeAdapter {
  startTurn(request: ChatCaptureTurnRequest): Promise<ChatCaptureTurnStream>;
  deleteSession(sessionId: string, cwd: string): Promise<void>;
}
