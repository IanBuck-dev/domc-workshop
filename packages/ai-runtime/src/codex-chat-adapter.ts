import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import type {
  AiChatTurnRequest,
  NormalizedChatTurnHandle,
} from "./contracts.ts";
import { providerModel } from "./operation-policy.ts";

export type CodexChatTurnRequest = AiChatTurnRequest;

export interface CodexAppServerTransport {
  start(cwd: string, signal: AbortSignal): ChildProcess;
}

function defaultTransport(cwd: string, signal: AbortSignal) {
  return spawn("codex", ["app-server"], {
    cwd,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      LANG: process.env.LANG ?? "C.UTF-8",
      CODEX_DISABLE_NETWORK: "1",
    },
    stdio: ["pipe", "pipe", "pipe"],
    signal,
  });
}

type RpcMessage = {
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message?: string };
};

export function sanitizeCodexChatText(value: string) {
  return value.replace(/\s*:codex-file-citation\{[^}\r\n]*\}/g, "").trim();
}

class AsyncEventQueue {
  private values: unknown[] = [];
  private resolver: ((value: IteratorResult<unknown>) => void) | null = null;
  private complete = false;

  push(value: unknown) {
    if (this.complete) return;
    if (this.resolver) {
      this.resolver({ value, done: false });
      this.resolver = null;
    } else this.values.push(value);
  }

  end() {
    this.complete = true;
    this.resolver?.({ value: undefined, done: true });
    this.resolver = null;
  }

  async *stream(): AsyncGenerator<unknown> {
    while (true) {
      if (this.values.length) {
        yield this.values.shift();
        continue;
      }
      if (this.complete) return;
      const next = await new Promise<IteratorResult<unknown>>((resolve) => {
        this.resolver = resolve;
      });
      if (next.done) return;
      yield next.value;
    }
  }
}

/**
 * JSON-RPC bridge for the Codex app-server. The application owns the only
 * dynamic tool, so Codex can write inside the process workspace but cannot use
 * network tools or approve extra capabilities on its own.
 */
export class CodexChatCaptureAdapter {
  readonly id = "codex-cli" as const;

  constructor(
    private readonly transport: CodexAppServerTransport = {
      start: defaultTransport,
    },
  ) {}

