import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryDistillationAdapter } from "../packages/claude/src/memory-distillation-adapter.ts";
import { MemoryConsolidationAdapter } from "../packages/claude/src/memory-consolidation-adapter.ts";
import {
  SandboxRunner,
  type SandboxTransportRequest,
} from "../packages/claude/src/sandbox-runner.ts";
import {
  memoryOperationListSchema,
  parseMemoryTopicContents,
  validateMemoryConsolidation,
  type MemoryConsolidationResult,
  type MemoryOperationList,
} from "../packages/domain/src/memory.ts";
import { understanding } from "./process-fixtures.ts";
import { loadMemoryDistillationDefaults } from "../apps/server/src/memory-distillation-defaults.ts";
import { loadMemoryConsolidationDefaults } from "../apps/server/src/memory-consolidation-defaults.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("memory Claude contract", () => {
  test("validates complete consolidation output against the previous sources", async () => {
    const beforeFiles = {
      "glossar.md":
        "## Glossar\n\n- Klausur ist die wöchentliche Abstimmung. (Quelle: PROC-0001, bestätigt 2026-08-10)\n",
      "systeme.md": "## Systeme\n\n",
      "zustaendigkeiten.md": "## Zuständigkeiten\n\n",
      "muster.md": "## Muster\n\n",
      "offene-fragen.md": "## Offene Fragen\n\n",
    };
    const result: MemoryConsolidationResult = {
      topicFiles: beforeFiles,
      summary: {
        mergedCount: 0,
        deletedCount: 0,
        movedCount: 0,
        deletions: [],
      },
    };
    expect(
      validateMemoryConsolidation(
        parseMemoryTopicContents(beforeFiles),
        result,
      ),
    ).toEqual(result);
    expect(() =>
      validateMemoryConsolidation(parseMemoryTopicContents(beforeFiles), {
        ...result,
        topicFiles: {
          ...beforeFiles,
          "glossar.md":
            "## Glossar\n\n- Klausur ist die wöchentliche Abstimmung. (Quelle: PROC-0999, bestätigt 2026-08-10)\n",
        },
      }),
    ).toThrow("unbekannte Quellen-ID");
    expect(() =>
      validateMemoryConsolidation(parseMemoryTopicContents(beforeFiles), {
        ...result,
        summary: {
          mergedCount: 0,
          deletedCount: 1,
          movedCount: 0,
          deletions: [],
        },
      }),
    ).toThrow("Löschung");
  });

  test("preserves existing source tags and rejects dropped merge sources", () => {
    const beforeFiles = {
      "glossar.md":
        "## Glossar\n\n- Begriff A ist bekannt. (Quelle: PROC-0001, bestätigt 2026-08-01)\n- Begriff B ist ebenfalls bekannt. (Quelle: PROC-0001, PROC-0002, bestätigt 2026-08-10)\n",
      "systeme.md": "## Systeme\n\n",
      "zustaendigkeiten.md": "## Zuständigkeiten\n\n",
      "muster.md": "## Muster\n\n",
      "offene-fragen.md": "## Offene Fragen\n\n",
    };
    expect(() =>
      validateMemoryConsolidation(parseMemoryTopicContents(beforeFiles), {
        topicFiles: beforeFiles,
        summary: {
          mergedCount: 0,
          deletedCount: 0,
          movedCount: 0,
          deletions: [],
        },
      }),
    ).not.toThrow();

    expect(() =>
      validateMemoryConsolidation(parseMemoryTopicContents(beforeFiles), {
        topicFiles: {
          ...beforeFiles,
          "glossar.md":
            "## Glossar\n\n- Die beiden Begriffe sind bekannt. (Quelle: PROC-0001, bestätigt 2026-08-10)\n",
        },
        summary: {
          mergedCount: 1,
          deletedCount: 0,
          movedCount: 0,
          deletions: [],
        },
      }),
    ).toThrow("Quellen");
  });

  test("uses one fresh tool-free consolidation call with topic files only", async () => {
    const sample: MemoryConsolidationResult = {
      topicFiles: {
        "glossar.md": "## Glossar\n\n",
        "systeme.md": "## Systeme\n\n",
        "zustaendigkeiten.md": "## Zuständigkeiten\n\n",
        "muster.md": "## Muster\n\n",
        "offene-fragen.md": "## Offene Fragen\n\n",
      },
      summary: {
        mergedCount: 0,
        deletedCount: 0,
        movedCount: 0,
        deletions: [],
      },
    };
    const root = await mkdtemp(join(tmpdir(), "memory-consolidation-ai-"));
    roots.push(root);
    let captured: SandboxTransportRequest | undefined;
    const runner = new SandboxRunner({
      tempRoot: root,
      sandboxCommand: "missing",
      allowUnsafeLocalFallback: true,
      transport: async (request) => {
        captured = request;
        return {
          stdout: JSON.stringify({ structured_output: sample, usage: {} }),
          stderr: "",
          exitCode: 0,
          sandboxed: false,
        };
      },
    });
    const defaults = await loadMemoryConsolidationDefaults();
    expect(
      await new MemoryConsolidationAdapter(runner).run({
        topicFiles: sample.topicFiles,
        contracts: defaults.contracts,
        model: defaults.model,
      }),
    ).toMatchObject({ value: sample });
    expect(captured?.command).toContain("--no-session-persistence");
    expect(
      captured?.command.slice(captured.command.indexOf("--tools") + 1)[0],
    ).toBe("");
    expect(captured?.stdin).toContain("Aktuelle Themen-Dateien");
    expect(captured?.stdin).not.toContain("confirmedUnderstanding");
  });

  test("accepts the strict sample response and sends only bounded tool-free input", async () => {
    const sample: MemoryOperationList = {
      operations: [
        {
          action: "add",
          topic: "glossar.md",
          fact: "Klausur ist die wöchentliche Abstimmung.",
        },
      ],
    };
    expect(memoryOperationListSchema.parse(sample)).toEqual(sample);
    expect(() =>
      memoryOperationListSchema.parse({
        operations: [{ action: "remove", topic: "glossar.md" }],
      }),
    ).toThrow();
    const root = await mkdtemp(join(tmpdir(), "memory-ai-"));
    roots.push(root);
    const defaults = await loadMemoryDistillationDefaults();
    let captured: SandboxTransportRequest | undefined;
    const runner = new SandboxRunner({
      tempRoot: root,
      sandboxCommand: "missing",
      allowUnsafeLocalFallback: true,
      transport: async (request) => {
        captured = request;
        return {
          stdout: JSON.stringify({ structured_output: sample, usage: {} }),
          stderr: "",
          exitCode: 0,
          sandboxed: false,
        };
      },
    });
    const result = await new MemoryDistillationAdapter(runner).run({
      processId: "PROC-0001",
      transcript: [],
      understanding: understanding(),
      topicFiles: {
        "glossar.md": "## Glossar\n\n",
        "systeme.md": "## Systeme\n\n",
        "zustaendigkeiten.md": "## Zuständigkeiten\n\n",
        "muster.md": "## Muster\n\n",
        "offene-fragen.md": "## Offene Fragen\n\n",
      },
      contracts: defaults,
      model: {
        model: "claude-opus-4-8",
        effort: "medium",
        timeoutMs: 10_000,
        maxOutputTokens: 512,
        maxInputCharacters: 200_000,
        maxBudgetUsd: 1,
      },
    });
    expect(result.value).toEqual(sample);
    expect(captured?.command).toContain("--no-session-persistence");
    expect(
      captured?.command.slice(captured.command.indexOf("--tools") + 1)[0],
    ).toBe("");
    expect(captured?.stdin).toContain("confirmedUnderstanding");
    expect(captured?.stdin).toContain("topicFiles");
    expect(captured?.stdin).not.toContain("participantEmail");
    expect(Object.isFrozen(defaults.responseSchema)).toBe(true);
  });
});
