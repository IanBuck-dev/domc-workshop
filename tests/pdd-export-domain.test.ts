import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createPddWorkbookModel,
  pddExportConfigSchema,
  pddSourceRevision,
  safePddFilename,
} from "../packages/domain/src/pdd-export.ts";
import { confirmedProcess } from "./opportunity-fixtures.ts";
import { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";

async function fixture() {
  const root = await Bun.$`mktemp -d`.text();
  const repository = new ProcessCaptureRepository(root.trim());
  const record = await confirmedProcess(repository);
  const config = pddExportConfigSchema.parse({
    ...JSON.parse(
      await readFile(
        join(import.meta.dir, "..", "defaults", "pdd-export-config.json"),
        "utf8",
      ),
    ),
    schemaVersion: 1,
    sheets: [
      "Übersicht",
      "Prozessschritte",
      "Entscheidungen",
      "Informationen",
      "Organisation",
      "Offene Punkte",
      "Nachweise",
    ],
  });
  return { root: root.trim(), record, config };
}

describe("PDD export domain", () => {
  test("creates all seven sheet models from a confirmed snapshot", async () => {
    const { record, config } = await fixture();
    const model = createPddWorkbookModel(
      record,
      config,
      "2026-08-12T09:00:00.000Z",
    );
    expect(model.sheets.map((sheet) => sheet.name as string)).toEqual(
      config.sheets,
    );
    expect(
      model.sheets
        .find((sheet) => sheet.name === "Offene Punkte")
        ?.rows.map((row) => row[2]?.value),
    ).toContain("Exakte Fallzahl unbekannt");
    expect(
      model.sheets.find((sheet) => sheet.name === "Nachweise")?.rows,
    ).toHaveLength(record.understanding!.evidence.length);
  });

  test("hashes a canonical confirmed source and makes a path-safe filename", async () => {
    const { record } = await fixture();
    const reordered = JSON.parse(JSON.stringify(record));
    reordered.understanding = Object.fromEntries(
      Object.entries(reordered.understanding).reverse(),
    );
    expect(pddSourceRevision(reordered)).toBe(pddSourceRevision(record));
    const filename = safePddFilename({
      prefix: "PDD / Köln",
      processId: record.id,
      confirmedAt: record.confirmedAt!,
      sourceRevision: pddSourceRevision(record),
      exportId: "3d5e581c-1f0d-45fc-a1c9-f6cb3bf61787",
    });
    expect(filename).toMatch(
      /^PDD-Koln-PROC-\d{4}-\d{4}-\d{2}-\d{2}-[a-f0-9]{12}-3d5e581c\.xlsx$/,
    );
  });
});
