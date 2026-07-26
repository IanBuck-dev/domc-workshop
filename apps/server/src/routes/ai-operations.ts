import { Hono } from "hono";
import {
  cancelProcessOperation,
  dismissFailedOperation,
  listProcessOperations,
} from "../process-operation-manager.ts";

export function aiOperationRoutes() {
  const app = new Hono();
  app.get("/", (c) => c.json(listProcessOperations()));
  app.delete("/:operationId", (c) => {
    const id = c.req.param("operationId");
    const cancelled = cancelProcessOperation(id) || dismissFailedOperation(id);
    return cancelled
      ? c.json({ cancelled: true })
      : c.json({ error: "Die KI-Aktion ist nicht mehr aktiv." }, 404);
  });
  return app;
}
