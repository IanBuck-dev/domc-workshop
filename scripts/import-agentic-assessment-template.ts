import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { strToU8, unzipSync, zipSync } from "fflate";

const source =
  process.argv[2] ??
  "/Users/personaldev/Downloads/KI-Potentiale_Abfragekriterien (1).xlsx";
const target =
  process.argv[3] ??
  resolve(
    "defaults/agentic-potential-assessment/KI-Potentiale.agentic.v1.xlsx",
  );
const sourceHash =
  "32214a66a81272dcae7279f4d638668a1f55b8998ca1cfc250465b7af8f7a95c";
const decoder = new TextDecoder();

function assessmentSheet() {
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
  const cell = (ref: string, value: string, style = "1") =>
    `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${value}</t></is></c>`;
  const row = (index: number, values: string[], style = "1") =>
    `<row r="${index}">${values.map((value, column) => cell(`${String.fromCharCode(65 + column)}${index}`, value, style)).join("")}</row>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="6" topLeftCell="A7" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${headers.map((_, index) => `<col min="${index + 1}" max="${index + 1}" width="${[24, 32, 24, 10, 46, 58, 28, 28, 16, 42][index]}" customWidth="1"/>`).join("")}</cols><sheetData><row r="1" ht="28">${cell("A1", "Agentische Potenzialbewertung", "2")}</row>${row(2, ["Prozess", "", "Szenario", "", "Assessment-Revision", "", "Quellrevision", "", "Erstellt", ""])}${row(3, ["Bewertet", "", "Nicht ausreichend belegt", "", "Ausgeschlossen", "", "", "", "", ""])}${row(5, headers, "2")}</sheetData><mergeCells count="1"><mergeCell ref="A1:J1"/></mergeCells><autoFilter ref="A5:J5"/><printOptions gridLines="0"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

const bytes = new Uint8Array(await readFile(source));
if (createHash("sha256").update(bytes).digest("hex") !== sourceHash)
  throw new Error("Die Quellvorlage hat nicht den erwarteten SHA-256-Hash.");
const entries = unzipSync(bytes);
for (const name of Object.keys(entries))
  if (
    name.startsWith("customXml/") ||
    name === "docMetadata/LabelInfo.xml" ||
    name === "docProps/custom.xml"
  )
    delete entries[name];
let content = decoder.decode(entries["[Content_Types].xml"]!);
content = content.replace(
  /<Override PartName="\/(?:docProps\/custom|customXml\/itemProps\d+|docMetadata\/LabelInfo)\.xml"[^>]*\/>/g,
  "",
);
content = content.replace(
  /<Override PartName="\/xl\/worksheets\/sheet(\d+)\.xml"/g,
  (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${Number(index) + 1}.xml"`,
);
content = content.replace(
  "</Types>",
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
);
entries["[Content_Types].xml"] = strToU8(content);
let packageRels = decoder.decode(entries["_rels/.rels"]!);
packageRels = packageRels.replace(
  /<Relationship\b[^>]*Type="[^"]*(?:classificationlabels|custom-properties)"[^>]*\/>/g,
  "",
);
entries["_rels/.rels"] = strToU8(packageRels);
let rels = decoder.decode(entries["xl/_rels/workbook.xml.rels"]!);
rels = rels
  .replace(/<Relationship\b[^>]*Type="[^"]*customXml"[^>]*\/>/g, "")
  .replace(
    /Target="worksheets\/sheet(\d+)\.xml"/g,
    (_, index) => `Target="worksheets/sheet${Number(index) + 1}.xml"`,
  );
rels = rels.replace(
  "</Relationships>",
  '<Relationship Id="rId11" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
);
entries["xl/_rels/workbook.xml.rels"] = strToU8(rels);
for (let index = 4; index >= 1; index -= 1) {
  const oldPath = `xl/worksheets/sheet${index}.xml`;
  const newPath = `xl/worksheets/sheet${index + 1}.xml`;
  const xml = decoder
    .decode(entries[oldPath]!)
    .replace(/<headerFooter>[\s\S]*?<\/headerFooter>/g, "");
  entries[newPath] = strToU8(xml);
  delete entries[oldPath];
}
entries["xl/worksheets/sheet1.xml"] = strToU8(assessmentSheet());
let workbook = decoder.decode(entries["xl/workbook.xml"]!);
workbook = workbook
  .replace(/<mc:AlternateContent[\s\S]*?<\/mc:AlternateContent>/g, "")
  .replace(/<xr:revisionPtr[^>]*\/>/g, "")
  .replace(/<extLst>[\s\S]*?<\/extLst>/g, "");
workbook = workbook.replace(
  /<workbookView\b([^>]*)\bfirstSheet="[^"]*"([^>]*)\bactiveTab="[^"]*"([^>]*)\/>/,
  '<workbookView$1firstSheet="0"$2activeTab="0"$3/>',
);
workbook = workbook.replace(
  /<sheets>/,
  '<sheets><sheet name="Agentische Bewertung" sheetId="1" r:id="rId11"/>',
);
entries["xl/workbook.xml"] = strToU8(workbook);
entries["docProps/core.xml"] = strToU8(
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>KI-Potentiale</dc:title><dc:creator>Zukunftswerkstatt</dc:creator><cp:lastModifiedBy>Zukunftswerkstatt</cp:lastModifiedBy></cp:coreProperties>',
);
await mkdir(dirname(target), { recursive: true });
const result = zipSync(entries, {
  level: 6,
  mtime: new Date("2000-01-01T00:00:00.000Z"),
});
await writeFile(target, result);
console.log(createHash("sha256").update(result).digest("hex"));
