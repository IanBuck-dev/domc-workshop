import { afterEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildCatalog,
  computeSourceRevision,
  parseCorpusMarkdown,
  renderIndex,
  renderProcess,
  slug,
  type CorpusSource,
} from "../packages/corpus/src/index.ts";
import { CorpusGit } from "../packages/storage/src/corpus-git.ts";
import { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";
import { CorpusService } from "../apps/server/src/corpus-service.ts";
import { corpusRoutes } from "../apps/server/src/routes/corpus.ts";
import { cover, processConfig, understanding } from "./process-fixtures.ts";
import { answers, workCharacteristicAnswers } from "./process-fixtures.ts";

/**
 * Die git-gestützten Fälle starten je Schritt einen eigenen `git`-Prozess. Einzeln
 * laufen sie in gut einer Sekunde, unter der vollen, parallel laufenden Suite
 * reicht das Standardbudget von fünf Sekunden aber nicht aus.
 */
const gitTimeout = 30_000;

const roots: string[] = [];
afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);
function source(id = "PROC-0001"): CorpusSource {
  return {
    id,
    cover: { processName: "Kündigung prüfen", department: "Leistungsprüfung" },
    understanding: understanding(),
    confirmedAt: "2026-08-09T10:00:00.000Z",
    confirmationQuality: "with_gaps",
  };
}

