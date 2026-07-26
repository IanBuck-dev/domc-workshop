import { describe, expect, test } from "bun:test";
import {
  cancelProcessOperation,
  dismissFailedProcessOperations,
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
    const second = enqueueProcessOperation(
      `TEST-${crypto.randomUUID()}`,
      "process-synthesis",
      async () => {
        starts.push("second");
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
    ).toMatchObject({ state: "queued", position: 1 });
    expect(cancelProcessOperation(second.operationId)).toBe(true);
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
    expect(cancelProcessOperation(operation.operationId)).toBe(true);
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
});
