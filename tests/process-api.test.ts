import { afterEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { processCaptureRoutes } from "../apps/server/src/routes/process-captures.ts";
import { listProcessOperations } from "../apps/server/src/process-operation-manager.ts";
import type { ProcessAiAdapter } from "../packages/claude/src/process-ai-contracts.ts";
import { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";
import {
  answers,
  cover,
  processConfig,
  understanding,
  workCharacteristicAnswers,
} from "./process-fixtures.ts";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);
const trace = () => ({
  operationId: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  model: "sonnet",
  durationMs: 10,
  inputTokens: 2,
  outputTokens: 4,
  sandboxed: true,
});
async function fixture(followUp = false, aiOverride?: ProcessAiAdapter) {
  const root = await mkdtemp(join(tmpdir(), "process-api-"));
  roots.push(root);
  const repo = new ProcessCaptureRepository(root);
  const ai: ProcessAiAdapter = aiOverride ?? {
    followUps: async () => ({
      value: {
        followUps: followUp
          ? [
              {
                id: "question-1",
                topicId: "purpose-scope",
                question: "Welches Ergebnis entsteht?",
                rationale: "Ergebnis präzisieren.",
              },
            ]
          : [],
      },
      trace: trace(),
    }),
    synthesize: async () => ({ value: understanding(), trace: trace() }),
  };
  const app = new Hono();
  app.onError((error, c) =>
    c.json(
      { error: error.message },
      error.name === "ProcessCaptureNotFoundError" ? 404 : 400,
    ),
  );
  app.route("/api/processes", processCaptureRoutes(repo, ai));
  return { app, repo, config: await processConfig() };
}
async function waitForOperation(
  processId: string,
  state: "queued" | "running" | "failed",
) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const operation = listProcessOperations().find(
      (item) => item.processId === processId && item.state === state,
    );
    if (operation) return operation;
    await Bun.sleep(5);
  }
  throw new Error(`Operation state ${state} was not reached.`);
}
async function waitForState(
  repo: ProcessCaptureRepository,
  id: string,
  state: string,
) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const record = await repo.required(id);
      if (record.state === state) return record;
    } catch {
      // A synthesis updates its canonical JSON and metadata in two atomic
      // writes; retry while that bounded transition is in flight.
    }
    await Bun.sleep(5);
  }
  throw new Error(`State ${state} was not reached.`);
}
async function waitForNoActiveOperation(processId: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const active = listProcessOperations().some(
      (item) => item.processId === processId && item.state !== "failed",
    );
    if (!active) return;
    await Bun.sleep(5);
  }
  throw new Error("Process operation did not finish.");
}

