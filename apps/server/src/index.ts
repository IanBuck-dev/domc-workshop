import { Hono } from "hono";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { WorkspaceRepository } from "../../../packages/storage/src/workspace-repository.ts";
import { MarkdownIdeaRepository } from "../../../packages/storage/src/markdown-idea-repository.ts";
import { ideaRoutes } from "./routes/ideas.ts";
import { settingsRoutes } from "./routes/settings.ts";
import { claudeRoutes } from "./routes/claude.ts";
import { exportRoutes } from "./routes/exports.ts";
import { processRoutes } from "./routes/processes.ts";
import { ProcessRepository } from "../../../packages/storage/src/process-repository.ts";
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
const repo = new MarkdownIdeaRepository(root),
  processRepo = new ProcessRepository(root),
  app = new Hono();
app.onError((error, c) => {
  console.error(error);
  return c.json(
    { error: error instanceof Error ? error.message : "Interner Fehler" },
    500,
  );
});
app.route("/api/ideas", ideaRoutes(repo));
app.route("/api/settings", settingsRoutes(ws));
app.route("/api/claude", claudeRoutes(repo, ws));
app.route("/api/exports", exportRoutes(repo, root));
app.route("/api/processes", processRoutes(processRepo, ws));
const instanceId = `${process.pid}-${Date.now()}`;
app.get("/api/health", (c) => c.json({ ok: true, instanceId }));
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
console.log(`Claims-Ideenportfolio: http://127.0.0.1:${port}`);
if (!process.env.BUN_WATCH) void openBrowser(`http://127.0.0.1:${port}`);
export default {
  port,
  hostname: "127.0.0.1",
  idleTimeout: 100,
  fetch: app.fetch,
};
