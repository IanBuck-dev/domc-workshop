import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryRepository } from "../packages/storage/src/memory-repository.ts";
import { WorkspaceRepository } from "../packages/storage/src/workspace-repository.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function root() {
  const value = await mkdtemp(join(tmpdir(), "memory-storage-"));
  roots.push(value);
  return value;
}

describe("memory storage", () => {
  test("initializes, snapshots before writes, and regenerates its index", async () => {
    const workspace = await root();
    const memory = new MemoryRepository(workspace);
    await memory.ensure();
    const initial = await memory.topicContents();
    expect(initial["glossar.md"]).toBe("## Glossar\n\n");
    await memory.applyOperations(
      "distillation:PROC-0001",
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
    expect(await memory.topics()).toMatchObject({
      "glossar.md": [{ fact: "Klausur ist die wöchentliche Abstimmung." }],
    });
    const history = await memory.history();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      trigger: "distillation:PROC-0001",
      previous: { "glossar.md": initial["glossar.md"] },
    });
    const index = await readFile(
      join(workspace, "memory", "MEMORY.md"),
      "utf8",
    );
    expect(index).toContain("memory/glossar.md");
    expect(index).toContain("1 Eintrag");
    await writeFile(join(workspace, "memory", "MEMORY.md"), "falsch\n");
    await memory.ensure();
    expect(
      await readFile(join(workspace, "memory", "MEMORY.md"), "utf8"),
    ).toContain("Unternehmensgedächtnis");

    const beforeConsolidation = await memory.topicContents();
    await memory.replaceAllForConsolidation(beforeConsolidation, {
      mergedCount: 0,
      deletedCount: 0,
      movedCount: 0,
      deletions: [],
    });
    const consolidation = (await memory.history()).at(-1);
    expect(consolidation).toMatchObject({
      trigger: "consolidation",
      event: "memory-consolidated",
      summary: { mergedCount: 0, deletedCount: 0, movedCount: 0 },
      previous: beforeConsolidation,
    });
  });

  test("keeps memory when a workspace process reset moves process captures", async () => {
    const workspace = await root();
    const repository = new WorkspaceRepository(workspace);
    await repository.ensure();
    await repository.memory.applyOperations(
      "distillation:PROC-0001",
      {
        operations: [
          {
            action: "add",
            topic: "muster.md",
            fact: "Rückfragen werden per E-Mail bearbeitet.",
          },
        ],
      },
      { processId: "PROC-0001", confirmedAt: "2026-08-10" },
    );
    await repository.reset();
    expect((await repository.memory.topics())["muster.md"]).toHaveLength(1);
  });
});
