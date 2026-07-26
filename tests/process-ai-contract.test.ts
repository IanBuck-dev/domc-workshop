import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import {
  SandboxRunner,
  type SandboxTransportRequest,
} from "../packages/claude/src/sandbox-runner.ts";
import { ProcessFollowUpAdapter } from "../packages/claude/src/process-follow-up-adapter.ts";
import { ProcessSynthesisAdapter } from "../packages/claude/src/process-synthesis-adapter.ts";
import { processFollowUpResultSchema } from "../packages/claude/src/process-response-schemas.ts";
import {
  answers,
  cover,
  processConfig,
  understanding,
  workCharacteristicAnswers,
} from "./process-fixtures.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function root() {
  const value = await mkdtemp(join(tmpdir(), "process-ai-"));
  roots.push(value);
  return value;
}
function envelope(value: unknown) {
  return JSON.stringify({
    structured_output: value,
    usage: { input_tokens: 3, output_tokens: 7 },
  });
}

describe("process AI contract", () => {
  test("uses medium effort, no persistence, and no tools without uploads", async () => {
    const temporary = await root();
    let captured: SandboxTransportRequest | undefined;
    const runner = new SandboxRunner({
      tempRoot: temporary,
      sandboxCommand: "missing-sandbox-command",
      allowUnsafeLocalFallback: true,
      transport: async (request) => {
        captured = request;
        return {
          stdout: envelope({ followUps: [] }),
          stderr: "",
          exitCode: 0,
          sandboxed: false,
        };
      },
    });
    const config = await processConfig();
    const result = await new ProcessFollowUpAdapter(runner).run({
      processId: "PROC-0001",
      configHash: "a".repeat(64),
      model: {
        model: "sonnet",
        effort: "medium",
        timeoutMs: 90_000,
        maxOutputTokens: 6_000,
        maxInputCharacters: 200_000,
        maxBudgetUsd: 1,
      },
      instructions: config.instructions.followUps,
      selectedUploads: [],
      cover,
      topics: config.topics,
      mainAnswers: answers(),
      workCharacteristicDefinitions: config.workCharacteristics,
      workCharacteristicAnswers: workCharacteristicAnswers(),
    });
    expect(result.value.followUps).toEqual([]);
    expect(captured?.command).toContain("--no-session-persistence");
    expect(
      captured?.command.slice(captured.command.indexOf("--effort") + 1)[0],
    ).toBe("medium");
    expect(
      captured?.command.slice(captured.command.indexOf("--model") + 1)[0],
    ).toBe("sonnet");
    expect(
      captured?.command.slice(captured.command.indexOf("--tools") + 1)[0],
    ).toBe("");
    expect(
      captured?.command.slice(
        captured.command.indexOf("--disallowed-tools") + 1,
      )[0],
    ).toContain("WebSearch");
    const systemPrompt = captured?.command.slice(
      captured.command.indexOf("--system-prompt") + 1,
    )[0];
    expect(systemPrompt).toContain("# Prozessverständnis-Rückfragen v1");
    expect(systemPrompt).toContain(
      "# Globale Rolle – Geschäftsprozessaufnahme v1",
    );
    expect(systemPrompt?.indexOf("# Globale Rolle")).toBeLessThan(
      systemPrompt?.indexOf("# Prozessverständnis-Rückfragen") ?? -1,
    );
    expect(systemPrompt).toContain(
      `## Konfigurierbare Anweisung\n${config.instructions.followUps}`,
    );
    expect(captured?.stdin).toContain("combined-information-sources");
    expect(captured?.stdin).toContain(
      "Freitexte, beispielsweise E-Mails, Briefe oder Notizen",
    );
    expect(systemPrompt).toContain("Nicht sicher");
    expect(systemPrompt).toContain("nicht als KI-Eignung");
  });

  test("rejects duplicate topic followups", async () => {
    const temporary = await root();
    const runner = new SandboxRunner({
      tempRoot: temporary,
      sandboxCommand: "missing",
      allowUnsafeLocalFallback: true,
      transport: async () => ({
        stdout: envelope({
          followUps: [
            {
              id: "a",
              topicId: "purpose-scope",
              question: "Frage eins?",
              rationale: "Lücke",
            },
            {
              id: "b",
              topicId: "purpose-scope",
              question: "Frage zwei?",
              rationale: "Lücke",
            },
          ],
        }),
        stderr: "",
        exitCode: 0,
        sandboxed: false,
      }),
    });
    const config = await processConfig();
    await expect(
      new ProcessFollowUpAdapter(runner).run({
        processId: "PROC-0001",
        configHash: "a".repeat(64),
        model: {
          model: "sonnet",
          effort: "medium",
          timeoutMs: 90_000,
          maxOutputTokens: 6_000,
          maxInputCharacters: 200_000,
          maxBudgetUsd: 1,
        },
        instructions: config.instructions.followUps,
        selectedUploads: [],
        cover,
        topics: config.topics,
        mainAnswers: answers(),
        workCharacteristicDefinitions: config.workCharacteristics,
        workCharacteristicAnswers: workCharacteristicAnswers(),
      }),
    ).rejects.toThrow("Only one follow-up per topic");
    expect(() =>
      processFollowUpResultSchema.parse({
        followUps: [
          {
            id: "duplicate",
            topicId: "purpose-scope",
            question: "Was ist das Ergebnis?",
            rationale: "Ergebnis präzisieren.",
          },
          {
            id: "duplicate",
            topicId: "flow-roles",
            question: "Wer übernimmt den nächsten Schritt?",
            rationale: "Übergabe präzisieren.",
          },
        ],
      }),
    ).toThrow("Follow-up IDs must be unique");
  });

  test("stages only selected uploads for synthesis workspace tools", async () => {
    const temporary = await root();
    const uploadRoot = join(temporary, "source");
    await mkdir(uploadRoot, { recursive: true });
    const source = join(uploadRoot, "process.txt");
    const bytes = new TextEncoder().encode("Fiktive Prozessbeschreibung");
    await writeFile(source, bytes);
    let captured: SandboxTransportRequest | undefined;
    const runner = new SandboxRunner({
      tempRoot: join(temporary, "ops"),
      uploadRoot,
      sandboxCommand: "sh",
      transport: async (request) => {
        captured = request;
        return {
          stdout: JSON.stringify({
            result: JSON.stringify({
              ...understanding(),
              documentCoverage: [
                {
                  uploadId: "00000000-0000-4000-8000-000000000001",
                  name: "process.txt",
                  status: "complete",
                  processedCharacters: 27,
                  limitation: null,
                },
              ],
              evidence: [
                ...understanding().evidence,
                {
                  id: "file-1",
                  kind: "upload",
                  sourceId: "00000000-0000-4000-8000-000000000001",
                  excerpt: "Fiktive Prozessbeschreibung",
                },
              ],
            }),
            usage: { input_tokens: 3, output_tokens: 7 },
          }),
          stderr: "",
          exitCode: 0,
          sandboxed: true,
        };
      },
    });
    const config = await processConfig();
    const result = await new ProcessSynthesisAdapter(runner).run({
      processId: "PROC-0001",
      configHash: "a".repeat(64),
      model: {
        model: "sonnet",
        effort: "medium",
        timeoutMs: 90_000,
        maxOutputTokens: 6_000,
        maxInputCharacters: 200_000,
        maxBudgetUsd: 1,
      },
      instructions: config.instructions.synthesis,
      selectedUploads: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          name: "process.txt",
          path: source,
          size: bytes.byteLength,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      ],
      cover,
      topics: config.topics,
      mainAnswers: answers(),
      workCharacteristicDefinitions: config.workCharacteristics,
      workCharacteristicAnswers: workCharacteristicAnswers(),
      followUps: [],
      followUpAnswers: [],
    });
    expect(result.value.steps).toHaveLength(5);
    expect(
      captured?.command.slice(captured.command.indexOf("--tools") + 1)[0],
    ).toBe("Read,Glob,Bash");
    expect(captured?.stdin).toContain(
      "uploads/00000000-0000-4000-8000-000000000001-process.txt",
    );
    expect(captured?.command).not.toContain("--json-schema");
    expect(captured?.stdin).toContain("Verbindliches Ausgabeschema");
  });

  test("rejects foreign, changed, and unsandboxed selected files before Claude runs", async () => {
    const temporary = await root();
    const uploadRoot = join(temporary, "allowed");
    const outsideRoot = join(temporary, "outside");
    await Promise.all([
      mkdir(uploadRoot, { recursive: true }),
      mkdir(outsideRoot, { recursive: true }),
    ]);
    const outside = join(outsideRoot, "outside.txt");
    await writeFile(outside, "Fremde Datei");
    let transportCalls = 0;
    const config = await processConfig();
    const request = {
      processId: "PROC-0001",
      configHash: "a".repeat(64),
      model: {
        model: "sonnet" as const,
        effort: "medium" as const,
        timeoutMs: 90_000,
        maxOutputTokens: 6_000,
        maxInputCharacters: 200_000,
        maxBudgetUsd: 1,
      },
      instructions: config.instructions.synthesis,
      cover,
      topics: config.topics,
      mainAnswers: answers(),
      workCharacteristicDefinitions: config.workCharacteristics,
      workCharacteristicAnswers: workCharacteristicAnswers(),
      followUps: [],
      followUpAnswers: [],
    };
    const runner = new SandboxRunner({
      tempRoot: join(temporary, "ops"),
      uploadRoot,
      sandboxCommand: "missing-sandbox-command",
      allowUnsafeLocalFallback: true,
      transport: async () => {
        transportCalls++;
        throw new Error("transport must not run");
      },
    });
    const outsideBytes = new TextEncoder().encode("Fremde Datei");
    await expect(
      new ProcessSynthesisAdapter(runner).run({
        ...request,
        selectedUploads: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            name: "outside.txt",
            path: outside,
            size: outsideBytes.byteLength,
            sha256: createHash("sha256").update(outsideBytes).digest("hex"),
          },
        ],
      }),
    ).rejects.toThrow("outside the configured process workspace");

    const changed = join(uploadRoot, "changed.txt");
    await writeFile(changed, "Aktueller Inhalt");
    await expect(
      new ProcessSynthesisAdapter(runner).run({
        ...request,
        selectedUploads: [
          {
            id: "00000000-0000-4000-8000-000000000002",
            name: "changed.txt",
            path: changed,
            size: 5,
            sha256: "0".repeat(64),
          },
        ],
      }),
    ).rejects.toThrow("changed after validation");

    const validBytes = new TextEncoder().encode("Aktueller Inhalt");
    await expect(
      new ProcessSynthesisAdapter(runner).run({
        ...request,
        selectedUploads: [
          {
            id: "00000000-0000-4000-8000-000000000003",
            name: "changed.txt",
            path: changed,
            size: validBytes.byteLength,
            sha256: createHash("sha256").update(validBytes).digest("hex"),
          },
        ],
      }),
    ).rejects.toThrow("Sandbox Runtime");
    expect(transportCalls).toBe(0);
  });

  test("rejects malformed structured output", async () => {
    const temporary = await root();
    const runner = new SandboxRunner({
      tempRoot: temporary,
      sandboxCommand: "missing-sandbox-command",
      allowUnsafeLocalFallback: true,
      transport: async () => ({
        stdout: "not-json",
        stderr: "",
        exitCode: 0,
        sandboxed: false,
      }),
    });
    const config = await processConfig();
    await expect(
      new ProcessFollowUpAdapter(runner).run({
        processId: "PROC-0001",
        configHash: "a".repeat(64),
        model: {
          model: "sonnet",
          effort: "medium",
          timeoutMs: 90_000,
          maxOutputTokens: 6_000,
          maxInputCharacters: 200_000,
          maxBudgetUsd: 1,
        },
        instructions: config.instructions.followUps,
        selectedUploads: [],
        cover,
        topics: config.topics,
        mainAnswers: answers(),
        workCharacteristicDefinitions: config.workCharacteristics,
        workCharacteristicAnswers: workCharacteristicAnswers(),
      }),
    ).rejects.toThrow();
  });
});
