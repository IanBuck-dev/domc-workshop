import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { verifyProcessFlowFile } from "../apps/server/src/process-flow-verification.ts";
import { understanding } from "./process-fixtures.ts";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);

async function candidate(value: unknown) {
  const root = await mkdtemp(join(tmpdir(), "process-flow-verify-"));
  roots.push(root);
  const file = join(root, "process-understanding.json");
  await writeFile(file, JSON.stringify(value));
  return file;
}

describe("verify_process_flow", () => {
  test("accepts a valid V3 graph", async () => {
    const result = await verifyProcessFlowFile(
      await candidate(understanding()),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.revision).toMatch(/^[a-f0-9]{64}$/);
  });

  test("returns structured graph guardrail errors", async () => {
    const invalid = understanding();
    invalid.flow.edges[0]!.target = "step-99";
    const result = await verifyProcessFlowFile(await candidate(invalid));
    expect(result).toMatchObject({ ok: false });
    if (!result.ok)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "flow.edges[0].target",
            code: "unknown_target",
          }),
        ]),
      );
  });
});
