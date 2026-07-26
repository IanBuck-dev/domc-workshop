import { afterEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ZodError } from "zod";
import { configRoutes } from "../apps/server/src/routes/config.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "process-config-api-"));
  roots.push(root);
  await mkdir(join(root, "prompts"), { recursive: true });
  await Promise.all([
    writeFile(
      join(root, "prompts", "process-base.md"),
      "# Globale Basis-Anweisung",
    ),
    writeFile(
      join(root, "prompts", "process-follow-ups.md"),
      "# Feste Rückfragen-Anweisung",
    ),
    writeFile(
      join(root, "prompts", "process-synthesis.md"),
      "# Feste Prozessbild-Anweisung",
    ),
  ]);
  const app = new Hono();
  app.onError((error, c) =>
    c.json(
      { error: "Ungültige Vorschau-Anfrage." },
      error instanceof ZodError ? 400 : 500,
    ),
  );
  app.route("/api/config", configRoutes(root));
  return { app, root };
}

describe("instruction preview API", () => {
  test("returns both complete effective instructions without writing files", async () => {
    const { app, root } = await fixture();
    const before = await readdir(join(root, "prompts"));
    const response = await app.request("/api/config/instruction-preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        instructions: {
          followUps: "Aktueller Zusatz für Rückfragen.",
          synthesis: "Aktueller Zusatz für das Prozessbild.",
        },
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      base: "# Globale Basis-Anweisung",
      followUps:
        "# Feste Rückfragen-Anweisung\n\n## Konfigurierbare Anweisung\nAktueller Zusatz für Rückfragen.",
      synthesis:
        "# Feste Prozessbild-Anweisung\n\n## Konfigurierbare Anweisung\nAktueller Zusatz für das Prozessbild.",
    });
    expect(await readdir(join(root, "prompts"))).toEqual(before);
  });

  test("rejects missing and empty configurable instructions", async () => {
    const { app } = await fixture();
    for (const instructions of [
      { followUps: "", synthesis: "Prozessbild" },
      { followUps: "Rückfragen" },
    ]) {
      const response = await app.request("/api/config/instruction-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instructions }),
      });
      expect(response.status).toBe(400);
    }
  });
});
