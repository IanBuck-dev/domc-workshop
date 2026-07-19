import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";
import type { WorkspaceRepository } from "../../../../packages/storage/src/workspace-repository.ts";
import type { ProcessRepository } from "../../../../packages/storage/src/process-repository.ts";
import { DiscoveryClaudeAdapter } from "../../../../packages/claude/src/discovery-adapter.ts";
import type { DiscoveryTurn } from "../../../../packages/domain/src/schemas.ts";

type DiscoveryMessage = UIMessage<unknown, { extraction: DiscoveryTurn }>;
const uploadExtensions = new Set([
  ".pdf",
  ".xlsx",
  ".csv",
  ".docx",
  ".txt",
  ".md",
  ".png",
  ".jpg",
  ".jpeg",
]);
const bodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      parts: z.array(z.record(z.string(), z.unknown())),
    }),
  ),
});

function lastUserText(body: z.infer<typeof bodySchema>) {
  const message = [...body.messages]
    .reverse()
    .find((item) => item.role === "user");
  const text = message?.parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("\n")
    .trim();
  if (!text) throw new Error("Bitte geben Sie eine Nachricht ein.");
  return text;
}

export function processInterviewError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("already in use"))
    return "Die vorherige Antwort wird noch beendet. Bitte warten Sie kurz und versuchen Sie es dann erneut.";
  if (message.includes("abort"))
    return "Die Antwort wurde abgebrochen. Sie können es erneut versuchen.";
  if (message.includes("timeout") || message.includes("timed out"))
    return "Die Antwort hat zu lange gedauert. Bitte versuchen Sie es erneut.";
  return "Die Antwort konnte nicht sicher gespeichert werden. Bitte versuchen Sie es erneut.";
}

export function processRoutes(
  repo: ProcessRepository,
  ws: WorkspaceRepository,
) {
  const app = new Hono();
  const adapter = new DiscoveryClaudeAdapter();

  app.get("/", async (c) => c.json(await repo.list()));
  app.post("/", async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const department = z
      .object({ department: z.string().max(120).optional() })
      .parse(raw).department;
    return c.json(await repo.create(await ws.settings(), department), 201);
  });
  app.get("/:id", async (c) => {
    const record = await repo.get(c.req.param("id"));
    return record ? c.json(record) : c.json({ error: "Nicht gefunden" }, 404);
  });
  app.get("/:id/history", async (c) =>
    c.json(await repo.history(c.req.param("id"))),
  );
  app.patch("/:id/department", async (c) => {
    const { department } = z
      .object({ department: z.string().trim().min(1).max(120) })
      .parse(await c.req.json());
    return c.json(await repo.updateDepartment(c.req.param("id"), department));
  });

  app.post("/:id/chat", async (c) => {
    const id = c.req.param("id");
    const record = await repo.get(id);
    if (!record) return c.json({ error: "Nicht gefunden" }, 404);
    if (record.metadata.state !== "Interview läuft")
      return c.json(
        { error: "Dieses Interview ist bereits abgeschlossen." },
        409,
      );
    let userText: string;
    try {
      userText = lastUserText(bodySchema.parse(await c.req.json()));
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : "Ungültige Nachricht",
        },
        400,
      );
    }
    const settings = await ws.settings();
    const instructions = await readFile(
      join(ws.root, "CLAUDE-discovery.md"),
      "utf8",
    );
    const stream = createUIMessageStream<DiscoveryMessage>({
      execute: async ({ writer }) => {
        const result = adapter.startTurn(
          record,
          userText,
          instructions,
          settings,
          repo.dir(id),
        );
        writer.merge(toUIMessageStream({ stream: result.fullStream }));
        const assistantText = (await result.text).trim();
        if (!assistantText)
          throw new Error("Claude hat keine Antwort geliefert.");
        if (assistantText.length > settings.discovery.maxOutputTokens * 6)
          throw new Error("Die Antwort überschreitet das sichere Limit.");
        const extraction = await adapter.extractTurn(
          record,
          userText,
          assistantText,
          settings,
          repo.dir(id),
        );
        await repo.persistTurn(id, userText, assistantText, extraction);
        writer.write({ type: "data-extraction", data: extraction });
      },
      onError: processInterviewError,
    });
    return createUIMessageStreamResponse({ stream });
  });

  app.post("/:id/upload", async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File))
      return c.json({ error: "Keine Datei ausgewählt." }, 400);
    if (file.size > 20 * 1024 * 1024)
      return c.json(
        { error: "Die Datei darf höchstens 20 MB groß sein." },
        413,
      );
    if (!uploadExtensions.has(extname(file.name).toLowerCase()))
      return c.json({ error: "Dieser Dateityp wird nicht unterstützt." }, 415);
    const name = await repo.saveUpload(
      c.req.param("id"),
      file.name,
      new Uint8Array(await file.arrayBuffer()),
    );
    return c.json({ name });
  });

  app.post("/:id/finish", async (c) =>
    c.json(await repo.finish(c.req.param("id"))),
  );
  app.post("/:id/pdd", async (c) => {
    const id = c.req.param("id");
    const record = await repo.get(id);
    if (!record) return c.json({ error: "Nicht gefunden" }, 404);
    if (record.metadata.state !== "Interview abgeschlossen")
      return c.json({ error: "Schließen Sie zuerst das Interview ab." }, 409);
    const settings = await ws.settings();
    const template = await readFile(
      join(ws.root, "templates", "pdd.md"),
      "utf8",
    );
    const pdd = await adapter.generatePdd(
      record,
      template,
      settings,
      repo.dir(id),
    );
    return c.json(await repo.savePdd(id, pdd));
  });
  app.put("/:id/pdd", async (c) => {
    const body = z
      .object({ pdd: z.string().min(1), changeNote: z.string().min(3) })
      .parse(await c.req.json());
    return c.json(
      await repo.savePdd(c.req.param("id"), body.pdd, true, body.changeNote),
    );
  });
  app.get("/:id/export", async (c) => {
    const record = await repo.get(c.req.param("id"));
    if (!record) return c.json({ error: "Nicht gefunden" }, 404);
    if (!record.pdd.trim())
      return c.json({ error: "Noch kein PDD vorhanden." }, 409);
    return new Response(record.pdd, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${record.metadata.id}-PDD.md"`,
      },
    });
  });
  return app;
}
