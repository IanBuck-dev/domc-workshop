import { describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { validateProcessFlow } from "../packages/domain/src/process-understanding.ts";
import { AgenticPotentialAssessmentRepository } from "../packages/storage/src/agentic-potential-assessment-repository.ts";
import { OpportunityDiscoveryRepository } from "../packages/storage/src/opportunity-discovery-repository.ts";
import { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";
import {
  expandUnderstanding,
  inhaltAt,
  listDocumentationFixtures,
  type DocumentationFixture,
} from "../scripts/documentation-fixtures.ts";

const fixtures = await listDocumentationFixtures();

/**
 * Die Seeddaten der lebenden Dokumentation werden nicht von Hand als
 * `ProcessUnderstanding` geschrieben, sondern aus einer kompakten Fassung
 * expandiert. Der Test hält fest, dass jede Fassung — Ausgangsstand wie jede
 * Revision — dieselbe Prüfung besteht wie ein echtes Syntheseergebnis.
 */
describe("Seeddaten der Prozessdokumentation", () => {
  test("liefert Fixtures über mehrere Fachbereiche", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(6);
    const fachbereiche = new Set(
      fixtures.map((fixture) => fixture.fachbereich),
    );
    expect(fachbereiche.size).toBeGreaterThanOrEqual(4);
  });

  test("vergibt eindeutige Slugs und Titel", () => {
    expect(new Set(fixtures.map((fixture) => fixture.slug)).size).toBe(
      fixtures.length,
    );
    expect(new Set(fixtures.map((fixture) => fixture.titel)).size).toBe(
      fixtures.length,
    );
  });

  test("deckt Revisionen und eine Rücknahme ab", () => {
    const revisionen = fixtures.flatMap((fixture) => fixture.revisionen);
    expect(revisionen.length).toBeGreaterThanOrEqual(1);
    expect(
      revisionen.some((revision) => revision.zurueckgenommenAm !== null),
    ).toBe(true);
  });

  test("publiziert vollständige Profil-3-Definitionen über den echten Seed-Pfad", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "documentation-seed-"));
    try {
      const root = resolve(import.meta.dir, "..");
      const child = Bun.spawn(
        [process.execPath, "run", "scripts/seed-documentation.ts"],
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
        throw new Error(`Seed fehlgeschlagen:\n${stdout}\n${stderr}`);

      const records = await new ProcessCaptureRepository(workspace).list();
      expect(records).toHaveLength(fixtures.length);
      expect(
        records.every(
          (record) =>
            record.state === "confirmed" &&
            record.profile.version === 3 &&
            record.currentStateDetails !== null,
        ),
      ).toBe(true);
      const flagship = records.find(
        (record) =>
          record.cover.processName ===
          "Leitungswasserschaden Wohngebäude regulieren",
      );
      expect(flagship?.confirmationQuality).toBe("complete");
      const opportunity = await new OpportunityDiscoveryRepository(
        workspace,
      ).required(flagship!.id);
      expect(opportunity.state).toBe("completed");
      expect(
        opportunity.scenarios?.scenarios.find(
          (scenario) => scenario.id === "SCN-agentic",
        )?.title,
      ).toBe("Agentischer Schaden-Arbeitsbegleiter");
      expect(
        opportunity.hypotheses?.stepAnalyses.flatMap(
          (analysis) => analysis.hypotheses,
        ),
      ).toHaveLength(4);
      const assessment = await new AgenticPotentialAssessmentRepository(
        workspace,
      ).required(flagship!.id);
      expect(assessment.state).toBe("completed");
      expect(
        assessment.result?.criteria.filter(
          (criterion) => criterion.status === "scored",
        ),
      ).toHaveLength(15);
      const documentationFiles = await readdir(join(workspace, "docs"), {
        recursive: true,
      });
      expect(
        documentationFiles.filter((file) => file.endsWith(".md")),
      ).toHaveLength(fixtures.length + 1);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }, 30_000);

  for (const fixture of fixtures) {
    describe(fixture.slug, () => {
      const belegIds = new Map(
        fixture.belege.map((beleg) => [beleg.id, `msg-${beleg.id}`]),
      );

      test("verweist nur auf vorhandene Belege", () => {
        const unbekannt = verwendeteBelege(fixture).filter(
          (id) => !belegIds.has(id),
        );
        expect(unbekannt).toEqual([]);
      });

      for (let revision = 0; revision <= fixture.revisionen.length; revision++)
        test(`expandiert Fassung ${revision} zu einem gültigen Verständnis`, () => {
          const understanding = expandUnderstanding(
            fixture,
            inhaltAt(fixture, revision),
            belegIds,
          );
          expect(understanding.steps.length).toBeGreaterThanOrEqual(1);
          expect(understanding.evidence.length).toBe(fixture.belege.length);
          expect(
            validateProcessFlow(understanding.flow, understanding.steps),
          ).toEqual([]);
        });
    });
  }
});

/** Alle Beleg-Kennungen, die irgendwo im Fixture referenziert werden. */
function verwendeteBelege(fixture: DocumentationFixture): string[] {
  const ids = new Set<string>();
  const sammle = (wert: unknown) => {
    if (Array.isArray(wert)) {
      for (const eintrag of wert) sammle(eintrag);
      return;
    }
    if (!wert || typeof wert !== "object") return;
    const record = wert as Record<string, unknown>;
    if (Array.isArray(record.belege))
      for (const id of record.belege) if (typeof id === "string") ids.add(id);
    for (const eintrag of Object.values(record)) sammle(eintrag);
  };
  sammle({ ...fixture, belege: undefined });
  return [...ids];
}
