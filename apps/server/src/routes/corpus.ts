import { Hono } from "hono";
import { z } from "zod";
import {
  catalogSchema,
  corpusIndexSchema,
  parseCorpusMarkdown,
} from "../../../../packages/corpus/src/index.ts";
import type { CorpusService } from "../corpus-service.ts";
import { runGlobalOperation } from "../process-operation-manager.ts";
import {
  isCorpusRevertConflict,
  isMissingCorpusObject,
} from "../../../../packages/storage/src/corpus-git.ts";

const revisionSchema = z
  .string()
  .regex(/^(?:HEAD|[a-f0-9]{40}|[a-f0-9]{64})$/)
  .default("HEAD");
const commitSchema = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
const pathSchema = z.string().max(500).default("");
const limitSchema = z.coerce.number().int().min(1).max(100).default(30);
const skipSchema = z.coerce.number().int().min(0).max(10_000).default(0);

function error(
  c: {
    json: (
      body: { error: string; code: string },
      status: 400 | 404 | 409 | 500 | 503,
    ) => Response;
  },
  value: unknown,
) {
  const missing = isMissingCorpusObject(value);
  const conflict = isCorpusRevertConflict(value);
  const message = missing
    ? "Die angeforderte Revision oder Datei wurde nicht gefunden."
    : conflict
      ? "Die Änderung kann wegen eines Konflikts nicht zurückgenommen werden."
      : value instanceof z.ZodError
        ? "Die Anfrage enthält ungültige Angaben."
        : value instanceof Error
          ? value.message
          : "Die Dokumentation konnte nicht verarbeitet werden.";
  const status = missing
    ? 404
    : conflict
      ? 409
      : value instanceof z.ZodError || /Ungültig|required/i.test(message)
        ? 400
        : /nicht verfügbar/i.test(message)
          ? 503
          : /nicht gefunden|enthält noch keine|does not exist/i.test(message)
            ? 404
            : /Konflikt|rückgängig|bereits/i.test(message)
              ? 409
              : 500;
  return c.json(
    {
      error: message,
      code:
        status === 400
          ? "invalid_corpus_request"
          : status === 404
            ? "corpus_not_found"
            : status === 409
              ? "corpus_conflict"
              : status === 503
                ? "corpus_unavailable"
                : "corpus_error",
    },
    status,
  );
}

export function corpusRoutes(service: CorpusService) {
  const app = new Hono();
  app.get("/tree", async (c) => {
    try {
      const rev = revisionSchema.parse(c.req.query("rev") ?? "HEAD");
      const path = pathSchema.parse(c.req.query("path") ?? "");
      await service.initialize();
      return c.json(await service.git.tree(rev, path));
    } catch (value) {
      return error(c, value);
    }
  });
  app.get("/file", async (c) => {
    try {
      const rev = revisionSchema.parse(c.req.query("rev") ?? "HEAD");
      const path = pathSchema.parse(c.req.query("path") ?? "");
      await service.initialize();
      const content = await service.git.show(rev, path);
      if (path.endsWith(".md") && path !== "index.md")
        parseCorpusMarkdown(content);
      if (path === "katalog.json") catalogSchema.parse(JSON.parse(content));
      if (path === "index.md") corpusIndexSchema.parse(content);
      return c.text(content, 200, {
        "Content-Type": "text/plain; charset=utf-8",
      });
    } catch (value) {
      return error(c, value);
    }
  });
  app.get("/log", async (c) => {
    try {
      const limit = limitSchema.parse(c.req.query("limit") ?? 30);
      const skip = skipSchema.parse(c.req.query("skip") ?? 0);
      const path = c.req.query("path");
      if (path !== undefined) pathSchema.parse(path);
      await service.initialize();
      return c.json(await service.git.log(limit, skip, path));
    } catch (value) {
      return error(c, value);
    }
  });
  app.get("/diff", async (c) => {
    try {
      const from = commitSchema.parse(c.req.query("from"));
      const to = commitSchema.parse(c.req.query("to"));
      const path = c.req.query("path");
      if (path !== undefined) pathSchema.parse(path);
      await service.initialize();
      return c.text(await service.git.diff(from, to, path), 200, {
        "Content-Type": "text/plain; charset=utf-8",
      });
    } catch (value) {
      return error(c, value);
    }
  });
  app.post("/reconcile", async (c) => {
    try {
      await service.initialize();
      return c.json(await runGlobalOperation(() => service.reconcileCorpus()));
    } catch (value) {
      return error(c, value);
    }
  });
  app.post("/revert/:commit", async (c) => {
    try {
      return c.json(
        await service.revert(commitSchema.parse(c.req.param("commit"))),
      );
    } catch (value) {
      return error(c, value);
    }
  });
  return app;
}
