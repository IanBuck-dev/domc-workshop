import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Hono } from "hono";
import {
  ChatCaptureService,
  composeMemoryPrompt,
  memoryPromptMaximumBytes,
} from "../apps/server/src/chat-capture-service.ts";
import { MemoryRepository } from "../packages/storage/src/memory-repository.ts";
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
  streamError = false;
  skipFlowVerification = false;
  flowVerificationCalls = 0;
  /** Hält den Zug offen, bis der Test ihn freigibt — für Stopp-/Reload-Proben. */
  hold: Promise<void> | null = null;
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
    const flowVerification = this.skipFlowVerification
      ? null
      : await request.verifyProcessFlow();
    this.flowVerificationCalls++;
    let complete!: () => void;
    const completed = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const fullStream = (async function* (adapter: FakeChatAdapter) {
      yield { type: "reasoning-delta", id: "reasoning-1", text: "intern" };
      yield {
        type: "tool-call",
        toolCallId: "read-1",
        toolName: "Read",
        input: { file_path: "uploads/example.txt" },
      };
      yield {
        type: "tool-call",
        toolCallId: "write-1",
        toolName: "Write",
        input: { file_path: "process-understanding.json" },
      };
      if (adapter.streamError) throw new Error("provider failed");
      if (adapter.hold)
        await new Promise<void>((resolve, reject) => {
          const stop = () =>
            reject(new Error("Chat turn aborted by provider."));
          if (request.signal.aborted) return stop();
          request.signal.addEventListener("abort", stop, { once: true });
          adapter.hold!.then(resolve, reject);
        });
      complete();
    })(this);
    return {
      requestedSessionId: request.sessionId,
      verification: () => ({
        ok: flowVerification?.ok === true,
        revision: flowVerification?.ok ? flowVerification.revision : null,
      }),
      result: {
        fullStream,
        text: completed.then(() => "Ich habe einen ersten Stand erstellt."),
        finalStep: completed.then(() => ({
          providerMetadata: {
            "claude-code": { sessionId: request.sessionId },
          },
        })),
        finishReason: completed.then(() => this.finishReason),
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
  const knowledge = new MemoryRepository(root);
  const service = new ChatCaptureService(processes, ai, knowledge);
  const opportunityStarts: string[] = [];
  const opportunities = {
    async start(id: string) {
      opportunityStarts.push(id);
      return { operationId: crypto.randomUUID(), state: "queued" };
    },
  };
  const memoryStarts: string[] = [];
  const memory = {
    fail: false,
    enqueue(id: string) {
      if (this.fail) throw new Error("Fiktiver Memory-Startfehler");
      memoryStarts.push(id);
      return { operationId: crypto.randomUUID(), state: "queued" as const };
    },
  };
  const app = new Hono();
  app.route(
    "/api/processes",
    chatCaptureRoutes(
      service,
      processes,
      opportunities as any,
      undefined,
      memory as any,
    ),
  );
  return {
    app,
    processes,
    record,
    ai,
    service,
    knowledge,
    opportunities,
    opportunityStarts,
    memory,
    memoryStarts,
  };
}

/**
 * Öffnet die Unterlagen-Schleuse. Der Verzicht ist ein fest verdrahteter
 * Zustandswechsel ohne KI-Zug — Voraussetzung für jede gewöhnliche Nachricht.
 */
async function openGate(app: Hono, id: string) {
  const response = await app.request(
    `/api/processes/${id}/chat/skip-documents`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: crypto.randomUUID() }),
    },
  );
  expect(response.status).toBe(200);
}

/** Wartet, bis der Server keinen Zug mehr für diesen Prozess führt. */
async function settle(app: Hono, id: string) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const view = (await (
      await app.request(`/api/processes/${id}/chat`)
    ).json()) as {
      activeTurn: unknown;
    };
    if (!view.activeTurn) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Der Zug wurde nicht beendet.");
}

