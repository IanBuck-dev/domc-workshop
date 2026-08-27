import { expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
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
