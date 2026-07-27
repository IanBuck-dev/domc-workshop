import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  subscribeProcessEvents,
  type ProcessEvent,
} from "../process-events.ts";
import { listProcessOperations } from "../process-operation-manager.ts";

/** Alle 25 Sekunden ein Lebenszeichen, damit ruhige Verbindungen offen bleiben. */
const heartbeatMs = 25_000;

export function eventRoutes() {
  const app = new Hono();
  app.get("/", (c) =>
    streamSSE(c, async (stream) => {
      // Schreibvorgänge nacheinander abarbeiten: die Ereignisse kommen
      // synchron herein, das Schreiben in den Strom ist asynchron.
      let queue: Promise<unknown> = Promise.resolve();
      const send = (event: ProcessEvent) => {
        queue = queue
          .then(() =>
            stream.writeSSE({
              event: event.type,
              data: JSON.stringify(event),
            }),
          )
          .catch(() => undefined);
      };

      const unsubscribe = subscribeProcessEvents(send);
      const heartbeat = setInterval(() => {
        queue = queue
          .then(() => stream.writeSSE({ event: "ping", data: "" }))
          .catch(() => undefined);
      }, heartbeatMs);

      // Erster Stand direkt nach dem Verbinden, auch nach einem Neuaufbau.
      send({ type: "operations", operations: listProcessOperations() });

      await new Promise<void>((resolve) => stream.onAbort(resolve));
      clearInterval(heartbeat);
      unsubscribe();
    }),
  );
  return app;
}
