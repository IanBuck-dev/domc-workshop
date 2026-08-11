import { describe, expect, test } from "bun:test";
import { validateProcessFlow } from "../packages/domain/src/process-understanding.ts";
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
