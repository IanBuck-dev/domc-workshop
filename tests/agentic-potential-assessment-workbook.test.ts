import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { createAgenticAssessmentWorkbook } from "../packages/storage/src/agentic-assessment-workbook.ts";
import { AgenticPotentialAssessmentRepository } from "../packages/storage/src/agentic-potential-assessment-repository.ts";
import { OpportunityDiscoveryRepository } from "../packages/storage/src/opportunity-discovery-repository.ts";
import { ProcessCaptureRepository } from "../packages/storage/src/process-capture-repository.ts";
import {
  completedAssessment,
  completedOpportunity,
} from "./agentic-potential-assessment-fixtures.ts";
import { confirmedProcess } from "./opportunity-fixtures.ts";

const templatePath =
  "defaults/agentic-potential-assessment/KI-Potentiale.agentic.v1.xlsx";
const roots: string[] = [];
afterEach(() =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);

test("sanitized assessment template has five sheets and no classification artifacts", async () => {
  const bytes = new Uint8Array(await readFile(templatePath));
  const files = unzipSync(bytes);
  expect(
    Object.keys(files).some((name) =>
      /customXml|LabelInfo|docProps\/custom/.test(name),
    ),
  ).toBeFalse();
  const packageRelationships = new TextDecoder().decode(files["_rels/.rels"]!);
  expect(packageRelationships).not.toMatch(
    /classificationlabels|custom-properties|LabelInfo|docProps\/custom/,
  );
  const workbookRelationships = new TextDecoder().decode(
    files["xl/_rels/workbook.xml.rels"]!,
  );
  expect(workbookRelationships).not.toMatch(/customXml/);
  expect(workbookRelationships.trim()).toMatch(
    /^<\?xml[^>]*\?>\s*<Relationships\b/,
  );
  expect(workbookRelationships).toContain(
    'Id="rId11" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"',
  );
  const workbook = new TextDecoder().decode(files["xl/workbook.xml"]!);
  expect(workbook).toMatch(
    /<workbookView\b[^>]*firstSheet="0"[^>]*activeTab="0"/,
  );
  expect(
    [...workbook.matchAll(/<sheet\b[^>]*\bname="([^"]+)"/g)].map(
      (match) => match[1],
    ),
  ).toEqual([
    "Agentische Bewertung",
    "KI-Kernnutzen",
    "Kriterien Volltext",
    "Kriterien Kurz",
    "Archiv_Forms",
  ]);
  for (let index = 2; index <= 5; index++)
    expect(
      new TextDecoder().decode(files[`xl/worksheets/sheet${index}.xml`]!),
    ).not.toContain("<headerFooter>");
});

test("export fills only the assessment sheet from the stored result", async () => {
  const root = await mkdtemp(join(tmpdir(), "agentic-workbook-"));
  roots.push(root);
  const processes = new ProcessCaptureRepository(root);
  const process = await confirmedProcess(processes);
  const opportunities = new OpportunityDiscoveryRepository(root);
  const opportunity = await completedOpportunity(process, opportunities);
  const assessments = new AgenticPotentialAssessmentRepository(root);
  const record = await completedAssessment(process, opportunity, assessments);
  const template = new Uint8Array(await readFile(templatePath));
  const templateHash = createHash("sha256").update(template).digest("hex");
  const exported = unzipSync(
    createAgenticAssessmentWorkbook(template, templateHash, record),
  );
  const source = unzipSync(template);
  for (let index = 2; index <= 5; index++)
    expect(exported[`xl/worksheets/sheet${index}.xml`]).toEqual(
      source[`xl/worksheets/sheet${index}.xml`],
    );
  const sheet = new TextDecoder().decode(exported["xl/worksheets/sheet1.xml"]!);
  expect(sheet).toContain(process.cover.processName);
  expect(sheet).toContain(record.assessmentRevision!);
  expect(
    sheet.match(/Nicht berechnet – unvollständige Bewertungsgrundlage/g),
  ).toHaveLength(9);
  expect(sheet).toContain("Strategische Passung");
  expect(sheet).toContain("HYP-001");
});
