import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { strToU8, unzipSync, zipSync } from "fflate";

const sourceHash =
  "15cdc24c2152dd57820c318f712195696573aaebeb008f4cf6ef0f40df34f662";
const expectedSheets = [
  "Deckblatt",
  "01_Prozessdefinition",
  "02_Prozessschritte",
  "01 Projektsteckbrief",
  "03 Prozess",
  "02 Business Case",
  "06 Architektur Betrieb",
  "04 KI Use Case",
  "05 Daten Compliance",
  "07 RACI Governance",
  "08 Meilensteine",
  "09 Risiken Entscheidungen",
  "10 Abnahme Tests",
  "11 Change Kommunikation",
  "12 Entscheidungsvorlage",
  "13 Glossar Quellen",
  "Dashboard",
];
const mappedCells = [
  "B5",
  "B6",
  "B7",
  "B8",
  "B9",
  "B10",
  "B11",
  "B12",
  "B13",
  "B14",
  "B15",
  "B6",
  "G6",
  "K6",
  "B7",
  "K7",
  "B8",
  "K8",
  "B9",
  "K9",
  "B12",
  "G12",
  "K12",
  "B13",
  "G13",
  "K13",
  "B14",
  "G14",
  "K14",
  "B17",
  "K17",
  "B18",
  "K18",
  "B21",
  "G21",
  "K21",
  "B22",
  "G22",
  "K22",
  "B18",
];
const decoder = new TextDecoder("utf-8", { fatal: true });

function clearCell(xml: string, reference: string) {
  return xml.replace(
    new RegExp(
      `<c\\b([^>]*\\br="${reference}"[^>]*?)(?:\\/>|>[\\s\\S]*?<\\/c>)`,
      "g",
    ),
    (_cell, attributes: string) =>
      `<c${attributes.replace(/\s+t="[^"]*"/g, "").replace(/\/\s*$/, "")}/>`,
  );
}
function compactSharedStrings(entries: Record<string, Uint8Array>) {
  const path = "xl/sharedStrings.xml";
  if (!entries[path]) return;
  const xml = decoder.decode(entries[path]);
  const items = [...xml.matchAll(/<si(?:\s[^>]*)?>[\s\S]*?<\/si>/g)].map(
    (match) => match[0],
  );
  const used = new Set<number>();
  for (const [name, bytes] of Object.entries(entries)) {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) continue;
    const sheet = decoder.decode(bytes);
    for (const match of sheet.matchAll(
      /<c\b[^>]*\bt="s"[^>]*>[\s\S]*?<v>(\d+)<\/v>[\s\S]*?<\/c>/g,
    ))
      used.add(Number(match[1]));
  }
  const ordered = [...used].sort((left, right) => left - right);
  const index = new Map(ordered.map((old, next) => [old, next]));
  for (const [name, bytes] of Object.entries(entries)) {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) continue;
    entries[name] = strToU8(
      decoder
        .decode(bytes)
        .replace(
          /(<c\b[^>]*\bt="s"[^>]*>[\s\S]*?<v>)(\d+)(<\/v>[\s\S]*?<\/c>)/g,
          (_cell, before: string, old: string, after: string) => {
            const next = index.get(Number(old));
            if (next === undefined)
              throw new Error("Die Shared-String-Verweise sind ungültig.");
            return `${before}${next}${after}`;
          },
        ),
    );
  }
  const opening = xml.match(/^([\s\S]*?<sst\b)([^>]*)(>)/);
  if (!opening) throw new Error("Die Shared-String-Tabelle ist ungültig.");
  const attributes = opening[2]!
    .replace(/\s+count="[^"]*"/g, "")
    .replace(/\s+uniqueCount="[^"]*"/g, "");
  entries[path] = strToU8(
    `${opening[1]}${attributes} count="${ordered.length}" uniqueCount="${ordered.length}"${opening[3]}${ordered.map((old) => items[old]).join("")}</sst>`,
  );
}
function worksheetTarget(workbook: string, rels: string, name: string) {
  const sheet = workbook.match(
    new RegExp(`<sheet\\b[^>]*\\bname="${name}"[^>]*\\br:id="([^"]+)"[^>]*/>`),
  );
  if (!sheet?.[1])
    throw new Error(
      "Die Vorlage enthält nicht alle erwarteten Arbeitsblätter.",
    );
  const relationship = rels.match(
    new RegExp(
      `<Relationship\\b[^>]*\\bId="${sheet[1]}"[^>]*\\bTarget="([^"]+)"[^>]*/>`,
    ),
  );
  if (!relationship?.[1])
    throw new Error("Die Vorlagenbeziehungen sind unvollständig.");
  return `xl/${relationship[1]!.replace(/^\//, "")}`.replace(/\/\.\//g, "/");
}
function cleanCoreProperties(xml: string) {
  return xml
    .replace(
      /<dc:creator>[\s\S]*?<\/dc:creator>/,
      "<dc:creator>Zukunftswerkstatt</dc:creator>",
    )
    .replace(
      /<cp:lastModifiedBy>[\s\S]*?<\/cp:lastModifiedBy>/,
      "<cp:lastModifiedBy>Zukunftswerkstatt</cp:lastModifiedBy>",
    )
    .replace(
      /<dc:title>[\s\S]*?<\/dc:title>/,
      "<dc:title>PDD current state template</dc:title>",
    )
    .replace(
      /<dc:subject>[\s\S]*?<\/dc:subject>/,
      "<dc:subject>Sanitized template</dc:subject>",
    )
    .replace(
      /<dc:description>[\s\S]*?<\/dc:description>/,
      "<dc:description>Sanitized template</dc:description>",
    );
}

const [sourceArg, destinationArg] = Bun.argv.slice(2);
if (!sourceArg || !destinationArg)
  throw new Error(
    "Usage: bun scripts/import-pdd-template.ts <source.xlsx> <destination.xlsx>",
  );
const source = resolve(sourceArg);
const destination = resolve(destinationArg);
const bytes = new Uint8Array(await readFile(source));
if (createHash("sha256").update(bytes).digest("hex") !== sourceHash)
  throw new Error(
    "Die Quellvorlage stimmt nicht mit dem geprüften Hash überein.",
  );
let entries: Record<string, Uint8Array>;
try {
  entries = unzipSync(bytes);
} catch {
  throw new Error("Die Quellvorlage ist kein gültiges XLSX-Archiv.");
}
const names = Object.keys(entries);
if (
  names.some((name) =>
    /(^|\/)(vbaProject|externalLinks|connections|people)(\/|\.)/i.test(name),
  )
)
  throw new Error(
    "Die Quellvorlage enthält nicht erlaubte aktive oder personenbezogene Teile.",
  );
const workbook = decoder.decode(entries["xl/workbook.xml"]!);
const rels = decoder.decode(entries["xl/_rels/workbook.xml.rels"]!);
const sheets = [...workbook.matchAll(/<sheet\b[^>]*\bname="([^"]+)"/g)].map(
  (match) => match[1]!,
);
if (JSON.stringify(sheets) !== JSON.stringify(expectedSheets))
  throw new Error(
    "Die Quellvorlage hat nicht die erwartete Arbeitsblattreihenfolge.",
  );
