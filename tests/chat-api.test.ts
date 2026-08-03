import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Hono } from "hono";
import { ChatCaptureService } from "../apps/server/src/chat-capture-service.ts";
import { chatCaptureRoutes } from "../apps/server/src/routes/chat-captures.ts";
import type {
  ChatCaptureClaudeAdapter,
  ChatCaptureTurnRequest,
} from "../packages/claude/src/chat-capture-contracts.ts";
import { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";
import { cover, processConfig, understanding } from "./process-fixtures.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

class FakeChatAdapter implements ChatCaptureClaudeAdapter {
  calls: ChatCaptureTurnRequest[] = [];
  deleted: string[] = [];
  failDeletion = false;
  finishReason = "stop";
  completeUnderstanding = false;
  async startTurn(request: ChatCaptureTurnRequest) {
    this.calls.push(request);
    const lines = (
      await readFile(join(request.cwd, "chat", "transcript.jsonl"), "utf8")
    )
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const messageId = lines.filter((line) => line.role === "user").at(-1).id;
    const value = understanding();
    if (this.completeUnderstanding) {
      value.knowledgeGaps = [];
      value.conflicts = [];
    }
    for (const evidence of value.evidence) {
      evidence.kind = "chat_message";
      evidence.sourceId = messageId;
    }
    await writeFile(
      join(request.cwd, "process-understanding.json"),
      JSON.stringify(value),
    );
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: "text-start", id: "text-1" });
        controller.enqueue({
          type: "text-delta",
          id: "text-1",
          text: "Ich habe einen ersten Stand erstellt.",
        });
        controller.enqueue({ type: "text-end", id: "text-1" });
        controller.enqueue({
          type: "finish",
          finishReason: "stop",
          rawFinishReason: "end_turn",
          totalUsage: {
            inputTokens: 1,
            outputTokens: 1,
            totalTokens: 2,
            reasoningTokens: 0,
            cachedInputTokens: 0,
          },
        });
        controller.close();
      },
    });
    return {
      requestedSessionId: request.sessionId,
      result: {
        stream,
        text: Promise.resolve("Ich habe einen ersten Stand erstellt."),
        finalStep: Promise.resolve({
          providerMetadata: {
            "claude-code": { sessionId: request.sessionId },
          },
        }),
        finishReason: Promise.resolve(this.finishReason),
        consumeStream: async () => {
          await stream.pipeTo(new WritableStream());
        },
      } as any,
    };
  }
  async deleteSession(sessionId: string) {
    if (this.failDeletion) throw new Error("session cleanup failed");
    this.deleted.push(sessionId);
  }
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "chat-api-"));
  roots.push(root);
  const processes = new ProcessCaptureRepository(root);
  const record = await processes.create(cover, await processConfig(), "chat");
  const ai = new FakeChatAdapter();
  const service = new ChatCaptureService(processes, ai);
  const opportunityStarts: string[] = [];
  const opportunities = {
    async start(id: string) {
      opportunityStarts.push(id);
      return { operationId: crypto.randomUUID(), state: "queued" };
    },
  };
  const app = new Hono();
  app.route(
    "/api/processes",
    chatCaptureRoutes(service, processes, opportunities as any),
  );
  return {
    app,
    processes,
    record,
    ai,
    service,
    opportunities,
    opportunityStarts,
  };
}

