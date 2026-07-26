import { afterEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { opportunityRoutes } from "../apps/server/src/routes/opportunities.ts";
import {
  cancelProcessOperation,
  enqueueProcessOperation,
  listProcessOperations,
} from "../apps/server/src/process-operation-manager.ts";
import type { OpportunityAiAdapter } from "../packages/claude/src/opportunity-ai-contracts.ts";
import { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";
import { OpportunityDiscoveryRepository } from "../packages/storage/src/opportunity-discovery-repository.ts";
import {
  aiTrace,
  confirmedProcess,
  hypothesisAiResult,
  opportunityDefaults,
  scenarioResult,
} from "./opportunity-fixtures.ts";
import { cover, processConfig } from "./process-fixtures.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixture(
  confidence: "high" | "medium" = "high",
  failures: { hypotheses?: number; scenarios?: number } = {},
) {
  const root = await mkdtemp(join(tmpdir(), "opportunity-api-"));
  roots.push(root);
  const processes = new ProcessCaptureRepository(root);
  const process = await confirmedProcess(processes);
  const opportunities = new OpportunityDiscoveryRepository(root);
  const calls: string[] = [];
  let hypothesisAttempt = 0;
  let scenarioAttempt = 0;
  const ai: OpportunityAiAdapter = {
    discoverHypotheses: async () => {
      calls.push("hypotheses");
      hypothesisAttempt += 1;
      if (hypothesisAttempt <= (failures.hypotheses ?? 0))
        throw new Error("Fiktiver Hypothesenfehler.");
      return { value: hypothesisAiResult(confidence), trace: aiTrace() };
    },
    createScenarios: async () => {
      calls.push("scenarios");
      scenarioAttempt += 1;
      if (scenarioAttempt <= (failures.scenarios ?? 0))
        throw new Error("Fiktiver Szenariofehler.");
      return { value: scenarioResult(), trace: aiTrace() };
    },
  };
  const app = new Hono();
  app.onError((error, c) => c.json({ error: error.message }, 400));
  app.route(
    "/api/opportunities",
    opportunityRoutes(
      processes,
      opportunities,
      ai,
      join(import.meta.dir, "..", "defaults"),
    ),
  );
  return { app, process, processes, opportunities, calls };
}

async function waitForState(
  repository: OpportunityDiscoveryRepository,
  processId: string,
  state: string,
) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const record = await repository.required(processId);
    if (record.state === state) return record;
    await Bun.sleep(5);
  }
  throw new Error(`State ${state} was not reached.`);
}

async function waitForOperation(operationId: string, state?: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const operation = listProcessOperations().find(
      (item) => item.operationId === operationId,
    );
    if (state ? operation?.state === state : !operation) return;
    await Bun.sleep(5);
  }
  throw new Error(`Operation ${operationId} did not reach the expected state.`);
}

