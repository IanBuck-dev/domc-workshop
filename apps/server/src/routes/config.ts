import { Hono } from "hono";
import type { WorkspaceRepository } from "../../../../packages/storage/src/workspace-repository.ts";

export function configRoutes(workspace: WorkspaceRepository) {
  const app = new Hono();
  app.get("/defaults", async (c) =>
    c.json(await workspace.assessmentDefaults()),
  );
  return app;
}
