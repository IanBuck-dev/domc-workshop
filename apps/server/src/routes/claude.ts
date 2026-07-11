import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { MarkdownIdeaRepository } from "../../../../packages/storage/src/markdown-idea-repository.ts";
import type { WorkspaceRepository } from "../../../../packages/storage/src/workspace-repository.ts";
import { ClaudeCliAdapter } from "../../../../packages/claude/src/claude-cli-adapter.ts";
import { deterministicPriority } from "../../../../packages/domain/src/priority.ts";
export function claudeRoutes(
  repo: MarkdownIdeaRepository,
  ws: WorkspaceRepository,
) {
  const app = new Hono();
  app.post("/:id/:operation", async (c) => {
    const op = c.req.param("operation");
    if (!["structure", "assess", "refresh", "prepare-handover"].includes(op))
      return c.json({ error: "Unbekannte Operation" }, 400);
    const idea = await repo.get(c.req.param("id"));
    if (!idea) return c.json({ error: "Nicht gefunden" }, 404);
    try {
      const settings = await ws.settings();
      const result = await new ClaudeCliAdapter().run(
        op,
        idea,
        await readFile(join(ws.root, "CLAUDE.md"), "utf8"),
        settings,
      );
      const updated = {
        ...idea,
        brief: result.brief,
        assessment: result.assessment,
        clarificationQuestions: result.clarificationQuestions,
        aiRelevance: result.aiRelevance,
        relevanceRationale: result.relevanceRationale,
        conventionalAlternative: result.conventionalAlternative,
        scores: {
          priority: deterministicPriority(
            result.priorityComponents,
            settings.weights,
          ),
          impact: result.impact,
          effort: result.effort,
          confidence: result.confidence,
        },
        scoreComponents: result.priorityComponents,
        assumptions: result.assumptions,
        risks: result.risks,
        reviewFlags: result.reviewFlags,
        state: (result.clarificationQuestions.length
          ? "Klärung nötig"
          : op === "prepare-handover"
            ? "Übergeben"
            : "Bewertet") as typeof idea.state,
        updatedAt: new Date().toISOString(),
      };
      return c.json(await repo.save(updated, `claude-${op}`));
    } catch (e) {
      return c.json(
        { error: e instanceof Error ? e.message : "Claude-Fehler" },
        502,
      );
    }
  });
  return app;
}
