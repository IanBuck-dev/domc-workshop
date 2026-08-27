import type {
  AiChatTurnRequest,
  ChatCaptureAiAdapter as RuntimeChatCaptureAiAdapter,
  ChatProcessFlowVerification,
  NormalizedChatTurnHandle,
} from "../../ai-runtime/src/contracts.ts";

export type { ChatProcessFlowVerification };
export type ChatCaptureTurnRequest = AiChatTurnRequest;
export type ChatCaptureTurnStream = NormalizedChatTurnHandle;
export type ChatCaptureAiAdapter = RuntimeChatCaptureAiAdapter;

/** @deprecated Use ChatCaptureAiAdapter. */
export type ChatCaptureClaudeAdapter = ChatCaptureAiAdapter;
