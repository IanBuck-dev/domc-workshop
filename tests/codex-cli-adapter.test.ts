import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { CodexCliAdapter } from "../packages/ai-runtime/src/codex-cli-adapter.ts";

test("Codex structured calls use an ephemeral schema-constrained sandbox", async () => {
  let command: string[] = [];
  let submittedSchema: unknown;
  const adapter = new CodexCliAdapter({
    tempRoot: ".local/test-codex-runtime",
    sandboxMode: "off",
    transport: async (request) => {
      command = request.command;
      submittedSchema = JSON.parse(
        await readFile(`${request.cwd}/response-schema.json`, "utf8"),
      );
      return {
        stdout: JSON.stringify({ ok: true }),
        stderr: "",
        exitCode: 0,
        sandboxed: true,
      };
    },
  });
  const result = await adapter.runStructured({
    processId: "PROC-1",
    operationName: "test",
    prompt: "input",
    systemPrompt: "system",
    responseSchema: z.object({ ok: z.boolean() }),
    responseJsonSchema: {
      type: "object",
      properties: {
        schemaVersion: { const: 1 },
        result: {
          oneOf: [{ type: "object", properties: { status: { enum: ["ok"] } } }],
        },
        emptyValues: { type: "array", maxItems: 0 },
        values: { type: "array", uniqueItems: true, items: { type: "string" } },
      },
    },
    model: {
      model: "gpt-5.6-sol",
      effort: "medium",
      timeoutMs: 10_000,
      maxOutputTokens: 512,
      maxInputCharacters: 10_000,
      maxBudgetUsd: 1,
    },
    tools: "none",
  });
  expect(command).toContain("exec");
  expect(command).toContain("--ephemeral");
  expect(command).toContain("--ignore-user-config");
  expect(command).toContain("--ignore-rules");
  expect(command).toContain("--skip-git-repo-check");
  expect(command).toContain("-");
  expect(command).toContain("model_reasoning_effort=medium");
  expect(command).toContain('service_tier="default"');
  expect(command).toContain("--output-schema");
  expect(command).toContain("--json");
  expect(result.trace.provider).toBe("codex-cli");
  expect(submittedSchema).toEqual({
    type: "object",
    properties: {
      schemaVersion: { const: 1, type: "integer" },
      result: {
        anyOf: [
          {
            type: "object",
            properties: { status: { enum: ["ok"], type: "string" } },
          },
        ],
      },
      emptyValues: { type: "array", maxItems: 0, items: { type: "string" } },
      values: { type: "array", items: { type: "string" } },
    },
  });
});

test("Codex sandbox can read the wrapper's platform package", async () => {
  const root = await mkdtemp(join(tmpdir(), "claims-ai-codex-install-"));
  try {
    const packageRoot = join(root, "node_modules", "@openai", "codex");
    const wrapper = join(packageRoot, "bin", "codex.js");
    const sandbox = join(root, "srt");
    await mkdir(join(packageRoot, "bin"), { recursive: true });
    await writeFile(wrapper, "#!/usr/bin/env node\n");
    await writeFile(sandbox, "#!/bin/sh\n");
    await Promise.all([chmod(wrapper, 0o755), chmod(sandbox, 0o755)]);
    let settings: { filesystem?: { allowRead?: string[] } } = {};
    const adapter = new CodexCliAdapter({
      tempRoot: join(root, "runtime"),
      codexCommand: wrapper,
      sandboxCommand: sandbox,
      sandboxMode: "required",
      transport: async (request) => {
        const settingsPath = request.command[2];
        if (!settingsPath) throw new Error("Sandbox settings path missing.");
        settings = JSON.parse(await readFile(settingsPath, "utf8"));
        return {
          stdout: JSON.stringify({ ok: true }),
          stderr: "",
          exitCode: 0,
          sandboxed: true,
        };
      },
    });
    await adapter.runStructured({
      processId: "PROC-1",
      operationName: "sandbox-install-test",
      prompt: "input",
      systemPrompt: "system",
      responseSchema: z.object({ ok: z.boolean() }),
      responseJsonSchema: {
        type: "object",
        properties: { ok: { type: "boolean" } },
      },
      model: {
        model: "gpt-5.6-sol",
        effort: "medium",
        timeoutMs: 10_000,
        maxOutputTokens: 512,
        maxInputCharacters: 10_000,
        maxBudgetUsd: 1,
      },
      tools: "none",
    });
    expect(settings.filesystem?.allowRead).toContain(
      await realpath(packageRoot),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Codex structured calls reject an oversized last-message artifact", async () => {
  const adapter = new CodexCliAdapter({
    tempRoot: ".local/test-codex-runtime",
    sandboxMode: "off",
    transport: async (request) => {
      await writeFile(`${request.cwd}/last-message.txt`, "x".repeat(64_001));
      return { stdout: "", stderr: "", exitCode: 0, sandboxed: true };
    },
  });
  await expect(
    adapter.runStructured({
      processId: "PROC-1",
      operationName: "test",
      prompt: "input",
      systemPrompt: "system",
      responseSchema: z.object({ ok: z.boolean() }),
      responseJsonSchema: { type: "object" },
      model: {
        model: "gpt-5.6-sol",
        effort: "medium",
        timeoutMs: 10_000,
        maxOutputTokens: 1,
        maxInputCharacters: 10_000,
        maxBudgetUsd: 1,
      },
      tools: "none",
    }),
  ).rejects.toThrow("output exceeded");
});

test("Codex structured calls attach selected images as multimodal input", async () => {
  const root = await mkdtemp(join(tmpdir(), "claims-ai-codex-image-"));
  try {
    const source = join(root, "scan.png");
    const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
      "base64",
    );
    await writeFile(source, bytes);
    let command: string[] = [];
    const adapter = new CodexCliAdapter({
      tempRoot: join(root, "runtime"),
      uploadRoot: root,
      sandboxMode: "off",
      transport: async (request) => {
        command = request.command;
        return {
          stdout: JSON.stringify({ ok: true }),
          stderr: "",
          exitCode: 0,
          sandboxed: true,
        };
      },
    });
    await adapter.runStructured({
      processId: "PROC-1",
      operationName: "image-test",
      prompt: "Werte das Bild aus.",
      systemPrompt: "System",
      responseSchema: z.object({ ok: z.boolean() }),
      responseJsonSchema: {
        type: "object",
        properties: { ok: { type: "boolean" } },
      },
      model: {
        model: "gpt-5.6-sol",
        effort: "medium",
        timeoutMs: 10_000,
        maxOutputTokens: 512,
        maxInputCharacters: 10_000,
        maxBudgetUsd: 1,
      },
      tools: "workspace",
      selectedUploads: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          name: "scan.png",
          path: source,
          size: bytes.byteLength,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      ],
    });
    const imageIndex = command.indexOf("--image");
    expect(imageIndex).toBeGreaterThan(-1);
    expect(command[imageIndex + 1]).toMatch(
      /^uploads\/00000000-0000-4000-8000-000000000001-scan\.png$/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
