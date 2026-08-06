import { Hono } from "hono";
import {
  DemoDocumentNotFoundError,
  DemoScenarioNotFoundError,
  listDemoScenarios,
  readDemoDocument,
} from "../demo-scenarios.ts";

export function demoRoutes() {
  const app = new Hono();
  app.get("/szenarien", async (c) => {
    try {
      const szenarien = await listDemoScenarios();
      return c.json({ szenarien });
    } catch (error) {
      console.error(error);
      return c.json(
        { error: "Die Demo-Szenarien konnten nicht geladen werden." },
        500,
      );
    }
  });
  app.get("/szenarien/:slug/dateien/:zielname", async (c) => {
    const { slug, zielname } = c.req.param();
    try {
      const { bytes, contentType, dateiname } = await readDemoDocument(
        slug,
        zielname,
      );
      c.header("Content-Type", contentType);
      c.header(
        "Content-Disposition",
        `inline; filename="${dateiname.replace(/"/g, "")}"`,
      );
      return c.body(bytes);
    } catch (error) {
      if (
        error instanceof DemoScenarioNotFoundError ||
        error instanceof DemoDocumentNotFoundError
      )
        return c.json({ error: error.message }, 404);
      console.error(error);
      return c.json(
        { error: "Die Datei konnte nicht bereitgestellt werden." },
        500,
      );
    }
  });
  return app;
}
