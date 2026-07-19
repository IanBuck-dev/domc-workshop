import { Hono } from "hono";
import { workshopSchema } from "../../../../packages/domain/src/schemas.ts";
import type { WorkspaceRepository } from "../../../../packages/storage/src/workspace-repository.ts";
export function settingsRoutes(ws: WorkspaceRepository) {
  const app = new Hono();
  app.get("/", async (c) => c.json(await ws.settings()));
  app.put("/", async (c) => {
    const v = workshopSchema.parse(await c.req.json());
    await ws.saveSettings(v);
    return c.json(v);
  });
  app.post("/reset", async (c) => {
    const { confirmation } = await c.req.json();
    if (confirmation !== "ZURÜCKSETZEN")
      return c.json({ error: "Bestätigung stimmt nicht" }, 400);
    return c.json({ backup: await ws.reset() });
  });
  app.get("/environment", async (c) => {
    try {
      const p = Bun.spawn(["claude", "--version"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const python = Bun.spawn(["python3", "--version"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const version = (await new Response(p.stdout).text()).trim();
      const pythonVersion = (await new Response(python.stdout).text()).trim();
      return c.json({
        available: (await p.exited) === 0,
        version,
        authenticated: "Nicht separat getestet",
        pythonAvailable: (await python.exited) === 0,
        pythonVersion,
      });
    } catch {
      return c.json({
        available: false,
        version: "Nicht gefunden",
        authenticated: "Unbekannt",
        pythonAvailable: false,
        pythonVersion: "Nicht gefunden",
      });
    }
  });
  return app;
}