describe("chat capture API", () => {
  test("omits the memory block for an empty brain", async () => {
    const { record, ai, service } = await fixture();
    await service.skipDocuments(record.id, crypto.randomUUID());
    const turn = await service.startTurn(
      record.id,
      {
        id: crypto.randomUUID(),
        text: "Bitte erfassen.",
        action: "message",
        selectedUploadIds: [],
        mentions: [],
      },
      new AbortController().signal,
    );
    if (turn.duplicate) throw new Error("Expected a chat turn.");
    expect(ai.calls[0]?.prompt).not.toContain(
      "## Hintergrundwissen über das Unternehmen",
    );
  });

  test("injects memory only for the first and replacement chat session", async () => {
    const { record, ai, service, knowledge } = await fixture();
    await knowledge.applyOperations(
      "test",
      {
        operations: [
          {
            action: "add",
            topic: "glossar.md",
            fact: "Klausur ist die wöchentliche Abstimmung.",
          },
        ],
      },
      { processId: "PROC-0001", confirmedAt: "2026-08-10" },
    );
    await service.skipDocuments(record.id, crypto.randomUUID());
    const first = await service.startTurn(
      record.id,
      {
        id: crypto.randomUUID(),
        text: "Bitte erfassen.",
        action: "message",
        selectedUploadIds: [],
        mentions: [],
      },
      new AbortController().signal,
    );
    if (first.duplicate) throw new Error("Expected a chat turn.");
    expect(ai.calls[0]?.prompt).toContain(
      "## Hintergrundwissen über das Unternehmen",
    );
    expect(ai.calls[0]?.prompt).toContain("### Datei: offene-fragen.md");
    for await (const event of first.result.fullStream) {
      // Der Fake löst seinen Abschluss erst beim Konsum des Streams aus.
      void event;
    }
    await service.finishTurn(first);

    const next = await service.startTurn(
      record.id,
      {
        id: crypto.randomUUID(),
        text: "Bitte fortsetzen.",
        action: "message",
        selectedUploadIds: [],
        mentions: [],
      },
      new AbortController().signal,
    );
    if (next.duplicate) throw new Error("Expected a chat turn.");
    expect(ai.calls[1]?.prompt).not.toContain(
      "## Hintergrundwissen über das Unternehmen",
    );
    await service.failTurn(next, false);

    const recovery = await service.startTurn(
      record.id,
      {
        id: crypto.randomUUID(),
        text: "Bitte wiederholen.",
        action: "message",
        selectedUploadIds: [],
        mentions: [],
      },
      new AbortController().signal,
    );
    if (recovery.duplicate) throw new Error("Expected a chat turn.");
    expect(ai.calls[2]?.prompt).toContain(
      "## Hintergrundwissen über das Unternehmen",
    );
  });

  test("keeps a truncated memory block below 25 KiB without splitting bullets", () => {
    const topicFiles = {
      "glossar.md": "## Glossar\n\n",
      "systeme.md": "## Systeme\n\n",
      "zustaendigkeiten.md": "## Zuständigkeiten\n\n",
      "muster.md": "## Muster\n\n",
      "offene-fragen.md": "## Offene Fragen\n\n",
    };
    for (const topic of Object.keys(topicFiles) as Array<
      keyof typeof topicFiles
    >)
      topicFiles[topic] += Array.from(
        { length: 30 },
        (_, index) =>
          `- ${topic} Fakt ${index} ${"x".repeat(850)} (Quelle: PROC-0001, bestätigt 2026-08-10)`,
      ).join("\n");
    const composed = composeMemoryPrompt(topicFiles);
    expect(composed?.truncated).toBe(true);
    expect(composed?.actualBytes).toBeLessThanOrEqual(memoryPromptMaximumBytes);
    for (const topic of Object.keys(topicFiles))
      expect(composed?.block).toContain(`### Datei: ${topic}`);
    expect(
      composed?.block
        .split("\n")
        .filter((line) => line.startsWith("- "))
        .every((line) => line.endsWith(")")),
    ).toBe(true);
  });

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
      { ...cover, processName: "Fiktiver Formularprozess" },
      await processConfig(),
      "form",
    );
    const wrongMode = await app.request(`/api/processes/${formRecord.id}/chat`);
    expect(wrongMode.status).toBe(409);
  });

  test("streams a turn, resumes the same session, and persists one idempotent user event", async () => {
    const { app, record, ai, service } = await fixture();
    await openGate(app, record.id);
    const firstId = crypto.randomUUID();
    const first = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: firstId,
        text: "Bitte erfassen Sie den Prozess.",
        action: "message",
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
        mentions: [
          {
            kind: "node",
            nodeId: "step-1",
            label: "Schritt-1",
            nameSnapshot: "Eingang prüfen",
            understandingRevision: "a".repeat(64),
          },
        ],
      }),
    });
    await next.text();
    expect(ai.calls[1]?.resume).toBe(true);
    expect(ai.calls[1]?.prompt).toContain("historischer Name: Eingang prüfen");
    const transcript = await service.chats.transcript(record.id);
    expect(transcript.filter((item) => item.id === nextId)).toHaveLength(1);
    expect(
      transcript.find((item) => item.id === nextId)?.mentions[0],
    ).toMatchObject({
      nameSnapshot: "Eingang prüfen",
      understandingRevision: "a".repeat(64),
    });
  });

  test("publishes only safe transient activity and understanding events", async () => {
    const { app, record } = await fixture();
    await openGate(app, record.id);
    const response = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        text: "Bitte erfassen Sie den Prozess.",
        action: "message",
        selectedUploadIds: [],
        mentions: [],
      }),
    });
    const body = await response.text();
    expect(body).toContain('"type":"data-chat-activity"');
    expect(body).toContain('"kind":"updating_diagram"');
    expect(body).toContain('"kind":"checking_open_points"');
    expect(body).toContain('"transient":true');
    expect(body).toContain('"type":"data-understanding-state"');
    expect(body).not.toContain("reasoning-1");
    expect(body).not.toContain("intern");
    expect(body).not.toContain("uploads/example.txt");
    expect(body).not.toContain("process-understanding.json");
  });

  test("fails the turn when the agent does not finish with a green flow check", async () => {
    const { app, record, ai, service } = await fixture();
    await openGate(app, record.id);
    ai.skipFlowVerification = true;
    const response = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        text: "Bitte erfassen Sie den Prozess.",
        action: "message",
        selectedUploadIds: [],
        mentions: [],
      }),
    });
    expect(await response.text()).toContain(
      "Die Antwort konnte nicht abgeschlossen werden",
    );
    expect((await service.chats.state(record.id)).lastTurnOutcome).toBe(
      "failed",
    );
    expect(await service.chats.lastValid(record.id)).toBeNull();
  });

  test("returns duplicate turns with safe state and idle cleanup only", async () => {
    const { app, record, ai } = await fixture();
    await openGate(app, record.id);
    const request = {
      id: crypto.randomUUID(),
      text: "Bitte erfassen Sie den Prozess.",
      action: "message",
      selectedUploadIds: [],
      mentions: [],
    };
    await (
      await app.request(`/api/processes/${record.id}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      })
    ).text();
    const duplicate = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    const body = await duplicate.text();
    expect(ai.calls).toHaveLength(1);
    expect(body).toContain('"type":"data-understanding-state"');
    expect(body).toContain('"state":"idle"');
    expect(body).toContain('"transient":true');
  });

  test("cleans up activity and persists a failed provider stream once", async () => {
    const { app, record, ai, service } = await fixture();
    await openGate(app, record.id);
    ai.streamError = true;
    const response = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        text: "Bitte erfassen Sie den Prozess.",
        action: "message",
        selectedUploadIds: [],
        mentions: [],
      }),
    });
    const body = await response.text();
    expect(body).toContain('"state":"idle"');
    expect(body).toContain("Die Antwort konnte nicht abgeschlossen werden");
    expect((await service.chats.state(record.id)).lastTurnOutcome).toBe(
      "failed",
    );
  });

  test("requires explicit override, confirms durably, and starts opportunities", async () => {
    const { app, processes, record, opportunityStarts } = await fixture();
    await openGate(app, record.id);
    const turn = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        text: "Bitte erfassen Sie den Prozess.",
        action: "message",
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
    await openGate(app, record.id);
    ai.completeUnderstanding = true;
    const turn = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        text: "Bitte erfassen Sie den Prozess.",
        action: "message",
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
    await openGate(app, record.id);
    ai.finishReason = "error";
    const response = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        text: "Bitte erfassen Sie den Prozess.",
        action: "message",
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
    await service.skipDocuments(record.id, crypto.randomUUID());
    const controller = new AbortController();
    const active = await service.startTurn(
      record.id,
      {
        id: crypto.randomUUID(),
        text: "Bitte erfassen Sie den Prozess.",
        action: "message",
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
    await openGate(app, record.id);
    const turn = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        text: "Bitte erfassen Sie den Prozess.",
        action: "message",
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

  test("starts memory separately and audits a memory start failure without rollback", async () => {
    const { app, processes, record, memory, memoryStarts } = await fixture();
    await openGate(app, record.id);
    const turn = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        text: "Bitte erfassen Sie den Prozess.",
        action: "message",
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
        body: JSON.stringify({ override: true }),
      },
    );
    expect((await confirmed.json()).memoryStart).toBe("started");
    expect(memoryStarts).toEqual([record.id]);

    // Eigener Name: Prozessnamen sind seit der Dublettenprüfung eindeutig.
    const second = await processes.create(
      { ...cover, processName: `${cover.processName} (zweite Aufnahme)` },
      await processConfig(),
      "chat",
    );
    memory.fail = true;
    await openGate(app, second.id);
    const secondTurn = await app.request(`/api/processes/${second.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        text: "Bitte erfassen Sie den Prozess.",
        action: "message",
        selectedUploadIds: [],
        mentions: [],
      }),
    });
    await secondTurn.text();
    const failed = await app.request(
      `/api/processes/${second.id}/chat/confirm`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ override: true }),
      },
    );
    expect((await failed.json()).memoryStart).toBe("failed");
    expect((await processes.required(second.id)).state).toBe("confirmed");
    expect(
      (await processes.history(second.id)).some(
        (entry) => entry.event === "memory-distillation-failed",
      ),
    ).toBe(true);
  });

  test("skips documents without any model call and stays idempotent", async () => {
    const { app, record, ai, service } = await fixture();
    const turnId = crypto.randomUUID();
    const body = { id: turnId };
    const first = await app.request(
      `/api/processes/${record.id}/chat/skip-documents`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ duplicate: false });
    expect(ai.calls).toHaveLength(0);
    const state = await service.chats.state(record.id);
    expect(state.documentGate).toBe("skipped");
    expect(state.lastTurnOutcome).toBe("completed");
    // Eröffnungsnachricht plus das feste Paar aus Verzicht und Rückfrage.
    const transcript = await service.chats.transcript(record.id);
    expect(transcript).toHaveLength(3);
    expect(transcript[1]).toMatchObject({
      role: "user",
      action: "skip_documents",
      status: "complete",
    });
    expect(transcript[2]).toMatchObject({
      role: "assistant",
      action: "skip_documents",
      status: "complete",
    });
    expect(transcript[2]?.text).toContain("Was löst den Vorgang aus");
    const repeat = await app.request(
      `/api/processes/${record.id}/chat/skip-documents`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    // Zweiter Klick auf denselben Knopf: Die Schleuse ist zu, nichts wird
    // doppelt geschrieben.
    expect(repeat.status).toBe(409);
    expect(await service.chats.transcript(record.id)).toHaveLength(3);
  });

  test("keeps a turn running when the client connection goes away", async () => {
    const { app, record, ai, service } = await fixture();
    await openGate(app, record.id);
    let release!: () => void;
    ai.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const response = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        text: "Bitte erfassen Sie den Prozess.",
        action: "message",
        selectedUploadIds: [],
        mentions: [],
      }),
    });
    // Neuladen der Seite: Der Antwortstrom wird verworfen, der Zug nicht.
    await response.body?.cancel();
    release();
    await settle(app, record.id);
    expect((await service.chats.state(record.id)).lastTurnOutcome).toBe(
      "completed",
    );
    const transcript = await service.chats.transcript(record.id);
    expect(transcript.at(-1)).toMatchObject({
      role: "assistant",
      status: "complete",
    });
    expect(transcript.at(-1)?.text).toContain(
      "Ich habe einen ersten Stand erstellt",
    );
  });

  test("reports the running turn, rejects a second one, and stops on request", async () => {
    const { app, record, ai, service } = await fixture();
    await openGate(app, record.id);
    ai.hold = new Promise<void>(() => {});
    const running = app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        text: "Bitte erfassen Sie den Prozess.",
        action: "message",
        selectedUploadIds: [],
        mentions: [],
      }),
    });
    await running;
    const view = await (
      await app.request(`/api/processes/${record.id}/chat`)
    ).json();
    expect(view.activeTurn).toMatchObject({ action: "message" });
    const second = await app.request(`/api/processes/${record.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        text: "Noch eine Nachricht.",
        action: "message",
        selectedUploadIds: [],
        mentions: [],
      }),
    });
    expect(second.status).toBe(409);
    expect(ai.calls).toHaveLength(1);
    const stopped = await app.request(`/api/processes/${record.id}/chat/stop`, {
      method: "POST",
    });
    expect(stopped.status).toBe(200);
    expect((await service.chats.state(record.id)).lastTurnOutcome).toBe(
      "aborted",
    );
    const idle = await app.request(`/api/processes/${record.id}/chat/stop`, {
      method: "POST",
    });
    expect(idle.status).toBe(409);
    expect(
      (
        (await (
          await app.request(`/api/processes/${record.id}/chat`)
        ).json()) as { activeTurn: unknown }
      ).activeTurn,
    ).toBeNull();
  });
});
