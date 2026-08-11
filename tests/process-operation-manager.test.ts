import { describe, expect, test } from "bun:test";
import {
  cancelProcessOperation,
  dismissFailedProcessOperations,
  enqueueMemoryConsolidation,
  enqueueProcessOperation,
  listProcessOperations,
} from "../apps/server/src/process-operation-manager.ts";

async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await Bun.sleep(2);
  }
  throw new Error("Expected operation state was not reached.");
}

describe("process operation manager", () => {
  test("runs globally at concurrency one and removes a cancelled queued job immediately", async () => {
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const starts: string[] = [];
    const first = enqueueProcessOperation(
      `TEST-${crypto.randomUUID()}`,
      "process-follow-ups",
      async () => {
        starts.push("first");
        await firstGate;
      },
    );
    let queuedCancelPersisted = false;
    const second = enqueueProcessOperation(
      `TEST-${crypto.randomUUID()}`,
      "opportunity-discovery",
      async () => {
        starts.push("second");
      },
      async () => {
        queuedCancelPersisted = true;
      },
    );

    await until(
      () =>
        listProcessOperations().find(
          (operation) => operation.operationId === first.operationId,
        )?.state === "running",
    );
    expect(starts).toEqual(["first"]);
    expect(
      listProcessOperations().find(
        (operation) => operation.operationId === second.operationId,
      ),
    ).toMatchObject({
      operationName: "opportunity-discovery",
      state: "queued",
      position: 1,
    });
    expect(await cancelProcessOperation(second.operationId)).toBe(true);
    expect(queuedCancelPersisted).toBe(true);
    expect(
      listProcessOperations().some(
        (operation) => operation.operationId === second.operationId,
      ),
    ).toBe(false);

    releaseFirst();
    await until(
      () =>
        !listProcessOperations().some(
          (operation) => operation.operationId === first.operationId,
        ),
    );
    expect(starts).toEqual(["first"]);
  });

  test("removes a cancelled running job after its bounded action stops", async () => {
    let observedAbort = false;
    const operation = enqueueProcessOperation(
      `TEST-${crypto.randomUUID()}`,
      "process-follow-ups",
      async (signal) =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => {
              observedAbort = true;
              reject(new DOMException("cancelled", "AbortError"));
            },
            { once: true },
          );
        }),
    );
    await until(
      () =>
        listProcessOperations().find(
          (item) => item.operationId === operation.operationId,
        )?.state === "running",
    );
    expect(await cancelProcessOperation(operation.operationId)).toBe(true);
    await until(
      () =>
        !listProcessOperations().some(
          (item) => item.operationId === operation.operationId,
        ),
    );
    expect(observedAbort).toBe(true);
  });

  test("dismisses failed operations when their process is deleted and its id can be reused", async () => {
    const processId = `TEST-${crypto.randomUUID()}`;
    const failed = enqueueProcessOperation(
      processId,
      "process-follow-ups",
      async () => {
        throw new Error("expected test failure");
      },
    );
    await until(
      () =>
        listProcessOperations().find(
          (item) => item.operationId === failed.operationId,
        )?.state === "failed",
    );

    expect(dismissFailedProcessOperations(processId)).toBe(1);
    expect(
      listProcessOperations().some((item) => item.processId === processId),
    ).toBe(false);
  });

  test("allows one explicitly chained operation for the same process", async () => {
    const processId = `TEST-${crypto.randomUUID()}`;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = enqueueProcessOperation(
      processId,
      "opportunity-discovery",
      async () => gate,
    );
    await until(
      () =>
        listProcessOperations().find(
          (item) => item.operationId === first.operationId,
        )?.state === "running",
    );
    expect(() =>
      enqueueProcessOperation(processId, "memory-distillation", async () => {}),
    ).toThrow("bereits");
    const chained = enqueueProcessOperation(
      processId,
      "memory-distillation",
      async () => {},
      undefined,
      { allowSameProcessFollowup: true },
    );
    expect(() =>
      enqueueProcessOperation(
        processId,
        "process-follow-ups",
        async () => {},
        undefined,
        { allowSameProcessFollowup: true },
      ),
    ).toThrow("bereits");
    release();
    await until(
      () =>
        !listProcessOperations().some(
          (item) => item.operationId === chained.operationId,
        ),
    );
  });

  test("runs a global consolidation through the same serial queue", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const process = enqueueProcessOperation(
      `TEST-${crypto.randomUUID()}`,
      "process-follow-ups",
      async () => gate,
    );
    await until(
      () =>
        listProcessOperations().find(
          (item) => item.operationId === process.operationId,
        )?.state === "running",
    );
    let started = false;
    enqueueMemoryConsolidation(async () => {
      started = true;
      return { mergedCount: 0, deletedCount: 0, movedCount: 0, deletions: [] };
    });
    await Bun.sleep(5);
    expect(started).toBe(false);
    release();
    await until(() => started);
  });
});
