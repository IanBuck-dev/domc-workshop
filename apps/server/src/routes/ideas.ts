import { Hono } from "hono";
import { z } from "zod";
import { ideaSchema } from "../../../../packages/domain/src/schemas.ts";
import { rankIdeas } from "../../../../packages/domain/src/ranking.ts";
import type { MarkdownIdeaRepository } from "../../../../packages/storage/src/markdown-idea-repository.ts";
export function ideaRoutes(repo: MarkdownIdeaRepository) {
  const app = new Hono();
  app.get("/", async (c) => c.json(rankIdeas(await repo.list())));
  app.get("/:id/history", async (c) =>
    c.json(await repo.history(c.req.param("id"))),
  );
  app.post("/", async (c) => {
    const v = z
      .object({ title: z.string().min(2), raw: z.string().min(5) })
      .parse(await c.req.json());
    return c.json(await repo.create(v.title, v.raw), 201);
  });
  app.get("/:id", async (c) => {
    const i = await repo.get(c.req.param("id"));
    return i ? c.json(i) : c.json({ error: "Nicht gefunden" }, 404);
  });
  app.put("/:id", async (c) => {
    const current = await repo.get(c.req.param("id"));
    if (!current) return c.json({ error: "Nicht gefunden" }, 404);
    const body = await c.req.json();
    const updated = ideaSchema.parse({
      ...current,
      ...body,
      id: current.id,
      raw: current.raw,
      updatedAt: new Date().toISOString(),
    });
    return c.json(await repo.save(updated, "manual-update"));
  });
  return app;
}
