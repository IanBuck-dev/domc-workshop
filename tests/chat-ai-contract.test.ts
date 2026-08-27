import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import packageJson from "../package.json";
import { prepareChatSandboxSpawn } from "../packages/claude/src/chat-sandbox-spawn.ts";

describe("chat AI runtime contract", () => {
  test("pins the reviewed AI SDK and diagram versions", () => {
    expect(packageJson.dependencies.ai).toBe("7.0.48");
    expect(packageJson.dependencies["@ai-sdk/react"]).toBe("4.0.51");
    expect(packageJson.dependencies["ai-sdk-provider-claude-code"]).toBe(
      "4.0.1",
    );
    expect(packageJson.dependencies["@xyflow/react"]).toBe("12.11.2");
    expect(packageJson.dependencies["@shadcn/react"]).toBe("0.2.1");
  });

  test("uses current stream APIs and the frozen model setting", async () => {
    const adapter = await readFile(
      join(process.cwd(), "packages/claude/src/chat-capture-adapter.ts"),
      "utf8",
    );
    const route = await readFile(
      join(process.cwd(), "apps/server/src/routes/chat-captures.ts"),
      "utf8",
    );
    // Die Zugschleife lebt seit dem Hintergrund-Runner nicht mehr in der Route:
    // Die Route hört nur noch zu.
    const runner = await readFile(
      join(process.cwd(), "apps/server/src/chat-turn-runner.ts"),
      "utf8",
    );
    expect(adapter).toContain("streamText");
    expect(adapter).toContain(
      'provider(providerModel("claude-cli", request.model)',
    );
    expect(adapter).toContain("strictMcpConfig: true");
    expect(adapter).toContain('effort: "medium"');
    expect(adapter).toContain("persistSession: true");
    expect(adapter).toContain("settingSources: []");
    expect(adapter).toContain("maxTurns: 20");
    expect(route).toContain("createUIMessageStreamResponse");
    expect(runner).toContain(
      "for await (const part of active.result.fullStream)",
    );
    expect(runner).not.toContain("consumeStream");
    expect(route).not.toContain("consumeStream");
    expect(route).toContain("data-chat-activity");
    expect(route).not.toContain("writer.write({ type: part.type");
    // Der Zug bekommt sein eigenes Abbruchsignal — die HTTP-Verbindung darf ihn
    // nicht mehr beenden (Neuladen der Seite).
    expect(runner).toContain("new AbortController()");
    expect(route).not.toContain("c.req.raw.signal");
  });

  test("keeps the published JSON schema aligned with nested runtime IDs", async () => {
    const schema = JSON.parse(
      await readFile(
        join(process.cwd(), "defaults/ai-schemas/process-understanding.json"),
        "utf8",
      ),
    );
    expect(schema.properties.steps.minItems).toBe(1);
    expect(schema.$defs.informationItem.required).toContain("id");
    expect(schema.properties.flow.$ref).toBe("#/$defs/flow");
    expect(schema.$defs.gatewayNode.required).toContain("question");
    expect(schema.$defs.flowEdge.required).toEqual(["id", "source", "target"]);
    expect(schema.$defs.evidence.properties.kind.enum).toContain(
      "human_correction",
    );
  });

  test("fails closed without SRT and allows the explicit local Bun override", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "chat-sandbox-"));
    try {
      await expect(
        prepareChatSandboxSpawn({
          cwd,
          sandboxMode: "required",
          sandboxCommand: "missing-srt-for-test",
        }),
      ).rejects.toThrow("required but unavailable");
      const spawn = await prepareChatSandboxSpawn({ cwd, sandboxMode: "off" });
      const child = spawn({
        command: process.execPath,
        args: ["-e", 'process.stdout.write("ok")'],
        cwd,
        env: process.env,
        signal: new AbortController().signal,
      });
      let output = "";
      for await (const chunk of child.stdout) output += String(chunk);
      expect(output).toBe("ok");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("limits sandbox file access to selected process artifacts", async () => {
    const source = await readFile(
      join(process.cwd(), "packages/claude/src/chat-sandbox-spawn.ts"),
      "utf8",
    );
    expect(source).toContain('join(options.cwd, "uploads")');
    expect(source).toContain('join(options.cwd, "chat", "contracts")');
    expect(source).toContain('join(options.cwd, "process-understanding.json")');
    expect(source).not.toContain("allowedRead = [\n    options.cwd,");
    expect(source).not.toContain('join(options.cwd, "chat"),');
  });
});
