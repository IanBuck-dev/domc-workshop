import { claudeResultSchema, claudeJsonSchema } from "./response-schemas.ts";
import { buildPrompt, claudeArgs } from "./request-builder.ts";
import type { Idea, Workshop } from "../../domain/src/schemas.ts";
export class ClaudeCliAdapter {
  async run(
    operation: string,
    idea: Idea,
    instructions: string,
    settings: Workshop,
    effortOverride?: Workshop["effort"],
  ) {
    const args = claudeArgs(
      settings.model,
      effortOverride ?? settings.effort,
      claudeJsonSchema,
    );
    const proc = Bun.spawn(["claude", ...args], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" },
    });
    proc.stdin.write(buildPrompt(operation, idea, instructions, settings));
    proc.stdin.end();
    const timer = setTimeout(() => proc.kill(), 90_000);
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    clearTimeout(timer);
    if (code !== 0)
      throw new Error(
        `Claude konnte die Bewertung nicht abschließen: ${err.slice(0, 300)}`,
      );
    const envelope = JSON.parse(out);
    const raw =
      envelope.structured_output ??
      (envelope.result ? JSON.parse(envelope.result) : envelope);
    return claudeResultSchema.parse(raw);
  }
}