describe("chat capture API", () => {
  test("GET is passive and the document gate blocks ordinary messages", async () => {
    const { app, processes, record, ai } = await fixture();
    const view = await app.request(`/api/processes/${record.id}/chat`);
    expect(view.status).toBe(200);
    expect(ai.calls).toHaveLength(0);
    const blocked = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        text: "Normaler Text",
        action: "message",
        selectedUploadIds: [],
        mentions: [],
      }),
    });
    expect(blocked.status).toBe(409);
    expect(ai.calls).toHaveLength(0);
    const formRecord = await processes.create(
      cover,
      await processConfig(),
      "form",
    );
    const wrongMode = await app.request(`/api/processes/${formRecord.id}/chat`);
    expect(wrongMode.status).toBe(409);
  });

  test("streams a turn, resumes the same session, and persists one idempotent user event", async () => {
    const { app, record, ai, service } = await fixture();
    const firstId = crypto.randomUUID();
    const first = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: firstId,
        text: "Ohne Unterlagen fortfahren.",
        action: "skip_documents",
        selectedUploadIds: [],
        mentions: [],
      }),
    });
    expect(first.status).toBe(200);
    expect(first.headers.get("content-type")).toContain("text/event-stream");
    expect(await first.text()).toContain(
      "Ich habe einen ersten Stand erstellt",
    );
    expect(ai.calls[0]?.resume).toBe(false);
    const nextId = crypto.randomUUID();
    const next = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: nextId,
        text: "Bitte Schritt 1 präzisieren.",
        action: "message",
        selectedUploadIds: [],
        mentions: [{ kind: "step", stepId: "step-1", label: "Schritt-1" }],
      }),
    });
    await next.text();
    expect(ai.calls[1]?.resume).toBe(true);
    const transcript = await service.chats.transcript(record.id);
    expect(transcript.filter((item) => item.id === nextId)).toHaveLength(1);
  });

  test("requires explicit override, confirms durably, and starts opportunities", async () => {
    const { app, processes, record, opportunityStarts } = await fixture();
    const turn = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        text: "Ohne Unterlagen fortfahren.",
        action: "skip_documents",
        selectedUploadIds: [],
        mentions: [],
      }),
    });
    await turn.text();
    const blocked = await app.request(
      `/api/processes/${record.id}/chat/confirm`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ override: false }),
      },
    );
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).code).toBe("confirmation_override_required");
    const confirmed = await app.request(
      `/api/processes/${record.id}/chat/confirm`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ override: true }),
      },
    );
    expect(confirmed.status).toBe(200);
    expect((await confirmed.json()).opportunityStart).toBe("started");
    expect((await processes.required(record.id)).confirmationQuality).toBe(
      "with_gaps",
    );
    expect(opportunityStarts).toEqual([record.id]);
  });

  test("confirms a complete understanding without override and starts opportunities", async () => {
    const { app, processes, record, ai, opportunityStarts } = await fixture();
    ai.completeUnderstanding = true;
    const turn = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        text: "Ohne Unterlagen fortfahren.",
        action: "skip_documents",
        selectedUploadIds: [],
        mentions: [],
      }),
    });
    await turn.text();
    const confirmed = await app.request(
      `/api/processes/${record.id}/chat/confirm`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ override: false }),
      },
    );
    expect(confirmed.status).toBe(200);
    expect((await confirmed.json()).opportunityStart).toBe("started");
    expect((await processes.required(record.id)).confirmationQuality).toBe(
      "complete",
    );
    expect(opportunityStarts).toEqual([record.id]);
  });

  test("retains the process when Claude session cleanup fails", async () => {
    const { processes, record, ai, service } = await fixture();
    ai.failDeletion = true;
    await expect(service.deleteSessions(record.id)).rejects.toThrow(
      "session cleanup failed",
    );
    expect((await processes.required(record.id)).id).toBe(record.id);
    ai.failDeletion = false;
    const ids = await service.chats.deletionSessionIds(record.id);
    await service.deleteSessions(record.id);
    expect(ai.deleted).toEqual(ids);
    await processes.deleteCapture(record.id);
    expect(await processes.get(record.id)).toBeNull();
  });

  test("records an unclean provider finish as failed and prepares recovery", async () => {
    const { app, record, ai, service } = await fixture();
    ai.finishReason = "error";
    const response = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        text: "Ohne Unterlagen fortfahren.",
        action: "skip_documents",
        selectedUploadIds: [],
        mentions: [],
      }),
    });
    const body = await response.text();
    expect(body).not.toContain("Ich habe einen ersten Stand erstellt");
    expect(body).toContain(
      "Die Antwort konnte nicht abgeschlossen werden. Ihre Angaben bleiben erhalten.",
    );
    expect((await service.chats.state(record.id)).lastTurnOutcome).toBe(
      "failed",
    );
    expect(
      (await service.chats.session(record.id)).replacementCandidateId,
    ).not.toBeNull();
    ai.finishReason = "stop";
    const recovery = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        text: "Bitte mit dem gespeicherten Stand fortfahren.",
        action: "message",
        selectedUploadIds: [],
        mentions: [],
      }),
    });
    await recovery.text();
    expect(ai.calls[1]?.resume).toBe(false);
    expect(ai.calls[1]?.sessionId).not.toBe(ai.calls[0]?.sessionId);
    expect(ai.calls[1]?.prompt).toContain(
      "Wiederherstellung einer unterbrochenen Sitzung",
    );
    expect((await service.chats.session(record.id)).replacedSessionIds).toEqual(
      [ai.calls[0]!.sessionId],
    );
  });

  test("forwards abort state and records an explicitly aborted turn", async () => {
    const { record, ai, service } = await fixture();
    const controller = new AbortController();
    const active = await service.startTurn(
      record.id,
      {
        id: crypto.randomUUID(),
        text: "Ohne Unterlagen fortfahren.",
        action: "skip_documents",
        selectedUploadIds: [],
        mentions: [],
      },
      controller.signal,
    );
    expect(active.duplicate).toBe(false);
    expect(ai.calls[0]?.signal).toBe(controller.signal);
    controller.abort();
    if (!active.duplicate) await service.failTurn(active, true);
    expect((await service.chats.state(record.id)).lastTurnOutcome).toBe(
      "aborted",
    );
    expect(
      (await service.chats.session(record.id)).replacementCandidateId,
    ).toBeNull();
  });

  test("keeps confirmation durable when automatic opportunity start fails", async () => {
    const { app, processes, record, opportunities } = await fixture();
    const turn = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        text: "Ohne Unterlagen fortfahren.",
        action: "skip_documents",
        selectedUploadIds: [],
        mentions: [],
      }),
    });
    await turn.text();
    opportunities.start = async () => {
      throw new Error("Fiktiver Startfehler");
    };
    const confirmed = await app.request(
      `/api/processes/${record.id}/chat/confirm`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ override: true }),
      },
    );
    expect(confirmed.status).toBe(200);
    expect((await confirmed.json()).opportunityStart).toBe("failed");
    expect((await processes.required(record.id)).state).toBe("confirmed");
  });
});
