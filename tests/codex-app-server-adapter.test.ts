import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess } from "node:child_process";
import {
  CodexChatCaptureAdapter,
  sanitizeCodexChatText,
} from "../packages/ai-runtime/src/codex-chat-adapter.ts";

function fakeServer(
  onMessage: (message: Record<string, any>, output: PassThrough) => void,
) {
  const input = new PassThrough();
  const output = new PassThrough();
  const child = Object.assign(new EventEmitter(), {
    stdin: input,
    stdout: output,
    kill: () => true,
  }) as unknown as ChildProcess;
  let buffer = "";
  input.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line) onMessage(JSON.parse(line), output);
  });
  return child;
}

const request = (overrides: Record<string, unknown> = {}) => ({
  processId: "PROC-1",
  sessionId: "stored-thread",
  resume: false,
  prompt: "Bitte prüfen",
  systemPrompt: "System",
  model: "gpt-5.6-sol",
  cwd: "/tmp/process",
  timeoutMs: 10_000,
  maxBudgetUsd: 1,
  signal: new AbortController().signal,
  writeProcessFlow: async () => ({ ok: true as const, revision: "rev-write" }),
  verifyProcessFlow: async () => ({ ok: true as const, revision: "rev-1" }),
  ...overrides,
});

test("Codex app-server follows the initialize, thread, turn, tool, completion protocol", async () => {
  const calls: Record<string, any>[] = [];
  let output!: PassThrough;
  const adapter = new CodexChatCaptureAdapter({
    start: () =>
      fakeServer((message, stream) => {
        output = stream;
        calls.push(message);
        if (message.method === "initialize")
          output.write(
            `${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} })}\n`,
          );
        if (message.method === "thread/start")
          output.write(
            `${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { thread: { id: "thread-1" } } })}\n`,
          );
        if (message.method === "turn/start")
          output.write(
            `${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { turn: { id: "turn-1" } } })}\n`,
          );
      }),
  });
  const handle = await adapter.startTurn(request());
  expect(calls.map((call) => call.method)).toEqual([
    "initialize",
    "initialized",
    "thread/start",
    "turn/start",
  ]);
  expect(calls[0]?.params).toMatchObject({
    clientInfo: { name: "claims-ai-portfolio" },
    capabilities: { experimentalApi: true },
  });
  expect(calls[2]?.params).toMatchObject({
    approvalPolicy: "never",
    permissions: ":read-only",
    runtimeWorkspaceRoots: ["/tmp/process"],
    dynamicTools: [
      { type: "function", name: "write_process_flow" },
      { type: "function", name: "verify_process_flow" },
    ],
  });
  expect(calls[2]?.params.dynamicTools[0].inputSchema).toMatchObject({
    required: ["content"],
  });
  expect(calls[3]?.params).toMatchObject({
    threadId: "thread-1",
    permissions: ":read-only",
    runtimeWorkspaceRoots: ["/tmp/process"],
    effort: "medium",
  });
  expect(calls[3]?.params.input).toEqual([
    { type: "text", text: "Bitte prüfen", text_elements: [] },
  ]);
  const streamed = (async () => {
    const events = [];
    for await (const event of handle.result.fullStream) events.push(event);
    return events;
  })();
  output.write(
    `${JSON.stringify({ jsonrpc: "2.0", id: "tool-1", method: "item/tool/call", params: { threadId: "thread-1", turnId: "turn-1", callId: "call-1", tool: "verify_process_flow", arguments: {} } })}\n`,
  );
  await Bun.sleep(0);
  expect(calls.at(-1)).toEqual({
    jsonrpc: "2.0",
    id: "tool-1",
    result: {
      contentItems: [
        {
          type: "inputText",
          text: JSON.stringify({ ok: true, revision: "rev-1" }),
        },
      ],
      success: true,
    },
  });
  output.write(
    `${JSON.stringify({ jsonrpc: "2.0", method: "item/completed", params: { item: { type: "agentMessage", text: "Fertig." } } })}\n`,
  );
  output.write(
    `${JSON.stringify({ jsonrpc: "2.0", method: "turn/completed", params: { turn: { status: "completed" } } })}\n`,
  );
  expect(await handle.result.text).toBe("Fertig.");
  expect(await streamed).toHaveLength(1);
  expect(await handle.result.finishReason).toBe("stop");
  expect(handle.verification()).toEqual({ ok: true, revision: "rev-1" });
});

