import { streamText } from "ai";
import { createClaudeCode, deleteSession } from "ai-sdk-provider-claude-code";
import type {
  ChatCaptureClaudeAdapter,
  ChatCaptureTurnRequest,
} from "./chat-capture-contracts.ts";
import { prepareChatSandboxSpawn } from "./chat-sandbox-spawn.ts";

export class ClaudeChatCaptureAdapter implements ChatCaptureClaudeAdapter {
  async startTurn(request: ChatCaptureTurnRequest) {
    if (request.signal.aborted)
      throw new DOMException("AI operation cancelled.", "AbortError");
    const spawnClaudeCodeProcess = await prepareChatSandboxSpawn({
      cwd: request.cwd,
    });
    const provider = createClaudeCode({
      defaultSettings: {
        pathToClaudeCodeExecutable: Bun.which("claude") ?? "claude",
        cwd: request.cwd,
        systemPrompt: request.systemPrompt,
        effort: "medium",
        maxTurns: 12,
        maxBudgetUsd: request.maxBudgetUsd,
        persistSession: true,
        settingSources: [],
        allowedTools: ["Read", "Glob", "Bash", "Write"],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        spawnClaudeCodeProcess,
      },
    });
    const model = provider("claude-opus-4-8", {
      ...(request.resume
        ? { resume: request.sessionId }
        : { sessionId: request.sessionId }),
    });
    return {
      result: streamText({
        model,
        prompt: request.prompt,
        abortSignal: request.signal,
        timeout: { totalMs: request.timeoutMs },
      }),
      requestedSessionId: request.sessionId,
    };
  }

  async deleteSession(sessionId: string, cwd: string) {
    await deleteSession(sessionId, { dir: cwd });
  }
}
