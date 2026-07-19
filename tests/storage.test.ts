import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceRepository } from "../packages/storage/src/workspace-repository";
import { MarkdownIdeaRepository } from "../packages/storage/src/markdown-idea-repository";
import { ProcessRepository } from "../packages/storage/src/process-repository";
let root = "";
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});
describe("workspace", () => {
  test("seeds and round-trips markdown records", async () => {
    root = await mkdtemp(join(tmpdir(), "claims-"));
    const ws = new WorkspaceRepository(root);
    await ws.ensure();
    const repo = new MarkdownIdeaRepository(root);
    expect((await repo.list()).length).toBe(12);
    const idea = (await repo.get("IDEA-0001"))!;
    idea.title = "Geändert";
    await repo.save(idea);
    expect((await repo.get(idea.id))?.title).toBe("Geändert");
    expect(await readFile(join(root, "ideas", idea.id, "raw.md"), "utf8")).toBe(
      idea.raw,
    );
  });
  test("reset backs up and restores defaults", async () => {
    root = await mkdtemp(join(tmpdir(), "claims-"));
    const ws = new WorkspaceRepository(root);
    await ws.ensure();
    const repo = new MarkdownIdeaRepository(root);
    const i = (await repo.get("IDEA-0001"))!;
    i.title = "X";
    await repo.save(i);
    const backup = await ws.reset();
    expect((await repo.get(i.id))?.title).not.toBe("X");
    expect(backup).toContain("backups");
  });
  test("migrates settings created by an older prototype version", async () => {
    root = await mkdtemp(join(tmpdir(), "claims-"));
    const ws = new WorkspaceRepository(root);
    await ws.ensure();
    await writeFile(
      join(root, "workshop.yaml"),
      `workshopTitle: Alt\nworkshopSubtitle: Bestand\nmodel: opus\nmodelDisplay: Claude Opus\neffort: medium\nimpactThreshold: 5.5\neffortThreshold: 5.5\nmodels:\n  - label: Claude Opus\n    value: opus\n`,
    );

    const settings = await ws.settings();

    expect(settings.workshopTitle).toBe("Alt");
    expect(settings.scoringGuidance.length).toBeGreaterThan(0);
    expect(settings.weights.businessImpact).toBe(1);
    expect(await readFile(join(root, "workshop.yaml"), "utf8")).toContain(
      "scoringGuidance",
    );
  });
  test("persists process turns atomically and reset leaves processes untouched", async () => {
    root = await mkdtemp(join(tmpdir(), "claims-"));
    const ws = new WorkspaceRepository(root);
    await ws.ensure();
    const processes = new ProcessRepository(root);
    const created = await processes.create(await ws.settings(), "Leistung");
    await processes.persistTurn(
      created.metadata.id,
      "E-Mails müssen gelesen werden.",
      "Was passiert danach?",
      {
        extractionDelta: {
          processName: "Posteingang",
          department: "Leistung",
          painPoints: ["Viel Lesezeit"],
        },
        criteriaCoverage: 1,
        openPoints: ["Nächster Schritt"],
        interviewComplete: false,
      },
    );
    await ws.reset();
    const stored = await processes.get(created.metadata.id);
    expect(stored?.extraction.processName).toBe("Posteingang");
    expect(stored?.transcript.at(-1)?.text).toBe("Was passiert danach?");
    expect(stored?.metadata.sessionStarted).toBe(true);
  });
  test("updates a process department in metadata, extraction, and history", async () => {
    root = await mkdtemp(join(tmpdir(), "claims-"));
    const ws = new WorkspaceRepository(root);
    await ws.ensure();
    const processes = new ProcessRepository(root);
    const created = await processes.create(await ws.settings());

    const updated = await processes.updateDepartment(
      created.metadata.id,
      "Underwriting",
    );

    expect(updated.metadata.department).toBe("Underwriting");
    expect(updated.extraction.department).toBe("Underwriting");
    expect((await processes.history(created.metadata.id))[0].event).toBe(
      "department-updated",
    );
  });
});
