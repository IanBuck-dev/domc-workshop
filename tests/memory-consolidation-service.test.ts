import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MemoryConsolidationAiAdapter } from "../packages/claude/src/memory-consolidation-contracts.ts";
import type { MemoryConsolidationResult } from "../packages/domain/src/memory.ts";
import { MemoryRepository } from "../packages/storage/src/memory-repository.ts";
import { runMemoryConsolidation } from "../apps/server/src/memory-consolidation-service.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function memory() {
  const root = await mkdtemp(join(tmpdir(), "memory-consolidation-service-"));
  roots.push(root);
  return new MemoryRepository(root);
}

class FakeConsolidationAdapter implements MemoryConsolidationAiAdapter {
  calls = 0;
  value!: MemoryConsolidationResult;

  async consolidate() {
    this.calls += 1;
    return { value: this.value, trace: {} as any };
  }
}

describe("memory consolidation service", () => {
  test("skips an empty brain without adapter call, snapshot, or write", async () => {
    const repository = await memory();
    const ai = new FakeConsolidationAdapter();
    const result = await runMemoryConsolidation({ memory: repository, ai });
    expect(result).toMatchObject({
      skipped: true,
      summary: { mergedCount: 0 },
    });
    expect(ai.calls).toBe(0);
    expect(await repository.history()).toEqual([]);
  });

  test("applies a source-valid complete output", async () => {
    const repository = await memory();
    await repository.applyOperations(
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
    const ai = new FakeConsolidationAdapter();
    ai.value = {
      topicFiles: await repository.topicContents(),
      summary: {
        mergedCount: 0,
        deletedCount: 0,
        movedCount: 0,
        deletions: [],
      },
    };
    await expect(
      runMemoryConsolidation({ memory: repository, ai }),
    ).resolves.toMatchObject({
      skipped: false,
    });
    expect(ai.calls).toBe(1);
    expect((await repository.history()).at(-1)).toMatchObject({
      event: "memory-consolidated",
    });
  });

  test("rejects invented sources before writing a consolidation snapshot", async () => {
    const repository = await memory();
    await repository.applyOperations(
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
    const ai = new FakeConsolidationAdapter();
    const topicFiles = await repository.topicContents();
    ai.value = {
      topicFiles: {
        ...topicFiles,
        "glossar.md":
          "## Glossar\n\n- Klausur ist die wöchentliche Abstimmung. (Quelle: PROC-0999, bestätigt 2026-08-10)\n",
      },
      summary: {
        mergedCount: 0,
        deletedCount: 0,
        movedCount: 0,
        deletions: [],
      },
    };
    await expect(
      runMemoryConsolidation({ memory: repository, ai }),
    ).rejects.toThrow("unbekannte Quellen-ID");
    expect((await repository.history()).every((entry) => !entry.event)).toBe(
      true,
    );
  });
});