describe("process capture API", () => {
  test("completes the no-followup happy path", async () => {
    const { app, repo, config } = await fixture();
    const createdResponse = await app.request("/api/processes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cover, config, demoDataConfirmed: true }),
    });
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json();
    const saved = await app.request(`/api/processes/${created.id}/answers`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        answers: answers(),
        workCharacteristicAnswers: workCharacteristicAnswers(),
        selectedUploadIds: [],
      }),
    });
    expect(saved.status).toBe(200);
    const analyze = await app.request(`/api/processes/${created.id}/analyze`, {
      method: "POST",
    });
    expect(analyze.status).toBe(202);
    expect(
      (await waitForState(repo, created.id, "synthesis_ready")).followUps,
    ).toEqual([]);
    await waitForNoActiveOperation(created.id);
    const synthesize = await app.request(
      `/api/processes/${created.id}/synthesize`,
      { method: "POST" },
    );
    expect(synthesize.status).toBe(202);
    expect(
      (await waitForState(repo, created.id, "review_required")).understanding
        ?.steps,
    ).toHaveLength(5);
    await waitForNoActiveOperation(created.id);
    const correctedCharacteristics = workCharacteristicAnswers();
    correctedCharacteristics[3]!.selectedOptionIds = ["unsure"];
    const corrected = await app.request(
      `/api/processes/${created.id}/work-characteristics`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: correctedCharacteristics,
          reason: "Entscheidung fachlich präzisiert.",
        }),
      },
    );
    expect(corrected.status).toBe(200);
    expect((await corrected.json()).workCharacteristicAnswers[3]).toMatchObject(
      { selectedOptionIds: ["unsure"] },
    );
    const confirmed = await app.request(
      `/api/processes/${created.id}/confirm`,
      { method: "POST" },
    );
    expect(confirmed.status).toBe(200);
    expect((await confirmed.json()).state).toBe("confirmed");
    const deleted = await app.request(`/api/processes/${created.id}`, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ id: created.id, deleted: true });
  });

  test("rejects missing, conflicting, and unknown work-characteristic answers", async () => {
    const { app, repo, config } = await fixture();
    const created = await (
      await app.request("/api/processes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cover, config, demoDataConfirmed: true }),
      })
    ).json();
    const missing = await app.request(`/api/processes/${created.id}/answers`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers: answers() }),
    });
    expect(missing.status).toBe(400);
    expect((await repo.required(created.id)).mainAnswers).toEqual([]);
    expect(
      (
        await app.request(`/api/processes/${created.id}/analyze`, {
          method: "POST",
        })
      ).status,
    ).toBe(409);

    const conflicting = workCharacteristicAnswers();
    conflicting[1]!.selectedOptionIds = ["none", "free-text"];
    expect(
      (
        await app.request(`/api/processes/${created.id}/answers`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            answers: answers(),
            workCharacteristicAnswers: conflicting,
          }),
        })
      ).status,
    ).toBe(400);

    const unknown = workCharacteristicAnswers();
    unknown[0]!.selectedOptionIds = ["unknown"];
    expect(
      (
        await app.request(`/api/processes/${created.id}/answers`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            answers: answers(),
            workCharacteristicAnswers: unknown,
          }),
        })
      ).status,
    ).toBe(400);
  });

  test("permits exactly one returned followup round", async () => {
    const { app, repo, config } = await fixture(true);
    const created = await (
      await app.request("/api/processes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cover, config, demoDataConfirmed: true }),
      })
    ).json();
    await app.request(`/api/processes/${created.id}/answers`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        answers: answers(),
        workCharacteristicAnswers: workCharacteristicAnswers(),
      }),
    });
    await app.request(`/api/processes/${created.id}/analyze`, {
      method: "POST",
    });
    const pending = await waitForState(repo, created.id, "follow_up_required");
    expect(pending.followUps).toHaveLength(1);
    expect(
      (
        await app.request(`/api/processes/${created.id}/analyze`, {
          method: "POST",
        })
      ).status,
    ).toBe(409);
    const response = await app.request(
      `/api/processes/${created.id}/follow-ups`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: [
            {
              questionId: "question-1",
              topicId: "purpose-scope",
              text: "Eine geprüfte Ansprache wurde versendet.",
              answeredAt: new Date().toISOString(),
            },
          ],
        }),
      },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).state).toBe("synthesis_ready");
  });

  test("enforces upload statuses and permanent deletion", async () => {
    const { app, repo, config } = await fixture();
    const created = await (
      await app.request("/api/processes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cover, config, demoDataConfirmed: true }),
      })
    ).json();
    const multipart = new FormData();
    multipart.set(
      "file",
      new File(["Ablauf"], "ablauf.txt", { type: "text/plain" }),
    );
    const upload = await app.request(`/api/processes/${created.id}/uploads`, {
      method: "POST",
      body: multipart,
    });
    expect(upload.status).toBe(201);
    const uploadRecord = await upload.json();
    const inline = await app.request(
      `/api/processes/${created.id}/uploads/${uploadRecord.id}`,
    );
    expect(inline.status).toBe(200);
    expect(await inline.text()).toBe("Ablauf");
    expect(inline.headers.get("content-type")).toBe("text/plain");
    expect(inline.headers.get("content-disposition")).toContain("inline;");
    expect(inline.headers.get("cache-control")).toBe("private, no-store");
    expect(inline.headers.get("x-content-type-options")).toBe("nosniff");
    expect(inline.headers.get("cross-origin-resource-policy")).toBe(
      "same-origin",
    );
    const download = await app.request(
      `/api/processes/${created.id}/uploads/${uploadRecord.id}?download=1`,
    );
    expect(download.status).toBe(200);
    expect(download.headers.get("content-disposition")).toContain(
      'attachment; filename="ablauf.txt"',
    );
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(
      new TextEncoder().encode("Ablauf"),
    );
    expect(
      (
        await app.request(
          `/api/processes/${created.id}/uploads/${crypto.randomUUID()}`,
        )
      ).status,
    ).toBe(404);
    const second = await repo.create(cover, config);
    expect(
      (
        await app.request(
          `/api/processes/${second.id}/uploads/${uploadRecord.id}`,
        )
      ).status,
    ).toBe(404);
    await Bun.write(
      repo.uploadPath(created.id, uploadRecord.id, uploadRecord.name),
      "manipuliert",
    );
    const corrupt = await app.request(
      `/api/processes/${created.id}/uploads/${uploadRecord.id}`,
    );
    expect(corrupt.status).toBe(500);
    expect(await corrupt.json()).toEqual({
      error: "Die Datei kann derzeit nicht bereitgestellt werden.",
    });
    const bad = new FormData();
    bad.set(
      "file",
      new File(["x"], "bad.exe", { type: "application/octet-stream" }),
    );
    expect(
      (
        await app.request(`/api/processes/${created.id}/uploads`, {
          method: "POST",
          body: bad,
        })
      ).status,
    ).toBe(415);
    const fakePdf = new FormData();
    fakePdf.set(
      "file",
      new File(["kein PDF"], "falsch.pdf", { type: "application/pdf" }),
    );
    expect(
      (
        await app.request(`/api/processes/${created.id}/uploads`, {
          method: "POST",
          body: fakePdf,
        })
      ).status,
    ).toBe(415);
    const deleted = await app.request(`/api/processes/${created.id}`, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);
    expect((await app.request(`/api/processes/${created.id}`)).status).toBe(
      404,
    );
    expect((await app.request("/api/processes/legacy")).status).toBe(404);
    expect(
      (
        await app.request("/api/processes/PROC-9999/analyze", {
          method: "POST",
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await app.request("/api/processes/PROC-9999/answers", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers: answers() }),
        })
      ).status,
    ).toBe(404);
  });

  test("retries failed analysis and synthesis without mutating canonical state", async () => {
    let followUpCalls = 0;
    let synthesisCalls = 0;
    const ai: ProcessAiAdapter = {
      followUps: async () => {
        followUpCalls++;
        if (followUpCalls === 1) throw new Error("malformed model output");
        return { value: { followUps: [] }, trace: trace() };
      },
      synthesize: async () => {
        synthesisCalls++;
        if (synthesisCalls === 1) throw new Error("operation timed out");
        return { value: understanding(), trace: trace() };
      },
    };
    const { app, repo, config } = await fixture(false, ai);
    const created = await (
      await app.request("/api/processes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cover, config, demoDataConfirmed: true }),
      })
    ).json();
    await app.request(`/api/processes/${created.id}/answers`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        answers: answers(),
        workCharacteristicAnswers: workCharacteristicAnswers(),
      }),
    });

    expect(
      (
        await app.request(`/api/processes/${created.id}/analyze`, {
          method: "POST",
        })
      ).status,
    ).toBe(202);
    await waitForOperation(created.id, "failed");
    expect((await repo.required(created.id)).state).toBe("capture_in_progress");
    expect((await repo.required(created.id)).followUps).toEqual([]);

    await app.request(`/api/processes/${created.id}/analyze`, {
      method: "POST",
    });
    await waitForState(repo, created.id, "synthesis_ready");
    await waitForNoActiveOperation(created.id);
    expect(followUpCalls).toBe(2);

    await app.request(`/api/processes/${created.id}/synthesize`, {
      method: "POST",
    });
    await waitForOperation(created.id, "failed");
    expect((await repo.required(created.id)).state).toBe("synthesis_ready");
    expect((await repo.required(created.id)).understanding).toBeNull();

    await app.request(`/api/processes/${created.id}/synthesize`, {
      method: "POST",
    });
    expect(
      (await waitForState(repo, created.id, "review_required")).understanding
        ?.steps,
    ).toHaveLength(5);
    await waitForNoActiveOperation(created.id);
    expect(synthesisCalls).toBe(2);
  });
});
