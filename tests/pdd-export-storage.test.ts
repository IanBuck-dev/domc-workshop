import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { PddExportRepository } from "../packages/storage/src/pdd-export-repository.ts";
import { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";
import { confirmedProcess } from "./opportunity-fixtures.ts";

const roots: string[] = [];
afterEach(() =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);

describe("PDD export storage", () => {
  test("writes and audits immutable valid workbooks", async () => {
    const root = await mkdtemp(join(tmpdir(), "pdd-export-"));
    roots.push(root);
    const processes = new ProcessCaptureRepository(root);
    const record = await confirmedProcess(processes);
    const exports = new PddExportRepository(
      root,
      join(import.meta.dir, "..", "defaults"),
    );
    const first = await exports.export(record, {
      exportedAt: "2026-08-12T09:00:00.000Z",
      exportId: "3d5e581c-1f0d-45fc-a1c9-f6cb3bf61787",
      initiatedBy: "demo-user",
    });
    const second = await exports.export(record, {
      exportedAt: "2026-08-12T09:01:00.000Z",
      exportId: "a0d73751-bdee-4a65-bd3a-64d953a8b477",
    });
    expect(first.detail.filename).not.toBe(second.detail.filename);
    const workbookEntries = unzipSync(first.bytes);
    const templateEntries = unzipSync(
      new Uint8Array(
        await readFile(
          join(
            import.meta.dir,
            "..",
            "defaults",
            "pdd",
            "PDD_Draft.current-state.v1.xlsx",
          ),
        ),
      ),
    );
    expect(Object.keys(workbookEntries)).toEqual(
      expect.arrayContaining([
        "[Content_Types].xml",
        "xl/workbook.xml",
        "xl/worksheets/sheet7.xml",
      ]),
    );
    const workbookXml = new TextDecoder().decode(
      workbookEntries["xl/workbook.xml"],
    );
    const stylesXml = new TextDecoder().decode(
      workbookEntries["xl/styles.xml"],
    );
    const firstSheetXml = new TextDecoder().decode(
      workbookEntries["xl/worksheets/sheet1.xml"],
    );
    expect(
      workbookXml.match(/_xlnm\.Print_Titles/g)?.length ?? 0,
    ).toBeGreaterThan(0);
    expect(stylesXml).toContain('rgb="FFFFFFFF"');
    expect(firstSheetXml.indexOf("<sheetPr>")).toBeLessThan(
      firstSheetXml.indexOf("<sheetViews>"),
    );
    expect(firstSheetXml).not.toContain("<f>");
    expect(firstSheetXml).toMatch(
      /<c\b[^>]*r="B5"[^>]*s="4"[^>]*t="inlineStr"/,
    );
    for (let index = 4; index <= 17; index++)
      expect(workbookEntries[`xl/worksheets/sheet${index}.xml`]).toEqual(
        templateEntries[`xl/worksheets/sheet${index}.xml`],
      );
    expect(
      await readFile(
        join(
          root,
          "process-captures",
          record.id,
          "exports",
          first.detail.filename,
        ),
      ),
    ).toEqual(Buffer.from(first.bytes));
    const auditEntries = (await processes.history(record.id)).filter(
      (entry) => entry.event === "pdd-exported",
    );
    expect(auditEntries).toHaveLength(2);
    expect(
      auditEntries.some(
        (entry) =>
          (entry.detail as { initiatedBy?: string }).initiatedBy ===
          "demo-user",
      ),
    ).toBe(true);
  });
});
