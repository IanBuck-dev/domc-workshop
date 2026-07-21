import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import {
  assessmentConfigSchema,
  emptyCriterionValues,
  gatewayAssessmentSchema,
  gatewayEvaluationQuestion,
  gatewayHelpText,
  gatewayUserQuestion,
} from "../packages/domain/src/assessment.ts";
import { calculateAssessmentResults } from "../packages/domain/src/scoring.ts";
import { GatewayClaudeAdapter } from "../packages/claude/src/gateway-adapter.ts";
import { ReviewClaudeAdapter } from "../packages/claude/src/review-adapter.ts";
import {
  gatewayResultJsonSchema,
  gatewayResultSchema,
  reviewResultSchema,
} from "../packages/claude/src/response-schemas.ts";
import { assertReviewResult } from "../packages/claude/src/assessment-ai-utils.ts";
import {
  cancelAiOperation,
  listAiOperations,
  SandboxRunner,
  type SandboxTransportRequest,
} from "../packages/claude/src/sandbox-runner.ts";

const created: string[] = [];

afterEach(async () => {
  delete process.env.APP_SESSION_SECRET;
  delete process.env.APP_AUTH_PASSWORD_HASH;
  await Promise.all(
    created.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

const model = {
  model: "sonnet",
  effort: "low" as const,
  timeoutMs: 10_000,
  maxOutputTokens: 1_000,
  maxInputCharacters: 20_000,
  maxBudgetUsd: 1,
};

const gatewayValue = {
  decisions: ["q1", "q2", "q3", "q4"].map((questionId) => ({
    questionId,
    decision: "no" as const,
    confidence: 90,
    rationale: "Keine belastbare Evidenz.",
    evidence: [],
    assumptions: [],
  })),
  followUpQuestion: null,
};

function operation() {
  return {
    assessmentId: "ASSESS-0001",
    operationName: "gateway-evaluate",
    prompt: "Test",
    systemPrompt: "Test",
    responseSchema: gatewayResultSchema,
    responseJsonSchema: gatewayResultJsonSchema,
    model,
    tools: "none" as const,
  };
}

describe("assessment AI contracts", () => {
  test("keeps the deployed sandbox policy scoped to the disposable workspace", async () => {
    const settings = (await Bun.file(
      "deploy/pi/sandbox-settings.json",
    ).json()) as {
      network: {
        allowLocalBinding: boolean;
        allowUnixSockets: string[];
        allowedDomains: string[];
      };
      filesystem: {
        denyRead: string[];
        allowRead: string[];
        allowWrite: string[];
      };
      enableWeakerNestedSandbox: boolean;
      enableWeakerNetworkIsolation: boolean;
    };
    expect(settings.filesystem.denyRead).toEqual(
      expect.arrayContaining([
        "/home",
        "/root",
        "/etc/claims-ai-portfolio.env",
        "/opt/claims-ai-portfolio",
        "/var/lib/claims-ai/workspace",
      ]),
    );
    expect(settings.filesystem.allowRead).toEqual([
      ".",
      "/var/lib/claims-ai/.claude",
      "/opt/claims-ai-portfolio/current/node_modules/@anthropic-ai/sandbox-runtime",
    ]);
    expect(settings.filesystem.allowWrite).toEqual([".", "/tmp/claude"]);
    expect(settings.network.allowLocalBinding).toBe(false);
    expect(settings.network.allowUnixSockets).toEqual([]);
    expect(settings.network.allowedDomains).toEqual(
      expect.arrayContaining(["api.anthropic.com", "claude.ai"]),
    );
    expect(settings.enableWeakerNestedSandbox).toBe(false);
    expect(settings.enableWeakerNetworkIsolation).toBe(false);
  });

  test("drops invented criterion references from otherwise valid review findings", async () => {
    const config = assessmentConfigSchema.parse(
      await Bun.file("defaults/assessment-config.json").json(),
    );
    const result = assertReviewResult(
      {
        value: {
          summary: "Prüfung abgeschlossen.",
          findings: [
            {
              id: "finding-1",
              severity: "warning",
              criterionIds: ["annual-savings", "invented"],
              evidence: ["Beleg"],
              explanation: "Hinweis",
              proposedCorrection: null,
            },
          ],
        },
        trace: {
          operationId: "operation-1",
          model: "sonnet",
          sessionId: "session-1",
          durationMs: 1,
          inputTokens: 1,
          outputTokens: 1,
          sandboxed: true,
        },
      },
      config.criteria,
    );
    expect(result.value.findings[0]?.criterionIds).toEqual(["annual-savings"]);
  });

  test("validates the complete default configuration", async () => {
    const raw = await Bun.file("defaults/assessment-config.json").json();
    const config = assessmentConfigSchema.parse(raw);
    expect(config.gateway.questions).toHaveLength(4);
    expect(config.criteria).toHaveLength(28);
    expect(config.chat.sections).toHaveLength(5);
  });

  test("loads the versioned adaptive gateway prompt and validates all four question IDs", async () => {
    const config = assessmentConfigSchema.parse(
      await Bun.file("defaults/assessment-config.json").json(),
    );
    const root = await mkdtemp(join(tmpdir(), "gateway-prepare-"));
    created.push(root);
    let captured: SandboxTransportRequest | undefined;
    const runner = new SandboxRunner({
      tempRoot: root,
      sandboxCommand: "sh",
      transport: async (request) => {
        captured = request;
        return {
          stdout: JSON.stringify({
            structured_output: {
              assistantMessage: "Alltagssprache genügt.",
              questions: config.gateway.questions.map((question) => ({
                questionId: question.id,
                question: `Zum Prozess: ${gatewayUserQuestion(question)}`,
                recognitionAids: ["Beispiel als Hypothese"],
              })),
            },
          }),
          stderr: "",
          exitCode: 0,
          sandboxed: true,
        };
      },
    });
    const adapter = new GatewayClaudeAdapter(runner);
    const result = await adapter.prepare({
      assessmentId: "ASSESS-0001",
      configHash: "a".repeat(64),
      model,
      instructions: "Nutze nur bestätigte Angaben.",
      cover: {
        department: "Schaden",
        participantName: "Test",
        participantEmail: "test@example.invalid",
        processName: "App-Schadenmeldung",
        currentProcessDescription: "Die Meldung landet im CRM.",
      },
      questions: config.gateway.questions.map((question) => ({
        id: question.id,
        name: question.name,
        evaluationQuestion: gatewayEvaluationQuestion(question),
        userQuestion: gatewayUserQuestion(question),
        helpText: gatewayHelpText(question),
        displayOrder: question.displayOrder,
      })),
    });
    expect(result.value.questions).toHaveLength(4);
    expect(captured?.command.join(" ")).toContain("Adaptive Gateway-Erhebung");
    expect(captured?.stdin).toContain("App-Schadenmeldung");
  });

  test("passes the immutable scoring configuration into the clean reviewer context", async () => {
    const config = assessmentConfigSchema.parse(
      await Bun.file("defaults/assessment-config.json").json(),
    );
    const criteria = emptyCriterionValues(config).map((item) => {
      const definition = config.criteria.find(
        (criterion) => criterion.id === item.criterionId,
      )!;
      return {
        ...item,
        value:
          definition.inputType === "boolean"
            ? false
            : definition.inputType === "currency"
              ? 1_000
              : 1,
        source: "human" as const,
        confirmation: "confirmed" as const,
        updatedBy: "human" as const,
        updatedAt: new Date().toISOString(),
      };
    });
    const root = await mkdtemp(join(tmpdir(), "review-context-"));
    created.push(root);
    let captured: SandboxTransportRequest | undefined;
    const adapter = new ReviewClaudeAdapter(
      new SandboxRunner({
        tempRoot: root,
        sandboxCommand: "sh",
        transport: async (request) => {
          captured = request;
          return {
            stdout: JSON.stringify({
              structured_output: {
                summary: "Prüfung abgeschlossen.",
                findings: [],
              },
            }),
            stderr: "",
            exitCode: 0,
            sandboxed: true,
          };
        },
      }),
    );
    await adapter.review({
      assessmentId: "ASSESS-0001",
      configHash: "a".repeat(64),
      model: { ...model, maxInputCharacters: 200_000 },
      instructions: "Prüfe die Bewertung.",
      cover: {
        department: "Schaden",
        participantName: "Test",
        participantEmail: "test@example.invalid",
        processName: "Fiktiver Prozess",
        currentProcessDescription: null,
      },
      configSnapshot: config,
      gateway: gatewayAssessmentSchema.parse({
        final: true,
        hasClearAiSignal: true,
      }),
      criterionDefinitions: config.criteria,
      criteria,
      calculatedResults: calculateAssessmentResults(config, criteria),
      conversationEvidence: [],
      plausibilityWarningEuro: config.scoring.plausibilityWarningAmount,
    });
    expect(captured?.stdin).toContain('"profitabilityWeight": 0.7');
    expect(captured?.stdin).toContain('"strategicWeight": 0.3');
    expect(captured?.command).toContain("--no-session-persistence");
  });

  test("rejects duplicate gateway decisions", () => {
    expect(() =>
      gatewayResultSchema.parse({
        ...gatewayValue,
        decisions: gatewayValue.decisions.map((decision) => ({
          ...decision,
          questionId: "same",
        })),
      }),
    ).toThrow();
  });

  test("bounds the independent review finding count", () => {
    const finding = {
      id: "finding",
      severity: "info" as const,
      criterionIds: [],
      evidence: ["Kurzer Beleg"],
      explanation: "Kurzer Hinweis",
      proposedCorrection: null,
    };
    expect(() =>
      reviewResultSchema.parse({
        summary: "Prüfung",
        findings: Array.from({ length: 21 }, (_, index) => ({
          ...finding,
          id: `finding-${index}`,
        })),
      }),
    ).toThrow();
  });

  test("never passes application secrets to the Claude child", async () => {
    process.env.APP_SESSION_SECRET = "must-not-leak";
    process.env.APP_AUTH_PASSWORD_HASH = "must-not-leak-either";
    const root = await mkdtemp(join(tmpdir(), "ai-contract-"));
    created.push(root);
    let captured: SandboxTransportRequest | undefined;
    const runner = new SandboxRunner({
      tempRoot: root,
      sandboxCommand: "sh",
      transport: async (request) => {
        captured = request;
        return {
          stdout: JSON.stringify({ structured_output: gatewayValue }),
          stderr: "",
          exitCode: 0,
          sandboxed: true,
        };
      },
    });
    await runner.runStructured(operation());
    expect(captured).toBeDefined();
    expect(captured!.env.APP_SESSION_SECRET).toBeUndefined();
    expect(captured!.env.APP_AUTH_PASSWORD_HASH).toBeUndefined();
    expect(captured!.env.PATH).toBeString();
    expect(captured!.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe("1");
    expect(captured!.env.CLAUDE_CODE_SAFE_MODE).toBe("1");
    expect(captured!.env.CLAUDE_CODE_SIMPLE).toBeUndefined();
    const schemaIndex = captured!.command.indexOf("--json-schema");
    const cliSchema = JSON.parse(captured!.command[schemaIndex + 1]!) as Record<
      string,
      unknown
    >;
    expect(cliSchema.$schema).toBeUndefined();
  });

  test("refuses an unsafe production fallback when srt is unavailable", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-contract-"));
    created.push(root);
    const runner = new SandboxRunner({
      tempRoot: root,
      sandboxCommand: `missing-srt-${crypto.randomUUID()}`,
      allowUnsafeLocalFallback: false,
      transport: async () => {
        throw new Error("transport must not run");
      },
    });
    await expect(runner.runStructured(operation())).rejects.toThrow(
      "Sandbox Runtime",
    );
  });

  test("serializes AI operations globally", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-contract-"));
    created.push(root);
    let active = 0;
    let maximumActive = 0;
    const runner = new SandboxRunner({
      tempRoot: root,
      sandboxCommand: "sh",
      transport: async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await Bun.sleep(15);
        active -= 1;
        return {
          stdout: JSON.stringify({ structured_output: gatewayValue }),
          stderr: "",
          exitCode: 0,
          sandboxed: true,
        };
      },
    });
    await Promise.all([
      runner.runStructured(operation()),
      runner.runStructured(operation()),
      runner.runStructured(operation()),
    ]);
    expect(maximumActive).toBe(1);
  });

  test("exposes and cancels a running AI operation", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-contract-"));
    created.push(root);
    const runner = new SandboxRunner({
      tempRoot: root,
      sandboxCommand: "sh",
      transport: async (request) =>
        await new Promise((_, reject) => {
          request.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("cancelled", "AbortError")),
            { once: true },
          );
        }),
    });
    const cancellableOperation = {
      ...operation(),
      assessmentId: `cancel-test-${crypto.randomUUID()}`,
    };
    const pending = runner.runStructured(cancellableOperation);
    let active: ReturnType<typeof listAiOperations>[number] | undefined;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      active = listAiOperations().find(
        (item) => item.assessmentId === cancellableOperation.assessmentId,
      );
      if (active?.state === "running") break;
      await Bun.sleep(10);
    }
    const wasRunning = active?.state === "running";
    const cancelled = active ? cancelAiOperation(active.operationId) : false;
    await expect(pending).rejects.toThrow();
    expect(wasRunning).toBe(true);
    expect(cancelled).toBe(true);
    expect(listAiOperations()).toHaveLength(0);
  });

  test("stages only explicitly selected uploads inside the disposable workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-contract-"));
    const uploads = await mkdtemp(join(tmpdir(), "ai-uploads-"));
    created.push(root, uploads);
    const selectedPath = join(uploads, "selected.txt");
    const unselectedPath = join(uploads, "unselected.txt");
    await writeFile(selectedPath, "selected evidence", "utf8");
    await writeFile(unselectedPath, "must not be copied", "utf8");
    const runner = new SandboxRunner({
      tempRoot: root,
      uploadRoot: uploads,
      sandboxCommand: "sh",
      transport: async (request) => {
        expect(
          await readFile(
            join(request.cwd, "uploads", "upload-1-selected.txt"),
            "utf8",
          ),
        ).toBe("selected evidence");
        expect(
          await Bun.file(
            join(request.cwd, "uploads", "unselected.txt"),
          ).exists(),
        ).toBe(false);
        return {
          stdout: JSON.stringify({ structured_output: gatewayValue }),
          stderr: "",
          exitCode: 0,
          sandboxed: true,
        };
      },
    });
    await runner.runStructured({
      ...operation(),
      selectedUploads: [
        {
          id: "upload-1",
          name: "selected.txt",
          path: selectedPath,
          size: 17,
          sha256: createHash("sha256")
            .update("selected evidence")
            .digest("hex"),
        },
      ],
    });
    await writeFile(selectedPath, "tampered evidence", "utf8");
    await expect(
      runner.runStructured({
        ...operation(),
        selectedUploads: [
          {
            id: "upload-1",
            name: "selected.txt",
            path: selectedPath,
            size: 17,
            sha256: createHash("sha256")
              .update("selected evidence")
              .digest("hex"),
          },
        ],
      }),
    ).rejects.toThrow("changed after validation");
  });

  test("kills a timed-out CLI process and releases the global queue", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-contract-"));
    created.push(root);
    const cli = join(root, "fake-claude.sh");
    await writeFile(cli, "#!/bin/sh\nsleep 5\n", { mode: 0o700 });
    await chmod(cli, 0o700);
    const runner = new SandboxRunner({
      tempRoot: join(root, "operations"),
      claudeCommand: cli,
      sandboxCommand: `missing-srt-${crypto.randomUUID()}`,
      allowUnsafeLocalFallback: true,
    });
    const started = performance.now();
    await expect(
      runner.runStructured({
        ...operation(),
        model: { ...model, timeoutMs: 50 },
      }),
    ).rejects.toThrow();
    expect(performance.now() - started).toBeLessThan(2_000);
    await writeFile(
      cli,
      `#!/bin/sh\nprintf '%s\\n' '${JSON.stringify({ structured_output: gatewayValue })}'\n`,
      { mode: 0o700 },
    );
    await expect(runner.runStructured(operation())).resolves.toEqual(
      expect.objectContaining({ value: gatewayValue }),
    );
  });
});
