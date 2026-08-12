import { streamText, tool } from "ai";
import {
  createAiSdkMcpServer,
  createClaudeCode,
  deleteSession,
} from "ai-sdk-provider-claude-code";
import { z } from "zod";
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
    let verifiedRevision: string | null = null;
    const processTools = {
      verify_process_flow: tool({
        description:
          "Prüft den bereits geschriebenen vollständigen Prozessstand. Nach jedem Write und vor dem Abschluss aufrufen; Fehler korrigieren und erneut prüfen.",
        inputSchema: z.object({}),
        execute: async () => {
          const verification = await request.verifyProcessFlow();
          verifiedRevision = verification.ok ? verification.revision : null;
          return verification;
        },
      }),
    };
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
        mcpServers: {
          process: createAiSdkMcpServer("process", processTools),
        },
        allowedTools: [
          "Read",
          "Glob",
          "Bash",
          "Write",
          "mcp__process__verify_process_flow",
        ],
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
      verification: () => ({
        ok: verifiedRevision !== null,
        revision: verifiedRevision,
      }),
    };
  }

  async deleteSession(sessionId: string, cwd: string) {
    await deleteSession(sessionId, { dir: cwd });
  }
}
