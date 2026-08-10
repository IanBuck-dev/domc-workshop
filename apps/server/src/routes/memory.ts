import { Hono } from "hono";
import { buildMemoryOverview } from "../../../../packages/domain/src/memory.ts";
import type { MemoryRepository } from "../../../../packages/storage/src/memory-repository.ts";
import { MemoryConsolidationConflictError } from "../process-operation-manager.ts";
import type { MemoryConsolidationService } from "../memory-consolidation-service.ts";

/** Fester Grund im Audit — der Reset ist eine menschliche Korrektur. */
const resetTrigger = "manueller Reset";

export function memoryRoutes(
  service: MemoryConsolidationService,
  memory: MemoryRepository,
) {
  const app = new Hono();
  app.get("/", async (c) => c.json(buildMemoryOverview(await memory.topics())));
  app.delete("/", async (c) => {
    const { topics } = await memory.resetAll(resetTrigger);
    return c.json(buildMemoryOverview(topics));
  });
  app.post("/consolidate", (c) => {
    try {
      return c.json(service.start(), 202);
    } catch (error) {
      if (error instanceof MemoryConsolidationConflictError)
        return c.json({ error: error.message }, 409);
      throw error;
    }
  });
  return app;
}
