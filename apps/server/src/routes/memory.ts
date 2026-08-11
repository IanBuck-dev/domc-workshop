import { Hono } from "hono";
import {
  buildMemoryOverview,
  memoryOverviewProcessIds,
  resolveMemoryOverviewSources,
  type MemoryProcessSource,
  type MemoryTopics,
} from "../../../../packages/domain/src/memory.ts";
import type { MemoryRepository } from "../../../../packages/storage/src/memory-repository.ts";
import type { ProcessCaptureRepository } from "../../../../packages/storage/src/process-capture-repository.ts";
import { MemoryConsolidationConflictError } from "../process-operation-manager.ts";
import type { MemoryConsolidationService } from "../memory-consolidation-service.ts";

/** Fester Grund im Audit — der Reset ist eine menschliche Korrektur. */
const resetTrigger = "manueller Reset";

/**
 * Übersicht mit aufgelöster Herkunft. Eine gelöschte oder unlesbare
 * Prozessaufnahme darf die Ansicht nie scheitern lassen.
 */
async function overviewWithSources(
  topics: MemoryTopics,
  processes: ProcessCaptureRepository,
) {
  const overview = buildMemoryOverview(topics);
  const found = new Map<string, MemoryProcessSource>();
  await Promise.all(
    memoryOverviewProcessIds(overview).map(async (processId) => {
      const record = await processes.get(processId).catch(() => null);
      if (!record) return;
      found.set(processId, {
        processName: record.cover.processName,
        department: record.cover.department,
        participantName: record.cover.participantName,
      });
    }),
  );
  return resolveMemoryOverviewSources(
    overview,
    (processId) => found.get(processId) ?? null,
  );
}

export function memoryRoutes(
  service: MemoryConsolidationService,
  memory: MemoryRepository,
  processes: ProcessCaptureRepository,
) {
  const app = new Hono();
  app.get("/", async (c) =>
    c.json(await overviewWithSources(await memory.topics(), processes)),
  );
  app.delete("/", async (c) => {
    const { topics } = await memory.resetAll(resetTrigger);
    return c.json(await overviewWithSources(topics, processes));
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
