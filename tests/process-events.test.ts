import { describe, expect, test } from "bun:test";
import {
  subscribeProcessEvents,
  publishProcessChanged,
  type ProcessEvent,
} from "../apps/server/src/process-events.ts";
import { enqueueProcessOperation } from "../apps/server/src/process-operation-manager.ts";

async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await Bun.sleep(2);
  }
  throw new Error("Expected event was not published.");
}

describe("process events", () => {
  test("meldet jede Änderung der Warteschlange ohne Abfrage", async () => {
    const processId = `TEST-${crypto.randomUUID()}`;
    const seen: ProcessEvent[] = [];
    const unsubscribe = subscribeProcessEvents((event) => seen.push(event));
    try {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const operation = enqueueProcessOperation(
        processId,
        "process-follow-ups",
        async () => {
          await gate;
        },
      );

      const statesFor = (state: string) =>
        seen.some(
          (event) =>
            event.type === "operations" &&
            event.operations.some(
              (item) =>
                item.operationId === operation.operationId &&
                item.state === state,
            ),
        );

      expect(statesFor("queued")).toBe(true);
      await until(() => statesFor("running"));
      release();
      await until(() =>
        seen.some(
          (event) =>
            event.type === "operations" &&
            !event.operations.some(
              (item) => item.operationId === operation.operationId,
            ),
        ),
      );
    } finally {
      unsubscribe();
    }
  });

  test("meldet geänderte Prozesse und stellt das Zuhören wieder ein", () => {
    const seen: string[] = [];
    const unsubscribe = subscribeProcessEvents((event) => {
      if (event.type === "process-changed") seen.push(event.processId);
    });
    publishProcessChanged("PROC-0042");
    unsubscribe();
    publishProcessChanged("PROC-0043");
    expect(seen).toEqual(["PROC-0042"]);
  });
});
