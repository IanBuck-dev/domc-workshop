import { Hono } from "hono";
import {
  cancelProcessOperation,
  dismissFailedOperation,
} from "../process-operation-manager.ts";

export function aiOperationRoutes() {
  const app = new Hono();
  // Den Stand der Warteschlange liefert /api/events, nicht dieser Router.
  app.delete("/:operationId", async (c) => {
    const id = c.req.param("operationId");
    const cancelled =
      (await cancelProcessOperation(id)) || dismissFailedOperation(id);
    return cancelled
      ? c.json({ cancelled: true })
      : c.json({ error: "Die KI-Aktion ist nicht mehr aktiv." }, 404);
  });
  return app;
}
