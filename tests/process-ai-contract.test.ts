import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import {
  runSandboxTransport,
  SandboxRunner,
  type SandboxTransportRequest,
} from "../packages/claude/src/sandbox-runner.ts";
import { ProcessFollowUpAdapter } from "../packages/claude/src/process-follow-up-adapter.ts";
import { ProcessSynthesisAdapter } from "../packages/claude/src/process-synthesis-adapter.ts";
import {
  processFollowUpResultSchema,
  processSynthesisResultSchema,
} from "../packages/claude/src/process-response-schemas.ts";
import {
  answers,
  cover,
  legacyUnderstanding,
  processConfig,
  synthesisUnderstanding,
  understanding,
  validationInputSnapshot,
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
  test("terminates the complete sandbox process group at the timeout", async () => {
    if (process.platform === "win32") return;
    const temporary = await root();
    const childPidPath = join(temporary, "child.pid");
    const startedAt = performance.now();
    const result = await runSandboxTransport({
      command: [
        "sh",
        "-c",
        'sleep 30 & child=$!; printf "%s" "$child" > "$1"; wait "$child"',
        "sh",
        childPidPath,
      ],
      cwd: temporary,
      env: { PATH: process.env.PATH },
      stdin: "",
      timeoutMs: 100,
      maxOutputBytes: 1_000,
    });
    expect(result.exitCode).not.toBe(0);
    expect(performance.now() - startedAt).toBeLessThan(3_000);
    const childPid = (await Bun.file(childPidPath).text()).trim();
    const childCheck = Bun.spawn([
      "sh",
      "-c",
      'kill -0 "$1" 2>/dev/null',
      "sh",
      childPid,
    ]);
    expect(await childCheck.exited).not.toBe(0);
  });

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
          stdout: envelope({ previousQuestionReviews: [], followUps: [] }),
          stderr: "",
          exitCode: 0,
          sandboxed: false,
        };
      },
    });
    const config = await processConfig();
    expect(config.ai).toMatchObject({
      model: "gpt-5.6-sol",
      reasoningEffort: "medium",
    });
    const result = await new ProcessFollowUpAdapter(runner).run({
      processId: "PROC-0001",
      configHash: "a".repeat(64),
      model: {
        model: "claude-opus-4-8",
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
      validationHistory: [],
    });
    expect(result.value.followUps).toEqual([]);
    expect(captured?.command).toContain("--no-session-persistence");
    expect(
      captured?.command.slice(captured.command.indexOf("--effort") + 1)[0],
    ).toBe("medium");
    expect(
      captured?.command.slice(captured.command.indexOf("--model") + 1)[0],
    ).toBe("claude-opus-4-8");
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
    expect(systemPrompt).toContain("# Iterative Prozessvalidierung v2");
    expect(systemPrompt).toContain(
      "# Globale Rolle – Geschäftsprozessaufnahme v1",
    );
    expect(systemPrompt?.indexOf("# Globale Rolle")).toBeLessThan(
      systemPrompt?.indexOf("# Iterative Prozessvalidierung") ?? -1,
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
    expect(systemPrompt).toContain("DOCX, XLSX und PPTX");
    expect(systemPrompt).toContain("Fehlende Bilder, Platzhalter");
  });

  test("allows the explicit local presentation mode without a sandbox", async () => {
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
      sandboxMode: "off",
      transport: async (request) => {
        captured = request;
        return {
          stdout: envelope({ previousQuestionReviews: [], followUps: [] }),
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
        model: "claude-opus-4-8",
        effort: "medium",
        timeoutMs: 90_000,
        maxOutputTokens: 6_000,
        maxInputCharacters: 200_000,
        maxBudgetUsd: 1,
      },
      instructions: config.instructions.followUps,
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
      validationHistory: [],
    });
    expect(result.trace.sandboxed).toBe(false);
    expect(captured?.command).not.toContain("--settings");
    expect(captured?.command).toContain("--no-session-persistence");
    expect(captured?.command).not.toContain("--resume");
    expect(
      captured?.command.slice(captured.command.indexOf("--tools") + 1)[0],
    ).toBe("Read,Glob,Bash");
    expect(captured?.stdin).toContain(
      "uploads/00000000-0000-4000-8000-000000000001-process.txt",
    );
  });

  test("rejects duplicate topic followups", async () => {
    const temporary = await root();
    const runner = new SandboxRunner({
      tempRoot: temporary,
      sandboxCommand: "missing",
      allowUnsafeLocalFallback: true,
      transport: async () => ({
        stdout: envelope({
          previousQuestionReviews: [],
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
          model: "claude-opus-4-8",
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
        validationHistory: [],
      }),
    ).rejects.toThrow("Only one follow-up per topic");
    expect(() =>
      processFollowUpResultSchema.parse({
        previousQuestionReviews: [],
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

  test("sends only the immediately preceding input plus earlier question texts", async () => {
    const temporary = await root();
    let captured: SandboxTransportRequest | undefined;
    const runner = new SandboxRunner({
      tempRoot: temporary,
      sandboxCommand: "missing",
      allowUnsafeLocalFallback: true,
      transport: async (request) => {
        captured = request;
        return {
          stdout: envelope({
            previousQuestionReviews: [
              {
                questionId: "question-previous",
                topicId: "flow-roles",
                outcome: "addressed",
                rationale: "Die Rollen sind jetzt eindeutig beschrieben.",
              },
            ],
            followUps: [],
          }),
          stderr: "",
          exitCode: 0,
          sandboxed: false,
        };
      },
    });
    const config = await processConfig();
    const oldSnapshot = validationInputSnapshot();
    oldSnapshot.mainAnswers[0]!.text = "OLDER_FULL_INPUT_MUST_NOT_BE_SENT";
    const previousSnapshot = validationInputSnapshot();
    previousSnapshot.mainAnswers[0]!.text = "IMMEDIATE_PREVIOUS_INPUT";
    const currentAnswers = answers();
    currentAnswers[0]!.text = "CURRENT_INPUT";
    await new ProcessFollowUpAdapter(runner).run({
      processId: "PROC-0001",
      configHash: "a".repeat(64),
      model: {
        model: "claude-opus-4-8",
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
      mainAnswers: currentAnswers,
      workCharacteristicDefinitions: config.workCharacteristics,
      workCharacteristicAnswers: workCharacteristicAnswers(),
      validationHistory: [
        {
          runNumber: 1,
          completedAt: new Date().toISOString(),
          inputSnapshot: oldSnapshot,
          questions: [
            {
              id: "question-old",
              topicId: "purpose-scope",
              question: "Welches Ergebnis entsteht?",
              rationale: "Das Ergebnis fehlt.",
            },
          ],
          previousQuestionReviews: [],
          trace: null,
        },
        {
          runNumber: 2,
          completedAt: new Date().toISOString(),
          inputSnapshot: previousSnapshot,
          questions: [
            {
              id: "question-previous",
              topicId: "flow-roles",
              question: "Wer übernimmt die Übergabe?",
              rationale: "Die Rolle fehlt.",
            },
          ],
          previousQuestionReviews: [
            {
              questionId: "question-old",
              topicId: "purpose-scope",
              outcome: "addressed",
              rationale: "Das Ergebnis ist ergänzt.",
            },
          ],
          trace: null,
        },
      ],
    });
    expect(captured?.stdin).toContain("CURRENT_INPUT");
    expect(captured?.stdin).toContain("IMMEDIATE_PREVIOUS_INPUT");
    expect(captured?.stdin).toContain("Welches Ergebnis entsteht?");
    expect(captured?.stdin).not.toContain("OLDER_FULL_INPUT_MUST_NOT_BE_SENT");
  });

  test("stages only selected uploads for synthesis workspace tools", async () => {
    const temporary = await root();
    const uploadRoot = join(temporary, "source");
    await mkdir(uploadRoot, { recursive: true });
    const source = join(uploadRoot, "process.txt");
    const bytes = new TextEncoder().encode("Fiktive Prozessbeschreibung");
    await writeFile(source, bytes);
    let captured: SandboxTransportRequest | undefined;
    let sandboxSettings:
      | {
          filesystem?: { allowRead?: string[]; denyRead?: string[] };
        }
      | undefined;
    const runner = new SandboxRunner({
      tempRoot: join(temporary, "ops"),
      uploadRoot,
      sandboxCommand: "sh",
      transport: async (request) => {
        captured = request;
        const settingsIndex = request.command.indexOf("--settings") + 1;
        sandboxSettings = JSON.parse(
          await readFile(request.command[settingsIndex]!, "utf8"),
        );
        return {
          stdout: JSON.stringify({
            result: `Die Auswertung ist abgeschlossen.\n\n${JSON.stringify({
              ...synthesisUnderstanding(),
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
            })}`,
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
        model: "claude-opus-4-8",
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
      validationHistory: [],
      followUps: [],
      followUpAnswers: [],
    });
    expect(result.value.steps).toHaveLength(5);
    expect(result.value.schemaVersion).toBe(3);
    expect(result.value.steps[0]?.informationItems[0]?.id).toBe(
      "info-step-1-1",
    );
    expect(result.value.flow.nodes).toContainEqual({
      id: "step-1",
      kind: "step",
      stepId: "step-1",
    });
    expect(
      captured?.command.slice(captured.command.indexOf("--tools") + 1)[0],
    ).toBe("Read,Glob,Bash");
    expect(captured?.stdin).toContain(
      "uploads/00000000-0000-4000-8000-000000000001-process.txt",
    );
    expect(captured?.command).not.toContain("--json-schema");
    expect(captured?.stdin).toContain("Verbindliches Ausgabeschema");
    expect(captured?.command.join(" ")).toContain(
      "gebündelten lokalen Arbeitsschritt",
    );
    expect(captured?.command.join(" ")).toContain("python3");
    const claudeCommand = Bun.which("claude");
    expect(claudeCommand).toBeTruthy();
    expect(sandboxSettings?.filesystem?.allowRead).toContain(claudeCommand!);
    expect(sandboxSettings?.filesystem?.allowRead).toContain(
      await realpath(claudeCommand!),
    );
    if (process.platform === "darwin") {
      expect(sandboxSettings?.filesystem?.denyRead).not.toContain(
        process.env.HOME,
      );
      expect(sandboxSettings?.filesystem?.allowRead).toContain(
        join(process.env.HOME!, "Library", "Keychains"),
      );
    }
  });

  test("requires the v3 synthesis fields and keeps nested IDs server-owned", async () => {
    const schema = JSON.parse(
      await readFile(
        join(
          import.meta.dir,
          "..",
          "defaults",
          "ai-schemas",
          "process-understanding.json",
        ),
        "utf8",
      ),
    );
    expect(schema.$id).toBe("claims-ai/process-understanding/v3");
    expect(schema.required).toContain("schemaVersion");
    expect(schema.$defs.step.required).toEqual(
      expect.arrayContaining([
        "inputs",
        "outputs",
        "informationItems",
        "miscellaneous",
      ]),
    );
    expect(schema.required).toContain("flow");
    expect(schema.$defs.informationItem.required).toContain("typeDetail");
    expect(
      processSynthesisResultSchema.safeParse(synthesisUnderstanding()).success,
    ).toBe(true);
    expect(
      processSynthesisResultSchema.safeParse(understanding()).success,
    ).toBe(false);
    expect(
      processSynthesisResultSchema.safeParse(legacyUnderstanding()).success,
    ).toBe(false);
    const missingTypeDetail = synthesisUnderstanding();
    delete (
      missingTypeDetail.steps[0]!.informationItems[0] as unknown as Record<
        string,
        unknown
      >
    ).typeDetail;
    expect(
      processSynthesisResultSchema.safeParse(missingTypeDetail).success,
    ).toBe(false);
    const invalidStandardDetail = synthesisUnderstanding();
    invalidStandardDetail.steps[0]!.informationItems[0]!.typeDetail =
      "CRM-Eigenschaft";
    expect(
      processSynthesisResultSchema.safeParse(invalidStandardDetail).success,
    ).toBe(false);
    const customDetail = synthesisUnderstanding();
    customDetail.steps[0]!.informationItems[0]!.type = "other";
    customDetail.steps[0]!.informationItems[0]!.typeDetail =
      "Fachliche Prüfliste";
    expect(processSynthesisResultSchema.safeParse(customDetail).success).toBe(
      true,
    );
    const forgedCorrection = synthesisUnderstanding();
    (
      forgedCorrection.evidence as Array<{
        id: string;
        kind: string;
        sourceId: string;
        excerpt: string;
      }>
    ).push({
      id: "forged-correction",
      kind: "human_correction",
      sourceId: "forged-correction",
      excerpt: "Darf nicht aus der KI stammen.",
    });
    expect(
      processSynthesisResultSchema.safeParse(forgedCorrection).success,
    ).toBe(false);

    const prompt = await readFile(
      join(
        import.meta.dir,
        "..",
        "defaults",
        "prompts",
        "process-synthesis.md",
      ),
      "utf8",
    );
    expect(prompt).toContain("# Prozessverständnis-Synthese v2");
    expect(prompt).toContain("`source` bezeichnet");
    expect(prompt).toContain("`type` ausschließlich einen Enumwert");
    expect(prompt).toContain("`typeDetail` bei allen Standardarten auf `null`");
    expect(prompt).toContain('`mode: "rule_based"`');
    expect(prompt).toContain("Erfinde keinen plausiblen Entscheidungsbaum");
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
        model: "claude-opus-4-8" as const,
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
      validationHistory: [],
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
          model: "claude-opus-4-8",
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
        validationHistory: [],
      }),
    ).rejects.toThrow();
  });
});
