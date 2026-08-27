import {
  CodexChatCaptureAdapter,
  CodexCliAdapter,
  configuredAiProvider,
  ProcessAiRuntimeAdapter,
  OpportunityAiRuntimeAdapter,
  MemoryDistillationRuntimeAdapter,
  MemoryConsolidationRuntimeAdapter,
  AgenticPotentialAssessmentRuntimeAdapter,
  type AiRuntimeProvider,
} from "../../../packages/ai-runtime/src/index.ts";
import { ClaudeChatCaptureAdapter } from "../../../packages/claude/src/chat-capture-adapter.ts";
import { SandboxRunner } from "../../../packages/claude/src/sandbox-runner.ts";
import type { ChatCaptureAiAdapter } from "../../../packages/ai-runtime/src/contracts.ts";

export function createAiRuntimeFactory() {
  const provider = configuredAiProvider();
  const structured: AiRuntimeProvider =
    provider === "codex-cli" ? new CodexCliAdapter() : new SandboxRunner();
  const chat: ChatCaptureAiAdapter =
    provider === "codex-cli"
      ? new CodexChatCaptureAdapter()
      : new ClaudeChatCaptureAdapter();
  return {
    provider,
    process: new ProcessAiRuntimeAdapter(structured),
    opportunity: new OpportunityAiRuntimeAdapter(structured),
    chat,
    memoryDistillation: new MemoryDistillationRuntimeAdapter(structured),
    memoryConsolidation: new MemoryConsolidationRuntimeAdapter(structured),
    assessment: new AgenticPotentialAssessmentRuntimeAdapter(structured),
  };
}
