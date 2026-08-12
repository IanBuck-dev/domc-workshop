import { afterEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pddExportRoutes } from "../apps/server/src/routes/pdd-exports.ts";
import { PddExportRepository } from "../packages/storage/src/pdd-export-repository.ts";
import { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";
import { confirmedProcess } from "./opportunity-fixtures.ts";

const roots: string[] = [];
afterEach(() =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);

describe("PDD export API", () => {
  test("returns an XLSX attachment only for confirmed processes", async () => {
    const root = await mkdtemp(join(tmpdir(), "pdd-api-"));
    roots.push(root);
    const processes = new ProcessCaptureRepository(root);
    const record = await confirmedProcess(processes);
    const app = new Hono();
    app.route(
      "/api/processes",
      pddExportRoutes(
        processes,
        new PddExportRepository(root, join(import.meta.dir, "..", "defaults")),
      ),
    );
    expect(
      (
        await app.request("/api/processes/PROC-9999/pdd-export", {
          method: "POST",
        })
      ).status,
    ).toBe(404);
    const response = await app.request(
      `/api/processes/${record.id}/pdd-export`,
      { method: "POST" },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "spreadsheetml.sheet",
    );
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("x-pdd-source-revision")).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });
});
