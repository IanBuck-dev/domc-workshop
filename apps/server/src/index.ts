import { Hono } from "hono";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { ZodError } from "zod";
import { WorkspaceRepository } from "../../../packages/storage/src/workspace-repository.ts";
import { AssessmentRepository } from "../../../packages/storage/src/assessment-repository.ts";
import { ClaudeAssessmentAiAdapter } from "../../../packages/claude/src/assessment-ai-adapter.ts";
import { assessmentRoutes } from "./routes/assessments.ts";
import { authRoutes } from "./routes/auth.ts";
import { configRoutes } from "./routes/config.ts";
import { rankingRoutes } from "./routes/ranking.ts";
import { comparisonRoutes } from "./routes/comparisons.ts";
import { aiOperationRoutes } from "./routes/ai-operations.ts";
import { requireSession } from "./session.ts";
import {
  workspacePath,
  hasWebDist,
  webDist,
  openBrowser,
  appBase,
  availablePort,
  acquireInstanceLock,
} from "./launcher.ts";
const root = workspacePath(),
  ws = new WorkspaceRepository(root, join(appBase(), "defaults"));
await ws.ensure();
await acquireInstanceLock(root);
const assessmentRepo = new AssessmentRepository(root),
  app = new Hono();
app.onError((error, c) => {
  console.error(error);
  if (error instanceof ZodError)
    return c.json(
      {
        error:
          "Bitte prüfen Sie Ihre Eingaben. Mindestens eine Angabe fehlt oder hat ein ungültiges Format.",
      },
      400,
    );
  const internalOperationError =
    error instanceof SyntaxError ||
    /Claude|sandbox|structured|schema|JSON|output exceeded|ENOENT|EACCES/i.test(
      error instanceof Error ? error.message : "",
    );
  return c.json(
    {
      error: internalOperationError
        ? "Die Aktion konnte nicht abgeschlossen werden. Ihre bisherigen Angaben bleiben erhalten."
        : error instanceof Error
          ? error.message
          : "Interner Fehler",
    },
    500,
  );
});
const instanceId = `${process.pid}-${Date.now()}`;
app.get("/api/health", (c) => c.json({ ok: true, instanceId }));
app.route("/api/auth", authRoutes());
app.use("/api/*", requireSession);
app.route("/api/config", configRoutes(ws));
app.route(
  "/api/assessments",
  assessmentRoutes(assessmentRepo, new ClaudeAssessmentAiAdapter()),
);
app.route("/api/ranking", rankingRoutes(assessmentRepo));
app.route("/api/comparisons", comparisonRoutes(assessmentRepo));
app.route("/api/ai-operations", aiOperationRoutes());
app.all("/api/*", (c) =>
  c.json({ error: "API-Endpunkt nicht gefunden." }, 404),
);
if (hasWebDist()) {
  app.get("*", async (c) => {
    const pathname = new URL(c.req.url).pathname;
    const relative = pathname.replace(/^\/+/, "");
    const candidate = join(webDist(), relative);
    const path =
      relative && !relative.includes("..") && existsSync(candidate)
        ? candidate
        : join(webDist(), "index.html");
    return new Response(Bun.file(path));
  });
} else {
  app.get("*", async (c) => {
    const url = new URL(c.req.url);
    const target = `http://127.0.0.1:5173${url.pathname}${url.search}`;
    return c.redirect(target);
  });
}
const port = process.env.PORT
  ? Number(process.env.PORT)
  : await availablePort(3210);
console.log(`KI-Potenziale: http://127.0.0.1:${port}`);
if (!process.env.BUN_WATCH) void openBrowser(`http://127.0.0.1:${port}`);
export default {
  port,
  hostname: "127.0.0.1",
  idleTimeout: 100,
  fetch: app.fetch,
};