describe("Dokumentationskorpus", () => {
  test("entspricht der Golden-Datei für jedes veröffentlichbare Demo-Szenario", async () => {
    const golden = new Map(
      (await readFile("tests/golden/corpus.sha256", "utf8"))
        .trim()
        .split("\n")
        .map((line) => line.split(/\s+/, 2) as [string, string]),
    );
    const scenarioRoot = "demo-data/szenarien";
    const publishable: string[] = [];
    for (const slug of await readdir(scenarioRoot)) {
      const understandingPath = join(scenarioRoot, slug, "verstaendnis.json");
      const rawUnderstanding = await readFile(understandingPath, "utf8").catch(
        () => null,
      );
      if (!rawUnderstanding) continue;
      publishable.push(slug);
      const scenario = JSON.parse(
        await readFile(join(scenarioRoot, slug, "szenario.json"), "utf8"),
      ) as { cover: { processName: string; department: string } };
      const understandingValue = JSON.parse(rawUnderstanding) as ReturnType<
        typeof understanding
      >;
      const markdown = renderProcess({
        id: "PROC-0001",
        cover: scenario.cover,
        understanding: understandingValue,
        confirmedAt: "2026-08-09T10:00:00.000Z",
        confirmationQuality:
          understandingValue.knowledgeGaps.length ||
          understandingValue.conflicts.length
            ? "with_gaps"
            : "complete",
      }).markdown;
      const expected = golden.get(slug);
      if (!expected) throw new Error(`Golden-Wert für ${slug} fehlt.`);
      expect(createHash("sha256").update(markdown).digest("hex")).toBe(
        expected,
      );
    }
    expect([...golden.keys()].sort()).toEqual(publishable.sort());
  });

  test("rendert eine byte-identische, validierte Prozessdatei", () => {
    const input = source();
    const first = renderProcess(input);
    const second = renderProcess(input);
    expect(first.markdown).toBe(second.markdown);
    expect(first.frontmatter.quell_revision).toBe(computeSourceRevision(input));
    expect(parseCorpusMarkdown(first.markdown)).toEqual(first.frontmatter);
    expect(first.markdown).toContain("## Offene Fragen und Widersprüche");
    expect(first.markdown).toContain("- ai_structured:");
  });

  test("transliteriert Slugs und trennt gleichlautende Prozessidentitäten", () => {
    expect(slug("Schäden & Rückläufer")).toBe("schaeden-ruecklaeufer");
    const first = source("PROC-0001");
    const second = {
      ...source("PROC-0002"),
      cover: {
        processName: first.cover.processName,
        department: first.cover.department,
      },
    };
    const catalog = buildCatalog([first, second]);
    expect(catalog.map((item) => item.slug)).toEqual([
      "leistungspruefung/kuendigung-pruefen--proc-0001",
      "leistungspruefung/kuendigung-pruefen--proc-0002",
    ]);
    expect(renderIndex(catalog)).toContain("PROC-0002");
  });

  test(
    "liest und schreibt das eingebettete Git-Repo ohne Argument-Injection",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "corpus-git-"));
      roots.push(root);
      const git = new CorpusGit(root);
      await git.ensureRepo();
      await git.write("prozesse/vertrieb/test.md", "erste Fassung\n");
      const first = await git.commit(
        ["prozesse/vertrieb/test.md"],
        `Dokumentation aktualisiert: Test\n\nAnlass: bestaetigung\nProzess: PROC-0001\nQuell-Revision: ${"a".repeat(64)}\n`,
      );
      expect(first).toMatch(/^[a-f0-9]{40}$/);
      expect(await git.tree("HEAD", "prozesse")).toEqual([
        expect.objectContaining({ name: "vertrieb", type: "tree" }),
      ]);
      expect(await git.show("HEAD", "prozesse/vertrieb/test.md")).toBe(
        "erste Fassung\n",
      );
      await git.write("prozesse/vertrieb/test.md", "zweite Fassung\n");
      const second = await git.commit(
        ["prozesse/vertrieb/test.md"],
        `Dokumentation aktualisiert: Test\n\nAnlass: bestaetigung\nProzess: PROC-0001\nQuell-Revision: ${"b".repeat(64)}\n`,
      );
      expect(
        await git.diff(first!, second!, "prozesse/vertrieb/test.md"),
      ).toContain("-erste Fassung");
      expect((await git.log(10, 0))[0]).toMatchObject({
        anlass: "bestaetigung",
        prozessId: "PROC-0001",
        dateien: [{ status: "M", path: "prozesse/vertrieb/test.md" }],
      });
      expect(await git.log(10, 0)).toHaveLength(2);
      await git.revert(
        second!,
        `Dokumentation aktualisiert: Test\n\nAnlass: ruecknahme\nProzess: PROC-0001\nQuell-Revision: ${"b".repeat(64)}\n`,
      );
      expect(await git.show("HEAD", "prozesse/vertrieb/test.md")).toBe(
        "erste Fassung\n",
      );
      expect((await git.log(1, 0))[0]?.anlass).toBe("ruecknahme");
      await expect(git.show("HEAD", "../metadata.yaml")).rejects.toThrow(
        "Ungültiger Dokumentationspfad",
      );
      await expect(git.diff("--output=/tmp/x", "HEAD")).rejects.toThrow(
        "Ungültige Revision",
      );
    },
    gitTimeout,
  );

  test(
    "initialisiert immer ein eigenes Repo und folgt Dateiumbenennungen",
    async () => {
      const parent = await mkdtemp(join(tmpdir(), "corpus-parent-"));
      roots.push(parent);
      await new CorpusGit(parent).ensureRepo();
      const root = join(parent, "workspace", "docs");
      const git = new CorpusGit(root);
      await git.ensureRepo();
      expect((await stat(join(root, ".git"))).isDirectory()).toBe(true);

      const oldPath = "prozesse/leistung/kuendigung.md";
      const newPath = "prozesse/leistung/kuendigung-pruefen.md";
      await git.write(oldPath, "Fassung\n");
      await git.commit(
        [oldPath],
        `Dokumentation aktualisiert: Kündigung\n\nAnlass: bestaetigung\nProzess: PROC-0001\nQuell-Revision: ${"a".repeat(64)}\n`,
      );
      await git.stageRemoval(oldPath);
      await git.write(newPath, "Fassung\n");
      await git.commit(
        [oldPath, newPath],
        `Dokumentation aktualisiert: Kündigung prüfen\n\nAnlass: bestaetigung\nProzess: PROC-0001\nQuell-Revision: ${"b".repeat(64)}\n`,
      );
      const history = await git.log(10, 0, newPath);
      expect(history).toHaveLength(2);
      expect(history[0]?.dateien[0]).toMatchObject({
        status: "R100",
        path: newPath,
      });
    },
    gitTimeout,
  );

  test(
    "meldet Sync-Fehler ohne die Aufnahme zu blockieren und verhindert Dubletten",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "corpus-service-"));
      roots.push(root);
      const repo = new ProcessCaptureRepository(root);
      const config = await processConfig();
      await repo.create(cover, config);
      await expect(
        repo.create(
          { ...cover, processName: ` ${cover.processName} ` },
          config,
        ),
      ).rejects.toThrow("aktiver Prozess");
      const service = new CorpusService(repo, root);
      expect(await service.similarProcesses("Fiktiver Prozess")).toEqual([
        expect.objectContaining({ id: "PROC-0001" }),
      ]);
      expect(await service.syncProcess("PROC-0001")).toMatchObject({
        result: "error",
      });
      expect(await service.reconcileCorpus()).toEqual({
        aktualisiert: 0,
        entfernt: 0,
        unveraendert: 0,
        fehler: 0,
      });
    },
    gitTimeout,
  );

  test(
    "synchronisiert eine Bestätigung einmal und rendert sie beim Wiederholen nicht erneut",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "corpus-sync-"));
      roots.push(root);
      const repo = new ProcessCaptureRepository(root);
      const record = await repo.create(cover, await processConfig());
      await repo.saveMainAnswers(
        record.id,
        answers(),
        workCharacteristicAnswers(),
        [],
      );
      await repo.saveValidationRun(
        record.id,
        {
          mainAnswers: answers(),
          workCharacteristicAnswers: workCharacteristicAnswers(),
          selectedUploadIds: [],
        },
        [],
        [],
        {
          operationId: crypto.randomUUID(),
          sessionId: crypto.randomUUID(),
          model: "claude-opus-4-8",
          durationMs: 1,
          inputTokens: 1,
          outputTokens: 1,
        },
      );
      await repo.saveUnderstanding(record.id, understanding(), {
        operationId: crypto.randomUUID(),
        sessionId: crypto.randomUUID(),
        model: "claude-opus-4-8",
        durationMs: 1,
        inputTokens: 1,
        outputTokens: 1,
      });
      await repo.confirm(record.id);
      const service = new CorpusService(repo, root);
      const firstSync = await service.syncProcess(record.id);
      expect(firstSync).toMatchObject({
        result: "updated",
      });
      expect(await service.syncProcess(record.id)).toEqual({
        result: "noop",
        commit: null,
      });
      expect(await service.git.tree("HEAD", "prozesse")).toHaveLength(1);
      expect((await repo.history(record.id))[0]?.event).toBe(
        "documentation-synced",
      );

      const confirmed = await repo.required(record.id);
      const source = {
        id: confirmed.id,
        cover: {
          processName: confirmed.cover.processName,
          department: confirmed.cover.department,
        },
        understanding: confirmed.understanding!,
        confirmedAt: confirmed.confirmedAt!,
        confirmationQuality: confirmed.confirmationQuality!,
      } satisfies CorpusSource;
      const path = renderProcess(source).path;
      await rm(join(root, "docs", path));
      const app = new Hono().route("/api/corpus", corpusRoutes(service));
      expect(
        await (
          await app.request("/api/corpus/reconcile", { method: "POST" })
        ).json(),
      ).toMatchObject({ aktualisiert: 1 });
      expect(await service.git.workingFile(path)).toBe(
        renderProcess(source).markdown,
      );
      expect(
        await (await app.request("/api/corpus/tree?path=prozesse")).json(),
      ).toEqual([expect.objectContaining({ name: "vertrieb", type: "tree" })]);
      expect(
        await (
          await app.request(`/api/corpus/file?path=${encodeURIComponent(path)}`)
        ).text(),
      ).toContain(`# ${confirmed.cover.processName}`);
      const history = (await (
        await app.request("/api/corpus/log?limit=10&skip=0")
      ).json()) as Array<{ sha: string; prozessId: string | null }>;
      expect(history).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ prozessId: record.id }),
        ]),
      );
      const revision = history[0]!.sha;
      expect(
        await (
          await app.request(`/api/corpus/diff?from=${revision}&to=${revision}`)
        ).text(),
      ).toBe("");
      const invalid = await (
        await app.request("/api/corpus/tree?rev=--help")
      ).json();
      expect(invalid).toEqual({
        error: "Die Anfrage enthält ungültige Angaben.",
        code: "invalid_corpus_request",
      });
      const missing = await app.request(
        "/api/corpus/file?path=prozesse/nicht-vorhanden.md",
      );
      expect(missing.status).toBe(404);
      expect(await missing.json()).toEqual({
        error: "Die angeforderte Revision oder Datei wurde nicht gefunden.",
        code: "corpus_not_found",
      });
      if (firstSync.result !== "updated")
        throw new Error("Sync fehlgeschlagen");
      expect(
        await (
          await app.request(`/api/corpus/revert/${firstSync.commit}`, {
            method: "POST",
          })
        ).json(),
      ).toEqual({ commit: expect.stringMatching(/^[a-f0-9]{40}$/) });
    },
    gitTimeout,
  );

  test("meldet ein fehlendes Git als Operationsfehler", async () => {
    const root = await mkdtemp(join(tmpdir(), "corpus-no-git-"));
    roots.push(root);
    await expect(
      new CorpusGit(root, "git-gibt-es-nicht").ensureRepo(),
    ).rejects.toThrow("Git ist auf diesem System nicht verfügbar");
  });

  test(
    "repariert einen veralteten Katalogpfad ohne dauerhaften Git-Fehler",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "corpus-stale-catalog-"));
      roots.push(root);
      const repo = new ProcessCaptureRepository(root);
      const record = await repo.create(cover, await processConfig());
      await repo.saveMainAnswers(
        record.id,
        answers(),
        workCharacteristicAnswers(),
        [],
      );
      await repo.saveValidationRun(
        record.id,
        {
          mainAnswers: answers(),
          workCharacteristicAnswers: workCharacteristicAnswers(),
          selectedUploadIds: [],
        },
        [],
        [],
        {
          operationId: crypto.randomUUID(),
          sessionId: crypto.randomUUID(),
          model: "claude-opus-4-8",
          durationMs: 1,
          inputTokens: 1,
          outputTokens: 1,
        },
      );
      await repo.saveUnderstanding(record.id, understanding(), {
        operationId: crypto.randomUUID(),
        sessionId: crypto.randomUUID(),
        model: "claude-opus-4-8",
        durationMs: 1,
        inputTokens: 1,
        outputTokens: 1,
      });
      await repo.confirm(record.id);
      const service = new CorpusService(repo, root);
      expect((await service.syncProcess(record.id)).result).toBe("updated");

      const catalog = JSON.parse(
        (await service.git.workingFile("katalog.json"))!,
      ) as Array<{ slug: string }>;
      catalog[0]!.slug = "veraltet/nicht-vorhanden";
      await service.git.write(
        "katalog.json",
        `${JSON.stringify(catalog, null, 2)}\n`,
      );
      await service.git.commit(
        ["katalog.json"],
        `Dokumentation aktualisiert: Test\n\nAnlass: reconciliation\n`,
      );

      expect(await service.syncProcess(record.id)).toMatchObject({
        result: "updated",
      });
    },
    gitTimeout,
  );
});