test("Codex app-server deletes persisted provider sessions", async () => {
  const calls: Record<string, any>[] = [];
  const adapter = new CodexChatCaptureAdapter({
    start: () =>
      fakeServer((message, output) => {
        calls.push(message);
        if (message.id)
          output.write(
            `${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} })}\n`,
          );
      }),
  });
  await adapter.deleteSession("thread-to-delete", "/tmp/process");
  expect(calls.map((call) => call.method)).toEqual([
    "initialize",
    "initialized",
    "thread/delete",
  ]);
  expect(calls[2]?.params).toEqual({ threadId: "thread-to-delete" });
});

test("Codex app-server resumes the stored thread for a later user turn", async () => {
  const calls: Record<string, any>[] = [];
  let output!: PassThrough;
  const adapter = new CodexChatCaptureAdapter({
    start: () =>
      fakeServer((message, stream) => {
        output = stream;
        calls.push(message);
        if (message.method === "initialize")
          output.write(
            `${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} })}\n`,
          );
        if (message.method === "thread/resume")
          output.write(
            `${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { thread: { id: "stored-thread" } } })}\n`,
          );
        if (message.method === "turn/start") {
          output.write(
            `${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { turn: { id: "turn-2" } } })}\n`,
          );
          output.write(
            `${JSON.stringify({ jsonrpc: "2.0", method: "turn/completed", params: { turn: { status: "completed" } } })}\n`,
          );
        }
      }),
  });
  const handle = await adapter.startTurn(request({ resume: true }));
  await handle.result.text;
  expect(calls.map((call) => call.method)).toEqual([
    "initialize",
    "initialized",
    "thread/resume",
    "turn/start",
  ]);
  expect(calls[2]?.params.threadId).toBe("stored-thread");
});

test("Codex app-server interrupts and rejects an aborted turn", async () => {
  const controller = new AbortController();
  const calls: Record<string, any>[] = [];
  let output!: PassThrough;
  const adapter = new CodexChatCaptureAdapter({
    start: () =>
      fakeServer((message, stream) => {
        output = stream;
        calls.push(message);
        if (message.method === "initialize")
          output.write(
            `${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} })}\n`,
          );
        if (message.method === "thread/start")
          output.write(
            `${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { thread: { id: "thread-1" } } })}\n`,
          );
        if (message.method === "turn/start")
          output.write(
            `${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { turn: { id: "turn-1" } } })}\n`,
          );
      }),
  });
  const handle = await adapter.startTurn(
    request({ signal: controller.signal }),
  );
  const settled = Promise.allSettled([
    Promise.resolve(handle.result.text),
    Promise.resolve(handle.result.finalStep),
    Promise.resolve(handle.result.finishReason),
  ]);
  controller.abort();
  const [text] = await settled;
  expect(text?.status).toBe("rejected");
  expect(String((text as PromiseRejectedResult).reason)).toContain("cancelled");
  expect(calls.some((call) => call.method === "turn/interrupt")).toBeTrue();
});

test("Codex app-server does not start a turn without the preceding thread response", async () => {
  const calls: Record<string, any>[] = [];
  const adapter = new CodexChatCaptureAdapter({
    start: () =>
      fakeServer((message, output) => {
        calls.push(message);
        if (message.method === "initialize")
          output.write(
            `${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} })}\n`,
          );
        if (message.method === "thread/start")
          output.write(
            `${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} })}\n`,
          );
      }),
  });
  await expect(adapter.startTurn(request())).rejects.toThrow(
    "did not return a thread id",
  );
  expect(calls.map((call) => call.method)).toEqual([
    "initialize",
    "initialized",
    "thread/start",
  ]);
});

test("Codex chat removes host-only file citation directives", () => {
  expect(
    sanitizeCodexChatText(
      'Erfasst. :codex-file-citation{path="/tmp/private.json" purpose="source"}',
    ),
  ).toBe("Erfasst.");
});