describe("opportunity discovery API", () => {
  test("runs hypotheses and scenarios in order and exposes progress", async () => {
    const { app, process, opportunities, calls } = await fixture();
    expect((await app.request(`/api/opportunities/${process.id}`)).status).toBe(
      404,
    );
    const start = await app.request(`/api/opportunities/${process.id}`, {
      method: "POST",
    });
    expect(start.status).toBe(202);
    const startBody = await start.json();
    expect(JSON.stringify(startBody)).not.toContain("configSnapshot");
    expect(JSON.stringify(startBody)).not.toContain("contractManifest");
    const completed = await waitForState(
      opportunities,
      process.id,
      "completed",
    );
    expect(completed.scenarios?.scenarios).toHaveLength(3);
    expect(calls).toEqual(["hypotheses", "scenarios"]);
    const detail = await app.request(`/api/opportunities/${process.id}`);
    expect(detail.status).toBe(200);
    const detailBody = await detail.json();
    expect(detailBody.record.state).toBe("completed");
    expect(JSON.stringify(detailBody)).not.toContain("configSnapshot");
    expect(JSON.stringify(detailBody)).not.toContain("contractManifest");
    expect(JSON.stringify(detailBody)).not.toContain(
      "Untersuche jeden bestätigten Prozessschritt",
    );
    const list = await app.request("/api/opportunities");
    expect(await list.json()).toEqual([
      expect.objectContaining({ processId: process.id, scenarioCount: 3 }),
    ]);
    expect(
      (
        await app.request(`/api/opportunities/${process.id}`, {
          method: "POST",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await app.request(`/api/opportunities/${process.id}/retry`, {
          method: "POST",
        })
      ).status,
    ).toBe(409);
  });

  test("rejects an unconfirmed process without creating opportunity files", async () => {
    const { app, processes, opportunities } = await fixture();
    const draft = await processes.create(cover, await processConfig());
    expect(
      (await app.request(`/api/opportunities/${draft.id}`, { method: "POST" }))
        .status,
    ).toBe(409);
    expect(await opportunities.get(draft.id)).toBeNull();
  });

  test("does not call scenario generation without high-confidence support", async () => {
    const { app, process, opportunities, calls } = await fixture("medium");
    expect(
      (
        await app.request(`/api/opportunities/${process.id}`, {
          method: "POST",
        })
      ).status,
    ).toBe(202);
    await waitForState(opportunities, process.id, "no_supported_hypotheses");
    expect(calls).toEqual(["hypotheses"]);
  });

  test("retries the complete pipeline after a phase-one failure", async () => {
    const { app, process, opportunities, calls } = await fixture("high", {
      hypotheses: 1,
    });
    expect(
      (
        await app.request(`/api/opportunities/${process.id}`, {
          method: "POST",
        })
      ).status,
    ).toBe(202);
    await waitForState(opportunities, process.id, "hypotheses_failed");
    expect(
      (
        await app.request(`/api/opportunities/${process.id}/retry`, {
          method: "POST",
        })
      ).status,
    ).toBe(202);
    await waitForState(opportunities, process.id, "completed");
    expect(calls).toEqual(["hypotheses", "hypotheses", "scenarios"]);
  });

  test("retries only phase two after scenario generation failed", async () => {
    const { app, process, opportunities, calls } = await fixture("high", {
      scenarios: 1,
    });
    expect(
      (
        await app.request(`/api/opportunities/${process.id}`, {
          method: "POST",
        })
      ).status,
    ).toBe(202);
    await waitForState(opportunities, process.id, "scenarios_failed");
    expect(
      (
        await app.request(`/api/opportunities/${process.id}/retry`, {
          method: "POST",
        })
      ).status,
    ).toBe(202);
    await waitForState(opportunities, process.id, "completed");
    expect(calls).toEqual(["hypotheses", "scenarios", "scenarios"]);
  });

  test("persists a queued cancellation as a retryable phase-one failure", async () => {
    let releaseBlocker!: () => void;
    const blockerGate = new Promise<void>((resolve) => {
      releaseBlocker = resolve;
    });
    const blocker = enqueueProcessOperation(
      `TEST-${crypto.randomUUID()}`,
      "process-synthesis",
      async () => blockerGate,
    );
    try {
      await waitForOperation(blocker.operationId, "running");
      const { app, process, opportunities, calls } = await fixture();
      const start = await app.request(`/api/opportunities/${process.id}`, {
        method: "POST",
      });
      const { operationId } = (await start.json()) as { operationId: string };

      expect(await cancelProcessOperation(operationId)).toBe(true);
      const record = await opportunities.required(process.id);
      expect(record.state).toBe("hypotheses_failed");
      expect(record.lastError).toMatchObject({
        phase: "hypotheses",
        cancelled: true,
      });
      expect(calls).toEqual([]);
    } finally {
      releaseBlocker();
      await waitForOperation(blocker.operationId);
    }
  });

  test("rejects a technical retry after the confirmed process changed", async () => {
    const { app, process, processes, opportunities, calls } = await fixture();
    const defaults = await opportunityDefaults();
    await opportunities.create(process, defaults.config, defaults.contracts);
    await opportunities.markHypothesesRunning(process.id);
    await opportunities.markPhaseFailed(
      process.id,
      "hypotheses",
      "Fiktiver technischer Fehler.",
    );
    const changedUnderstanding = structuredClone(process.understanding!);
    changedUnderstanding.purpose.value = "Fachlich korrigierter Prozesszweck";
    await processes.correctUnderstanding(
      process.id,
      changedUnderstanding,
      "Fiktive Korrektur für den Stale-Test.",
    );

    const retry = await app.request(`/api/opportunities/${process.id}/retry`, {
      method: "POST",
    });
    expect(retry.status).toBe(409);
    expect((await opportunities.required(process.id)).state).toBe(
      "hypotheses_failed",
    );
    expect(calls).toEqual([]);
  });
});
