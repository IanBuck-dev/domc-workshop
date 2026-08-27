import { streamText, tool } from "ai";
import {
  createAiSdkMcpServer,
  createClaudeCode,
  deleteSession,
} from "ai-sdk-provider-claude-code";
import { z } from "zod";
import type {
  ChatCaptureAiAdapter,
  ChatCaptureTurnRequest,
} from "./chat-capture-contracts.ts";
import { providerModel } from "../../ai-runtime/src/operation-policy.ts";
import { prepareChatSandboxSpawn } from "./chat-sandbox-spawn.ts";

export class ClaudeChatCaptureAdapter implements ChatCaptureAiAdapter {
  async startTurn(request: ChatCaptureTurnRequest) {
    if (request.signal.aborted)
      throw new DOMException("AI operation cancelled.", "AbortError");
    const spawnClaudeCodeProcess = await prepareChatSandboxSpawn({
      cwd: request.cwd,
    });
    let verifiedRevision: string | null = null;
    const processTools = {
      write_process_flow: tool({
        description:
          "Schreibt ausschließlich den vollständigen Prozessstand nach Schema. Danach verify_process_flow aufrufen.",
        inputSchema: z.object({ content: z.string() }),
        execute: async ({ content }) => request.writeProcessFlow(content),
      }),
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
        // Document intake needs enough bounded tool steps to read the schema and
        // selected files, write the complete snapshot, verify it, and repair a
        // rejected draft. Opus 5 exhausted the former limit of 12 before it
        // could return a user-facing answer in the real product flow.
        maxTurns: 20,
        maxBudgetUsd: request.maxBudgetUsd,
        persistSession: true,
        settingSources: [],
        strictMcpConfig: true,
        mcpServers: {
          process: createAiSdkMcpServer("process", processTools),
        },
        allowedTools: [
          "Read",
          "Glob",
          "Bash",
          "mcp__process__write_process_flow",
          "mcp__process__verify_process_flow",
        ],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        spawnClaudeCodeProcess,
      },
    });
    const model = provider(providerModel("claude-cli", request.model), {
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
