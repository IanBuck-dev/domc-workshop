import { Hono } from "hono";
import {
  cancelAiOperation,
  listAiOperations,
} from "../../../../packages/claude/src/sandbox-runner.ts";

export function aiOperationRoutes() {
  const app = new Hono();
  app.get("/", (c) => c.json(listAiOperations()));
  app.delete("/:operationId", (c) => {
    const cancelled = cancelAiOperation(c.req.param("operationId"));
    return cancelled
      ? c.json({ cancelled: true })
      : c.json({ error: "Die KI-Aktion ist nicht mehr aktiv." }, 404);
  });
  return app;
}
