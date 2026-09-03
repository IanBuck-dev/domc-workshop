import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { listDemoScenarios } from "../apps/server/src/demo-scenarios.ts";
import { ChatCaptureRepository } from "../packages/storage/src/chat-capture-repository.ts";
import { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";
import { listDocumentationFixtures } from "../scripts/documentation-fixtures.ts";
import { loadShowcasePortfolio } from "../scripts/showcase-portfolio.ts";

describe("LifeCorp showcase seed", () => {
  test("the canonical portfolio matches every fixture and owning team", async () => {
    const portfolio = await loadShowcasePortfolio();
    const documentation = await listDocumentationFixtures();
    const scenarios = await listDemoScenarios();
    const organization = await readFile(
      join(process.cwd(), "demo-data", "ORGANISATION.md"),
      "utf8",
    );

    expect(portfolio.processes).toHaveLength(18);
    expect(
      portfolio.processes.filter(
        (process) => process.targetState === "confirmed",
      ),
    ).toHaveLength(14);
    expect(
      portfolio.processes.filter((process) => process.depth === "end_to_end"),
    ).toHaveLength(1);
    expect(
      portfolio.processes.filter((process) => process.depth === "detailed"),
    ).toHaveLength(5);
    expect(
      portfolio.processes.filter((process) => process.depth === "compact"),
    ).toHaveLength(12);
    expect(
      portfolio.processes.filter((process) => process.potential === "high"),
    ).toHaveLength(8);
    expect(
      portfolio.processes.filter((process) => process.potential === "medium"),
    ).toHaveLength(8);
    expect(
      portfolio.processes.filter((process) => process.potential === "low"),
    ).toHaveLength(2);
    expect(
      new Set(portfolio.processes.map((process) => process.department)),
    ).toEqual(new Set(["Schaden", "Vertrag", "Vertrieb", "Finanzen", "IT"]));

    const documentationBySlug = new Map(
      documentation.map((fixture) => [fixture.slug, fixture]),
    );
    const scenariosBySlug = new Map(
      scenarios.map((scenario) => [scenario.slug, scenario]),
    );
    for (const process of portfolio.processes) {
      expect(organization).toContain(`| ${process.owningTeam}`);
      if (process.fixtureSource === "documentation") {
        const fixture = documentationBySlug.get(process.slug);
        expect(fixture?.titel).toBe(process.title);
        expect(fixture?.fachbereich).toBe(process.department);
        expect(fixture?.schritte).toHaveLength(process.steps);
      } else {
        const scenario = scenariosBySlug.get(process.slug);
        expect(scenario?.titel).toBe(process.title);
        expect(scenario?.cover.department).toBe(process.department);
        if (process.targetState === "confirmed")
          throw new Error(
            `Der bestätigte Prozess „${process.title}" braucht ein Dokumentations-Fixture.`,
          );
        expect(scenario?.showcase?.state).toBe(process.targetState);
      }
    }
    expect(documentation).toHaveLength(
      portfolio.processes.filter(
        (process) => process.fixtureSource === "documentation",
      ).length,
    );
    expect(
      scenarios.filter((scenario) => scenario.showcase !== undefined),
    ).toHaveLength(
      portfolio.processes.filter(
        (process) => process.fixtureSource === "scenario",
      ).length,
    );
  });

  test("creates 14 confirmed processes and four usable continuation states", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "lifecorp-showcase-"));
    const root = resolve(import.meta.dir, "..");
    try {
      const child = Bun.spawn(
        [process.execPath, "run", "scripts/seed-showcase.ts"],
        {
          cwd: root,
          env: {
            ...process.env,
            WORKSPACE_PATH: workspace,
            CLAIMS_AI_DEFAULTS_DIR: join(root, "defaults"),
          },
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      if (exitCode !== 0)
        throw new Error(`Showcase-Seed fehlgeschlagen:\n${stdout}\n${stderr}`);

      const portfolio = await loadShowcasePortfolio();
      const records = await new ProcessCaptureRepository(workspace).list();
      const chats = new ChatCaptureRepository(workspace);
      expect(records).toHaveLength(18);
      const byTitle = new Map(
        records.map((record) => [record.cover.processName, record]),
      );

      for (const process of portfolio.processes) {
        const record = byTitle.get(process.title);
        expect(record?.cover.department).toBe(process.department);
        if (process.targetState === "confirmed") {
          expect(record?.state).toBe("confirmed");
          expect(record?.understanding?.steps).toHaveLength(process.steps);
          continue;
        }
        if (process.targetState === "review_required") {
          expect(record?.state).toBe("review_required");
          expect(record?.understanding?.steps).toHaveLength(process.steps);
          continue;
        }
        expect(record?.state).toBe("capture_in_progress");
      }

      const uploadsReady = byTitle.get("SCH-03 · Kfz-Glasschaden regulieren")!;
      expect(uploadsReady.uploads).toHaveLength(3);
      expect((await chats.state(uploadsReady.id)).documentGate).toBe("pending");

      const inProgress = byTitle.get(
        "SCH-04 · Einbruchdiebstahl in der Hausratversicherung regulieren",
      )!;
      const inProgressState = await chats.state(inProgress.id);
      expect(inProgressState.documentGate).toBe("documents_selected");
      expect(inProgressState.selectedUploadIds).toHaveLength(1);
      expect(
        (await chats.transcript(inProgress.id)).filter(
          (event) => event.role === "user",
        ),
      ).toHaveLength(2);

      const notStarted = byTitle.get(
        "VTR-02 · Provisionsabrechnung Außendienst",
      )!;
      expect(notStarted.uploads).toHaveLength(0);
      expect((await chats.state(notStarted.id)).documentGate).toBe("pending");
      expect(await chats.transcript(notStarted.id)).toHaveLength(1);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }, 30_000);
});
