import { Hono } from "hono";
import type { ProcessCaptureRepository } from "../../../../packages/storage/src/process-capture-repository.ts";
import { PddExportRepository } from "../../../../packages/storage/src/pdd-export-repository.ts";
import { authenticatedUser } from "../session.ts";

function disposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** Download only: PDD workbooks are immutable derived artifacts, never imports. */
export function pddExportRoutes(
  processes: ProcessCaptureRepository,
  exports: PddExportRepository,
) {
  const app = new Hono();
  app.post("/:id/pdd-export", async (c) => {
    const record = await processes.get(c.req.param("id"));
    if (!record) return c.json({ error: "Prozess nicht gefunden." }, 404);
    if (
      record.state !== "confirmed" ||
      !record.understanding ||
      !record.confirmedAt
    )
      return c.json(
        {
          error:
            "Bitte bestätigen Sie zuerst das Prozessbild. Danach kann die Excel-Arbeitsmappe erstellt werden.",
        },
        409,
      );
    try {
      const { detail, bytes } = await exports.export(record, {
        initiatedBy: authenticatedUser(c) ?? "unknown",
      });
      const body = new Uint8Array(new ArrayBuffer(bytes.byteLength));
      body.set(bytes);
      return new Response(body.buffer, {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": disposition(detail.filename),
          "Content-Length": String(bytes.byteLength),
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "X-Content-Type-Options": "nosniff",
          "X-PDD-Source-Revision": detail.sourceRevision,
        },
      });
    } catch (error) {
      console.error("[pdd-export] export failed", error);
      return c.json(
        {
          error:
            "Die Excel-Arbeitsmappe konnte nicht erstellt werden. Ihre Prozessaufnahme bleibt unverändert.",
        },
        500,
      );
    }
  });
  return app;
}
