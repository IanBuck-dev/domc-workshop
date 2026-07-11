import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceRepository } from "../packages/storage/src/workspace-repository";
import { MarkdownIdeaRepository } from "../packages/storage/src/markdown-idea-repository";
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
});