const targetSheets = [
  "Deckblatt",
  "01_Prozessdefinition",
  "02_Prozessschritte",
].map((name) => worksheetTarget(workbook, rels, name));
if (targetSheets.some((name) => !entries[name]))
  throw new Error("Die Vorlagenanker sind nicht lesbar.");
targetSheets.forEach((path, index) => {
  let xml = decoder.decode(entries[path]!);
  const cells =
    index === 0
      ? mappedCells.slice(0, 11)
      : index === 1
        ? mappedCells.slice(11)
        : [];
  if (index === 2)
    for (let row = 7; row <= 14; row++)
      for (const col of "ABCDEFGHI") xml = clearCell(xml, `${col}${row}`);
  for (const cell of cells) xml = clearCell(xml, cell);
  entries[path] = strToU8(xml);
});
// Remove the template's pre-filled project/source references while preserving layout.
const sourceSheet = worksheetTarget(workbook, rels, "13 Glossar Quellen");
let sourceXml = decoder.decode(entries[sourceSheet]!);
for (let row = 17; row <= 20; row++)
  for (const column of "AB")
    sourceXml = clearCell(sourceXml, `${column}${row}`);
entries[sourceSheet] = strToU8(sourceXml);
if (entries["docProps/core.xml"])
  entries["docProps/core.xml"] = strToU8(
    cleanCoreProperties(decoder.decode(entries["docProps/core.xml"])),
  );
for (const name of names) {
  if (/persons|threadedComments/i.test(name)) delete entries[name];
  if (/comments\d*\.xml$/i.test(name)) {
    const xml = decoder.decode(entries[name]!);
    entries[name] = strToU8(
      xml.replace(
        /<author>[\s\S]*?<\/author>/g,
        "<author>Zukunftswerkstatt</author>",
      ),
    );
  }
}
compactSharedStrings(entries);
const sanitized = zipSync(entries, {
  level: 6,
  mtime: new Date("2000-01-01T00:00:00.000Z"),
});
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, sanitized);