  async startTurn(
    request: AiChatTurnRequest,
  ): Promise<NormalizedChatTurnHandle> {
    if (request.signal.aborted)
      throw new DOMException("AI operation cancelled.", "AbortError");
    const child = this.transport.start(request.cwd, request.signal);
    if (!child.stdin || !child.stdout)
      throw new Error("Codex app-server did not expose stdio.");
    const events = new AsyncEventQueue();
    const pending = new Map<
      string,
      {
        resolve: (value: Record<string, unknown>) => void;
        reject: (error: Error) => void;
      }
    >();
    let nextId = 0;
    let buffer = "";
    let verifiedRevision: string | null = null;
    let threadId = request.sessionId;
    let turnId: string | null = null;
    let assistantText = "";
    let stderr = "";
    let closed = false;
    let resolveDone!: () => void;
    let rejectDone!: (error: Error) => void;
    const done = new Promise<void>((resolve, reject) => {
      resolveDone = resolve;
      rejectDone = reject;
    });
    const close = () => {
      if (closed) return;
      closed = true;
      events.end();
      child.kill("SIGTERM");
    };
    const send = (message: object) =>
      child.stdin!.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
    const notify = (method: string, params: object) => send({ method, params });
    const call = (method: string, params: object) => {
      const id = String(++nextId);
      return new Promise<Record<string, unknown>>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        send({ id, method, params });
      });
    };
    const fail = (error: unknown) => {
      const normalized =
        error instanceof Error ? error : new Error(String(error));
      for (const request of pending.values()) request.reject(normalized);
      pending.clear();
      events.end();
      rejectDone(normalized);
    };
    const interrupt = () => {
      if (!turnId) return;
      void call("turn/interrupt", { threadId, turnId }).catch(() => undefined);
      setTimeout(close, 1_000);
    };
    const handleToolCall = async (
      id: string | number,
      params: Record<string, unknown>,
    ) => {
      const toolName = params.tool ?? params.toolName ?? params.name;
      if (
        toolName !== "verify_process_flow" &&
        toolName !== "write_process_flow"
      ) {
        send({
          id,
          error: { code: -32601, message: "Dynamic tool is not allowed." },
        });
        return;
      }
      events.push({
        type: "tool-call",
        toolName,
        input: params.arguments ?? {},
      });
      try {
        const argumentsValue =
          params.arguments && typeof params.arguments === "object"
            ? (params.arguments as Record<string, unknown>)
            : {};
        const result =
          toolName === "write_process_flow"
            ? await request.writeProcessFlow(
                typeof argumentsValue.content === "string"
                  ? argumentsValue.content
                  : "",
              )
            : await request.verifyProcessFlow();
        if (result.ok) verifiedRevision = result.revision;
        send({
          id,
          result: {
            contentItems: [{ type: "inputText", text: JSON.stringify(result) }],
            success: true,
          },
        });
      } catch {
        send({
          id,
          result: {
            contentItems: [
              { type: "inputText", text: JSON.stringify({ ok: false }) },
            ],
            success: false,
          },
        });
      }
    };
    const handle = (message: RpcMessage) => {
      if (message.id !== undefined && !message.method) {
        const pendingRequest = pending.get(String(message.id));
        if (!pendingRequest) return;
        pending.delete(String(message.id));
        if (message.error)
          pendingRequest.reject(
            new Error(
              message.error.message ?? "Codex app-server request failed.",
            ),
          );
        else pendingRequest.resolve(message.result ?? {});
        return;
      }
      if (message.method === "item/tool/call" && message.id !== undefined) {
        void handleToolCall(message.id, message.params ?? {});
        return;
      }
      const params = message.params ?? {};
      if (message.method === "item/completed") {
        const item = params.item as Record<string, unknown> | undefined;
        if (item?.type === "agentMessage" && typeof item.text === "string")
          assistantText = sanitizeCodexChatText(item.text);
        return;
      }
      if (message.method !== "turn/completed") return;
      const turn = params.turn as Record<string, unknown> | undefined;
      const status = turn?.status;
      if (status === "completed") {
        events.end();
        resolveDone();
      } else
        fail(
          new Error(
            `Codex chat turn ${typeof status === "string" ? status : "failed"}.`,
          ),
        );
    };
    child.stdout.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-8_192);
    });
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          handle(JSON.parse(line) as RpcMessage);
        } catch (error) {
          fail(
            new Error(
              `Invalid Codex app-server JSON-RPC message: ${String(error)}`,
            ),
          );
        }
      }
    });
    child.once("error", fail);
    child.once("exit", (code) => {
      if (!closed)
        fail(
          new Error(
            `Codex app-server exited before turn completion (${code ?? "signal"})${stderr.trim() ? `: ${stderr.trim()}` : "."}`,
          ),
        );
    });
    const timeout = setTimeout(() => {
      interrupt();
      fail(new Error("Codex chat turn timed out."));
    }, request.timeoutMs);
    request.signal.addEventListener(
      "abort",
      () => {
        interrupt();
        fail(new DOMException("AI operation cancelled.", "AbortError"));
      },
      { once: true },
    );
    try {
      await call("initialize", {
        clientInfo: { name: "claims-ai-portfolio", version: "1" },
        capabilities: { experimentalApi: true },
      });
      notify("initialized", {});
      const thread = await call(
        request.resume ? "thread/resume" : "thread/start",
        {
          ...(request.resume
            ? { threadId: request.sessionId }
            : { cwd: request.cwd }),
          model: providerModel("codex-cli", request.model),
          approvalPolicy: "never",
          permissions: ":read-only",
          runtimeWorkspaceRoots: [request.cwd],
          baseInstructions: request.systemPrompt,
          dynamicTools: [
            {
              type: "function",
              name: "write_process_flow",
              description:
                "Schreibt ausschließlich den vollständigen, schema-konformen Prozessstand in die anwendungseigene Prozessdatei.",
              inputSchema: {
                type: "object",
                properties: { content: { type: "string" } },
                required: ["content"],
                additionalProperties: false,
              },
            },
            {
              type: "function",
              name: "verify_process_flow",
              description:
                "Prüft den vollständigen Prozessstand vor dem Abschluss.",
              inputSchema: {
                type: "object",
                properties: {},
                additionalProperties: false,
              },
            },
          ],
        },
      );
      const createdThread = thread.thread as
        Record<string, unknown> | undefined;
      if (!createdThread || typeof createdThread.id !== "string")
        throw new Error("Codex app-server did not return a thread id.");
      threadId = createdThread.id;
      const turn = await call("turn/start", {
        threadId,
        input: [{ type: "text", text: request.prompt, text_elements: [] }],
        cwd: request.cwd,
        approvalPolicy: "never",
        permissions: ":read-only",
        runtimeWorkspaceRoots: [request.cwd],
        effort: "medium",
      });
      const startedTurn = turn.turn as Record<string, unknown> | undefined;
      if (!startedTurn || typeof startedTurn.id !== "string")
        throw new Error("Codex app-server did not return a turn id.");
      turnId = startedTurn.id;
    } catch (error) {
      clearTimeout(timeout);
      close();
      throw error;
    }
    const complete = done.finally(() => {
      clearTimeout(timeout);
      close();
    });
    return {
      result: {
        text: complete.then(() => assistantText),
        finalStep: complete.then(() => ({
          providerMetadata: { "codex-cli": { sessionId: threadId } },
        })),
        finishReason: complete.then(() => "stop"),
        fullStream: events.stream(),
      },
      requestedSessionId: request.sessionId,
      verification: () => ({
        ok: verifiedRevision !== null,
        revision: verifiedRevision,
      }),
    };
  }

  async deleteSession(sessionId: string, cwd: string) {
    const controller = new AbortController();
    const child = this.transport.start(cwd, controller.signal);
    if (!child.stdin || !child.stdout)
      throw new Error("Codex app-server did not expose stdio.");
    let buffer = "";
    let nextId = 0;
    const pending = new Map<
      string,
      {
        resolve: (value: Record<string, unknown>) => void;
        reject: (error: Error) => void;
      }
    >();
    const send = (value: object) =>
      child.stdin!.write(`${JSON.stringify({ jsonrpc: "2.0", ...value })}\n`);
    const call = (method: string, params: object) => {
      const id = String(++nextId);
      return new Promise<Record<string, unknown>>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        send({ id, method, params });
      });
    };
    const fail = (error: unknown) => {
      const normalized =
        error instanceof Error ? error : new Error(String(error));
      for (const request of pending.values()) request.reject(normalized);
      pending.clear();
    };
    const timeout = setTimeout(() => {
      fail(new Error("Codex session deletion timed out."));
      controller.abort();
    }, 15_000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const message = JSON.parse(line) as RpcMessage;
          if (message.id === undefined || message.method) continue;
          const request = pending.get(String(message.id));
          if (!request) continue;
          pending.delete(String(message.id));
          if (message.error)
            request.reject(
              new Error(
                message.error.message ?? "Codex app-server request failed.",
              ),
            );
          else request.resolve(message.result ?? {});
        } catch (error) {
          fail(error);
        }
      }
    });
    child.once("error", fail);
    try {
      await call("initialize", {
        clientInfo: { name: "claims-ai-portfolio", version: "1" },
      });
      send({ method: "initialized", params: {} });
      await call("thread/delete", { threadId: sessionId });
    } finally {
      clearTimeout(timeout);
      controller.abort();
      child.kill("SIGTERM");
    }
  }
}
