import { Hono } from "hono";
import { join } from "node:path";
import { rankIdeas } from "../../../../packages/domain/src/ranking.ts";
import { handoverMarkdown } from "../../../../packages/domain/src/handover.ts";
import { atomicWrite } from "../../../../packages/storage/src/atomic-write.ts";
import type { MarkdownIdeaRepository } from "../../../../packages/storage/src/markdown-idea-repository.ts";
export function exportRoutes(repo: MarkdownIdeaRepository, root: string) {
  const app = new Hono();
  app.post("/", async (c) => {
    const ideas = rankIdeas(
      (await repo.list()).filter(
        (i) => i.state === "Für Übergabe ausgewählt" || i.state === "Übergeben",
      ),
    );
    if (!ideas.length)
      return c.json({ error: "Keine Projekte ausgewählt" }, 400);
    const stamp = new Date().toISOString().slice(0, 10),
      md = `IT-Uebergabe-${stamp}.md`,
      csv = `IT-Uebergabe-${stamp}.csv`;
    await atomicWrite(join(root, "exports", md), handoverMarkdown(ideas));
    await atomicWrite(
      join(root, "exports", csv),
      "ID;Titel;Herkunft;Priorität;Impact;Aufwand;KI-Relevanz\n" +
        ideas
          .map((i) =>
            [
              i.id,
              i.title,
              i.evidenceLevel,
              i.scores.priority,
              i.scores.impact,
              i.scores.effort,
              i.aiRelevance,
            ]
              .map((x) => `"${String(x).replaceAll('"', '""')}"`)
              .join(";"),
          )
          .join("\n"),
    );
    return c.json({ markdown: md, csv, count: ideas.length });
  });
  return app;
}
