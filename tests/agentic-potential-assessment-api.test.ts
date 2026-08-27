import { afterEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgenticPotentialAssessmentService } from "../apps/server/src/agentic-potential-assessment-service.ts";
import { agenticPotentialAssessmentRoutes } from "../apps/server/src/routes/agentic-potential-assessments.ts";
import type { AgenticPotentialAssessmentAiAdapter } from "../packages/claude/src/agentic-potential-assessment-adapter.ts";
import { processOperationStatusSchema } from "../packages/domain/src/process-events.ts";
import { AgenticPotentialAssessmentRepository } from "../packages/storage/src/agentic-potential-assessment-repository.ts";
import { OpportunityDiscoveryRepository } from "../packages/storage/src/opportunity-discovery-repository.ts";
import { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";
import {
  assessmentAiResult,
  completedOpportunity,
} from "./agentic-potential-assessment-fixtures.ts";
import { aiTrace, confirmedProcess } from "./opportunity-fixtures.ts";

const roots: string[] = [];
afterEach(() =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);

async function waitForState(
  repository: AgenticPotentialAssessmentRepository,
  processId: string,
  state: string,
) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const record = await repository.get(processId).catch(() => null);
    if (record?.state === state) return record;
    await Bun.sleep(5);
  }
  throw new Error(`State ${state} was not reached.`);
}

async function fixture(failures = 0) {
  const root = await mkdtemp(join(tmpdir(), "agentic-assessment-api-"));
  roots.push(root);
  const processes = new ProcessCaptureRepository(root);
  const process = await confirmedProcess(processes);
  const opportunities = new OpportunityDiscoveryRepository(root);
  await completedOpportunity(process, opportunities);
  const assessments = new AgenticPotentialAssessmentRepository(root);
  let attempts = 0;
  const ai: AgenticPotentialAssessmentAiAdapter = {
    assess: async () => {
      attempts += 1;
      if (attempts <= failures) throw new Error("Fiktiver Bewertungsfehler.");
      return { value: assessmentAiResult(), trace: aiTrace() };
    },
  };
  const service = new AgenticPotentialAssessmentService(
    processes,
    opportunities,
    assessments,
    ai,
    join(import.meta.dir, "..", "defaults"),
  );
  const app = new Hono();
  app.route(
    "/api/opportunities",
    agenticPotentialAssessmentRoutes(
      processes,
      opportunities,
      assessments,
      service,
      join(import.meta.dir, "..", "defaults"),
    ),
  );
  return { app, root, process, assessments, attempts: () => attempts };
}

describe("agentic potential assessment API", () => {
  test("runs one AI call, returns the stored result and exports without AI", async () => {
    const { app, process, assessments, attempts } = await fixture();
    const empty = await app.request(
      `/api/opportunities/${process.id}/agentic-assessment`,
    );
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ record: null, isStale: false });
    expect(
      (
        await app.request(
          `/api/opportunities/${process.id}/agentic-assessment/export`,
          { method: "POST" },
        )
      ).status,
    ).toBe(409);
    const start = await app.request(
      `/api/opportunities/${process.id}/agentic-assessment`,
      { method: "POST" },
    );
    expect(start.status).toBe(202);
    const completed = await waitForState(assessments, process.id, "completed");
    expect(attempts()).toBe(1);
    const detail = await app.request(
      `/api/opportunities/${process.id}/agentic-assessment`,
    );
    expect(detail.status).toBe(200);
    expect((await detail.json()).record.result.criteria).toHaveLength(32);
    const exported = await app.request(
      `/api/opportunities/${process.id}/agentic-assessment/export`,
      { method: "POST" },
    );
    expect(exported.status).toBe(200);
    expect(exported.headers.get("cache-control")).toBe("private, no-store");
    expect(exported.headers.get("x-agentic-assessment-revision")).toBe(
      completed.assessmentRevision,
    );
    expect(attempts()).toBe(1);
    const history = await readFile(
      join(assessments.dir(process.id), "history.jsonl"),
      "utf8",
    );
    expect(history).toContain("agentic-assessment-exported");
    expect(history).toContain('"sha256"');
    expect(history).toContain('"initiatedBy"');
  });

  test("allows exactly one bounded retry after failure", async () => {
    const { app, process, assessments, attempts } = await fixture(1);
    await app.request(`/api/opportunities/${process.id}/agentic-assessment`, {
      method: "POST",
    });
    await waitForState(assessments, process.id, "failed");
    expect(attempts()).toBe(1);
    expect(
      (
        await app.request(
          `/api/opportunities/${process.id}/agentic-assessment/retry`,
          { method: "POST" },
        )
      ).status,
    ).toBe(202);
    await waitForState(assessments, process.id, "completed");
    expect(attempts()).toBe(2);
    expect(
      (
        await app.request(
          `/api/opportunities/${process.id}/agentic-assessment/retry`,
          { method: "POST" },
        )
      ).status,
    ).toBe(409);
  });
});

test("assessment appears as a named process operation", () => {
  expect(
    processOperationStatusSchema.parse({
      operationId: crypto.randomUUID(),
      processId: "PROC-0001",
      operationName: "agentic-potential-assessment",
      state: "queued",
      position: 0,
      createdAt: new Date().toISOString(),
    }).operationName,
  ).toBe("agentic-potential-assessment");
});
