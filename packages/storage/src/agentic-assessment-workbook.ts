import { createHash } from "node:crypto";
import { strToU8, unzipSync, zipSync } from "fflate";
import type { AgenticPotentialAssessmentRecord } from "../../domain/src/agentic-potential-assessment.ts";

const decoder = new TextDecoder("utf-8", { fatal: true });
const names = [
  "Agentische Bewertung",
  "KI-Kernnutzen",
  "Kriterien Volltext",
  "Kriterien Kurz",
  "Archiv_Forms",
];
function escape(value: unknown) {
  const text = String(value ?? "");
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
function safe(value: unknown) {
  const text = String(value ?? "");
  return escape(/^[=+\-@]/.test(text) ? `'${text}` : text);
}
function col(index: number) {
  let value = "";
  for (
    let current = index + 1;
    current;
    current = Math.floor((current - 1) / 26)
  )
    value = String.fromCharCode(65 + ((current - 1) % 26)) + value;
  return value;
}
function cell(reference: string, value: unknown, style = 1) {
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${safe(value)}</t></is></c>`;
}
function row(index: number, values: unknown[], style = 1) {
  return `<row r="${index}" ht="45" customHeight="1">${values.map((value, i) => cell(`${col(i)}${index}`, value, style)).join("")}</row>`;
}

function assessmentSheet(record: AgenticPotentialAssessmentRecord) {
  if (!record.result || !record.assessmentRevision)
    throw new Error("Die abgeschlossene Bewertung enthält kein Ergebnis.");
  const definitions = new Map(
    record.configSnapshot.criteria.map((item) => [item.id, item]),
  );
  const summary = {
    scored: record.result.criteria.filter((item) => item.status === "scored")
      .length,
    insufficient: record.result.criteria.filter(
      (item) => item.status === "insufficient_evidence",
    ).length,
    excluded: record.result.criteria.filter(
      (item) => item.status === "policy_excluded",
    ).length,
  };
  const headers = [
    "Kategorie",
    "Kriterium",
    "Status",
    "Score",
    "Skala",
    "Begründung",
    "Evidenz",
    "Hypothesenbezug",
    "Konfidenz",
    "Offene Informationen",
  ];
  const data = record.result.criteria.map((item) => {
    const definition = definitions.get(item.criterionId)!;
    return [
      definition.category,
      definition.name,
      item.status === "scored"
        ? "Bewertet"
        : item.status === "insufficient_evidence"
          ? "Nicht ausreichend belegt"
          : "Ausgeschlossen",
      item.score ?? "",
      definition.scale,
      item.rationale,
      item.evidenceIds.join("\n"),
      item.hypothesisIds.join("\n"),
      item.confidenceLevel === "high"
        ? "hoch"
        : item.confidenceLevel === "medium"
          ? "mittel"
          : item.confidenceLevel === "low"
            ? "niedrig"
            : "",
      [...item.assumptions, ...item.openQuestions].join("\n"),
    ];
  });
  const results = [
    "Zulässigkeit/Verpflichtung",
    "Amortisationszeit",
    "Netto-Ertrag",
    "ROI",
    "Betriebswirtschaftliche Rentabilität",
    "Qualitativ-strategische Relevanz",
    "Implementierungskomplexität",
    "Technische KI-Attraktivität",
    "Gesamtergebnis",
  ].map((name) => [
    "Ergebnis",
    name,
    "Nicht berechnet – unvollständige Bewertungsgrundlage",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const widths = [24, 32, 32, 10, 46, 58, 28, 28, 16, 42];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="6" topLeftCell="A7" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join("")}</cols><sheetData><row r="1" ht="28">${cell("A1", "Agentische Potenzialbewertung", 2)}</row>${row(2, ["Prozess", record.sourceSnapshot.processName, "Szenario", record.sourceSnapshot.scenario.title, "Assessment-Revision", record.assessmentRevision, "Quellrevision", record.sourceSnapshot.sourceProcessHash, "Erstellt", record.createdAt])}${row(3, ["Bewertet", summary.scored, "Nicht ausreichend belegt", summary.insufficient, "Ausgeschlossen", summary.excluded, "", "", "", ""])}${row(5, headers, 2)}${data.map((values, index) => row(index + 6, values)).join("")}${results.map((values, index) => row(index + 6 + data.length, values)).join("")}</sheetData><mergeCells count="1"><mergeCell ref="A1:J1"/></mergeCells><autoFilter ref="A5:J${5 + data.length}"/><printOptions gridLines="0"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

export function createAgenticAssessmentWorkbook(
  template: Uint8Array,
  expectedHash: string,
  record: AgenticPotentialAssessmentRecord,
) {
  if (createHash("sha256").update(template).digest("hex") !== expectedHash)
    throw new Error("Die bereinigte Bewertungs-Vorlage wurde verändert.");
  const source = unzipSync(template);
  const workbook = decoder.decode(source["xl/workbook.xml"]!);
  const actualNames = [
    ...workbook.matchAll(/<sheet\b[^>]*\bname="([^"]+)"/g),
  ].map((match) => match[1]);
  if (JSON.stringify(actualNames) !== JSON.stringify(names))
    throw new Error(
      "Die Bewertungs-Vorlage enthält nicht die erwarteten Arbeitsblätter.",
    );
  const result = {
    ...source,
    "xl/worksheets/sheet1.xml": strToU8(assessmentSheet(record)),
  };
  const bytes = zipSync(result, {
    level: 6,
    mtime: new Date("2000-01-01T00:00:00.000Z"),
  });
  const reopened = unzipSync(bytes);
  for (const [path, original] of Object.entries(source)) {
    if (path === "xl/worksheets/sheet1.xml") continue;
    const current = reopened[path];
    if (
      !current ||
      current.byteLength !== original.byteLength ||
      original.some((value, index) => current[index] !== value)
    )
      throw new Error(
        `Die Arbeitsmappe hat einen nicht freigegebenen Vorlagenteil verändert: ${path}`,
      );
  }
  const exportedNames = [
    ...decoder
      .decode(reopened["xl/workbook.xml"]!)
      .matchAll(/<sheet\b[^>]*\bname="([^"]+)"/g),
  ].map((match) => match[1]);
  if (JSON.stringify(exportedNames) !== JSON.stringify(names))
    throw new Error("Die exportierte Arbeitsmappe ist unvollständig.");
  return bytes;
}
