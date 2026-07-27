import { Hono } from "hono";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { ZodError } from "zod";
import {
  ProcessCaptureNotFoundError,
  ProcessCaptureRepository,
} from "../../../packages/storage/src/process-capture-repository.ts";
import { ClaudeProcessAiAdapter } from "../../../packages/claude/src/process-ai-adapter.ts";
import { ClaudeOpportunityAiAdapter } from "../../../packages/claude/src/opportunity-ai-adapter.ts";
import { OpportunityDiscoveryRepository } from "../../../packages/storage/src/opportunity-discovery-repository.ts";
import { processCaptureRoutes } from "./routes/process-captures.ts";
import { authRoutes } from "./routes/auth.ts";
import { configRoutes } from "./routes/config.ts";
import { aiOperationRoutes } from "./routes/ai-operations.ts";
import { eventRoutes } from "./routes/events.ts";
import { opportunityRoutes } from "./routes/opportunities.ts";
import { requireSession } from "./session.ts";
import {
  workspacePath,
  hasWebDist,
  webDist,
  openBrowser,
  availablePort,
  acquireInstanceLock,
} from "./launcher.ts";
const root = workspacePath();
await mkdir(root, { recursive: true });
await acquireInstanceLock(root);
const processRepo = new ProcessCaptureRepository(root),
  opportunityRepo = new OpportunityDiscoveryRepository(root),
  app = new Hono();
await opportunityRepo.recoverInterrupted();
app.onError((error, c) => {
  console.error(error);
  if (error instanceof ProcessCaptureNotFoundError)
    return c.json({ error: error.message }, 404);
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
app.route("/api/config", configRoutes());
app.route(
  "/api/processes",
  processCaptureRoutes(processRepo, new ClaudeProcessAiAdapter()),
);
app.route(
  "/api/opportunities",
  opportunityRoutes(
    processRepo,
    opportunityRepo,
    new ClaudeOpportunityAiAdapter(),
  ),
);
app.route("/api/ai-operations", aiOperationRoutes());
app.route("/api/events", eventRoutes());
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
console.log(`Prozessaufnahme: http://127.0.0.1:${port}`);
if (!process.env.BUN_WATCH) void openBrowser(`http://127.0.0.1:${port}`);
export default {
  port,
  hostname: "127.0.0.1",
  idleTimeout: 100,
  fetch: app.fetch,
};
