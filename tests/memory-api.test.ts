import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { memoryRoutes } from "../apps/server/src/routes/memory.ts";
import {
  enqueueMemoryConsolidation,
  memoryConsolidationStatus,
} from "../apps/server/src/process-operation-manager.ts";
import { MemoryRepository } from "../packages/storage/src/memory-repository.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function memoryRepository() {
  const root = await mkdtemp(join(tmpdir(), "memory-api-"));
  roots.push(root);
  const memory = new MemoryRepository(root);
  await memory.ensure();
  return memory;
}

/** Nur die Prozessaufnahmen, die der Test kennt — alles andere gilt als gelöscht. */
function processStore(
  known: Record<
    string,
    {
      processName: string;
      department: string;
      participantName: string;
      participantEmail: string;
    }
  > = {
    "PROC-0001": {
      processName: "Schadenmeldung erfassen",
      department: "Schaden",
      participantName: "Nina Berger",
      participantEmail: "nina.berger@lifecorp.example",
    },
  },
) {
  return {
    async get(id: string) {
      const cover = known[id];
      return cover ? { id, cover } : null;
    },
  };
}

function appWith(
  memory: MemoryRepository,
  service: unknown = { start() {} },
  processes: unknown = processStore(),
) {
  const app = new Hono();
  app.route(
    "/api/memory",
    memoryRoutes(service as never, memory, processes as never),
  );
  return app;
}

async function addFact(memory: MemoryRepository, fact: string) {
  await memory.applyOperations(
    "distillation:PROC-0001",
    { operations: [{ action: "add", topic: "glossar.md", fact }] },
    { processId: "PROC-0001", confirmedAt: "2026-08-10" },
  );
}

describe("memory API", () => {
  test("returns the five topics with counts and the last learned date", async () => {
    const memory = await memoryRepository();
    await addFact(memory, "Klausur ist die wöchentliche Abstimmung.");
    const response = await appWith(memory).request("/api/memory");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.topics).toHaveLength(5);
    expect(body.isEmpty).toBe(false);
    expect(body.entryCount).toBe(1);
    expect(body.lastLearnedAt).toBe("2026-08-10");
    expect(body.topics[0]).toMatchObject({
      id: "glossar",
      title: "Glossar",
      entryCount: 1,
      lastLearnedAt: "2026-08-10",
      entries: [
        {
          fact: "Klausur ist die wöchentliche Abstimmung.",
          learnedAt: "2026-08-10",
        },
      ],
    });
    // Keine Dateinamen oder Pfade an die Oberfläche.
    expect(JSON.stringify(body)).not.toContain(".md");
  });

  test("joins the process behind every entry without leaking contact data", async () => {
    const memory = await memoryRepository();
    await addFact(memory, "Klausur ist die wöchentliche Abstimmung.");
    const body = await (await appWith(memory).request("/api/memory")).json();
    expect(body.topics[0].entries[0].sources).toEqual([
      {
        processId: "PROC-0001",
        exists: true,
        processName: "Schadenmeldung erfassen",
        department: "Schaden",
        participantName: "Nina Berger",
      },
    ]);
    expect(JSON.stringify(body)).not.toContain("@");
  });

  test("keeps working when the source process was deleted", async () => {
    const memory = await memoryRepository();
    await addFact(memory, "Klausur ist die wöchentliche Abstimmung.");
    const response = await appWith(
      memory,
      { start() {} },
      processStore({}),
    ).request("/api/memory");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.topics[0].entries[0].sources).toEqual([
      {
        processId: "PROC-0001",
        exists: false,
        processName: null,
        department: null,
        participantName: null,
      },
    ]);
  });

  test("treats an unreadable process capture as deleted", async () => {
    const memory = await memoryRepository();
    await addFact(memory, "Klausur ist die wöchentliche Abstimmung.");
    const broken = {
      get() {
        return Promise.reject(new Error("Ungültige Prozessaufnahme."));
      },
    };
    const response = await appWith(memory, { start() {} }, broken).request(
      "/api/memory",
    );
    expect(response.status).toBe(200);
    expect(
      (await response.json()).topics[0].entries[0].sources[0],
    ).toMatchObject({ processId: "PROC-0001", exists: false });
  });

  test("reports the empty state before anything was learned", async () => {
    const memory = await memoryRepository();
    const body = await (await appWith(memory).request("/api/memory")).json();
    expect(body).toMatchObject({
      isEmpty: true,
      entryCount: 0,
      lastLearnedAt: null,
    });
  });

  test("reset snapshots the previous state before emptying the files", async () => {
    const memory = await memoryRepository();
    await addFact(memory, "Klausur ist die wöchentliche Abstimmung.");
    const before = await memory.topicContents();
    const response = await appWith(memory).request("/api/memory", {
      method: "DELETE",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      isEmpty: true,
      entryCount: 0,
    });
    expect(await memory.topics()).toMatchObject({ "glossar.md": [] });
    const history = await memory.history();
    expect(history.at(-1)).toMatchObject({
      trigger: "manueller Reset",
      previous: { "glossar.md": before["glossar.md"] },
    });
    expect(history.at(-1)!.previous["glossar.md"]).toContain("Klausur");
  });

  test("accepts one queued consolidation and rejects a parallel start", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const service = {
      start() {
        return enqueueMemoryConsolidation(async () => {
          await gate;
          return {
            mergedCount: 0,
            deletedCount: 0,
            movedCount: 0,
            deletions: [],
          };
        });
      },
    };
    const app = appWith(await memoryRepository(), service);
    const first = await app.request("/api/memory/consolidate", {
      method: "POST",
    });
    expect(first.status).toBe(202);
    expect(await first.json()).toMatchObject({ state: "queued" });
    const second = await app.request("/api/memory/consolidate", {
      method: "POST",
    });
    expect(second.status).toBe(409);
    expect((await second.json()).error).toContain("läuft bereits");
    release();
    await until(() => memoryConsolidationStatus().state === "completed");
  });
});

async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await Bun.sleep(2);
  }
  throw new Error("Expected consolidation state was not reached.");
}
