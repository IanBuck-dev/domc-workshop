import { strToU8, unzipSync, zipSync } from "fflate";
import { createHash } from "node:crypto";
import {
  pddWorkbookModelSchema,
  type PddWorkbookModel,
} from "../../domain/src/pdd-export.ts";

const decoder = new TextDecoder("utf-8", { fatal: true });

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
function xmlText(value: string | number) {
  const text = String(value);
  // Excel treats these prefixes as formulas even in otherwise plain input.
  return escapeXml(/^[=+\-@]/.test(text) ? `'${text}` : text);
}
function column(index: number) {
  let result = "";
  for (let value = index + 1; value; value = Math.floor((value - 1) / 26))
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  return result;
}
function excelDate(value: string) {
  return (Date.parse(value) - Date.UTC(1899, 11, 30)) / 86_400_000;
}
function cell(
  reference: string,
  item: { value: string | number; kind: string },
  style = 0,
) {
  if (item.kind === "number")
    return `<c r="${reference}" s="3" t="n"><v>${item.value}</v></c>`;
  if (item.kind === "date")
    return `<c r="${reference}" s="5" t="n"><v>${excelDate(String(item.value))}</v></c>`;
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlText(item.value)}</t></is></c>`;
}
function worksheet(sheet: PddWorkbookModel["sheets"][number]) {
  const columnCount = sheet.columns.length;
  const widths = Array.from({ length: columnCount }, (_, position) => {
    const header = sheet.columns[position]!.length;
    const content = Math.max(
      ...sheet.rows.map(
        (row) => String(row[position]?.value ?? "").slice(0, 50).length,
      ),
      header,
    );
    return `<col min="${position + 1}" max="${position + 1}" width="${Math.min(Math.max(content + 2, 14), 42)}" customWidth="1"/>`;
  }).join("");
  const title = `<row r="1" ht="28" customHeight="1"><c r="A1" s="1" t="inlineStr"><is><t>${escapeXml(sheet.title)}</t></is></c></row>`;
  const header = `<row r="2">${sheet.columns.map((name, position) => cell(`${column(position)}2`, { value: name, kind: "text" }, 2)).join("")}</row>`;
  const rows = sheet.rows
    .map((row, rowIndex) => {
      const lineCount = Math.max(
        ...row.map((item, position) => {
          const width = Math.min(
            Math.max(sheet.columns[position]!.length + 2, 14),
            42,
          );
          return String(item.value)
            .split("\n")
            .reduce(
              (total, line) =>
                total + Math.max(1, Math.ceil(line.length / width)),
              0,
            );
        }),
      );
      const height = Math.min(Math.max(18, lineCount * 15), 120);
      return `<row r="${rowIndex + 3}" ht="${height}" customHeight="1">${row.map((item, position) => cell(`${column(position)}${rowIndex + 3}`, item)).join("")}</row>`;
    })
    .join("");
  const range = `A2:${column(columnCount - 1)}${Math.max(sheet.rows.length + 2, 2)}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/><selection activeCell="A3" sqref="A3"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${widths}</cols><sheetData>${title}${header}${rows}</sheetData><autoFilter ref="${range}"/><mergeCells count="1"><mergeCell ref="A1:${column(columnCount - 1)}1"/></mergeCells><printOptions gridLines="0"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd.mm.yyyy hh:mm"/></numFmts><fonts count="2"><font><sz val="10"/><name val="Aptos"/></font><font><b/><sz val="10"/><name val="Aptos Display"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD9E2F3"/></left><right style="thin"><color rgb="FFD9E2F3"/></right><top style="thin"><color rgb="FFD9E2F3"/></top><bottom style="thin"><color rgb="FFD9E2F3"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="10"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs></styleSheet>`;
const readableStyles = styles.replace(
  "<font><b/><sz",
  '<font><b/><color rgb="FFFFFFFF"/><sz',
);

function requiredEntries(count: number) {
  return [
    "[Content_Types].xml",
    "_rels/.rels",
    "docProps/core.xml",
    "docProps/app.xml",
    "xl/workbook.xml",
    "xl/_rels/workbook.xml.rels",
    "xl/styles.xml",
    ...Array.from(
      { length: count },
      (_, index) => `xl/worksheets/sheet${index + 1}.xml`,
    ),
  ];
}

/** Creates and verifies a deliberately small, self-contained OOXML workbook. */
export function createPddWorkbook(input: PddWorkbookModel) {
  const model = pddWorkbookModelSchema.parse(input);
  const sheetCount = model.sheets.length;
  const sheets = model.sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");
  const printTitles = model.sheets
    .map(
      (sheet, index) =>
        `<definedName name="_xlnm.Print_Titles" localSheetId="${index}">'${escapeXml(sheet.name)}'!$1:$2</definedName>`,
    )
    .join("");
  const entries: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${Array.from({ length: sheetCount }, (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    ),
    "docProps/core.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(model.template.title)}</dc:title><dc:creator>Zukunftswerkstatt</dc:creator><cp:keywords>PDD; ${model.source.sourceRevision}</cp:keywords><dcterms:created xsi:type="dcterms:W3CDTF">${model.source.exportedAt}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${model.source.exportedAt}</dcterms:modified></cp:coreProperties>`,
    ),
    "docProps/app.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Zukunftswerkstatt</Application><TitlesOfParts><vt:vector size="${sheetCount}" baseType="lpstr">${model.sheets.map((sheet) => `<vt:lpstr>${escapeXml(sheet.name)}</vt:lpstr>`).join("")}</vt:vector></TitlesOfParts></Properties>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets}</sheets><definedNames>${printTitles}</definedNames><calcPr calcId="0" calcMode="manual"/></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${Array.from({ length: sheetCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    "xl/styles.xml": strToU8(readableStyles),
  };
  model.sheets.forEach((sheet, index) => {
    entries[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheet(sheet));
  });
  const bytes = zipSync(entries, { level: 6 });
  validatePddWorkbook(
    bytes,
    model.sheets.map((sheet) => sheet.name),
  );
  return bytes;
}

export function validatePddWorkbook(
  bytes: Uint8Array,
  expectedSheetNames: readonly string[],
) {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error(
      "Die erzeugte PDD-Arbeitsmappe ist kein gültiges XLSX-Archiv.",
    );
  }
  const required = requiredEntries(expectedSheetNames.length);
  if (required.some((name) => !entries[name]))
    throw new Error("Die erzeugte PDD-Arbeitsmappe ist unvollständig.");
  const names = Object.keys(entries);
  if (
    names.some((name) => /(^|\/)(vbaProject|externalLinks)(\/|\.)/i.test(name))
  )
    throw new Error("Die PDD-Arbeitsmappe enthält unzulässige aktive Inhalte.");
  let workbook: string;
  try {
    for (const name of names) decoder.decode(entries[name]!);
    workbook = decoder.decode(entries["xl/workbook.xml"]!);
  } catch {
    throw new Error("Die PDD-Arbeitsmappe enthält ungültiges XML.");
  }
  const sheetNames = [...workbook.matchAll(/<sheet\s+name="([^"]+)"/g)].map(
    (match) => match[1]!,
  );
  if (JSON.stringify(sheetNames) !== JSON.stringify(expectedSheetNames))
    throw new Error(
      "Die PDD-Arbeitsmappe enthält nicht die erwarteten Arbeitsblätter.",
    );
  const allXml = names
    .filter((name) => name.endsWith(".xml") || name.endsWith(".rels"))
    .map((name) => decoder.decode(entries[name]!))
    .join("\n");
  if (/\{\{[^}]+\}\}/.test(allXml))
    throw new Error("Die PDD-Arbeitsmappe enthält unaufgelöste Platzhalter.");
  if (
    /<f[\s>]/.test(allXml) ||
    /TargetMode="External"|externalLink/i.test(allXml)
  )
    throw new Error(
      "Die PDD-Arbeitsmappe enthält unzulässige Formeln oder externe Verweise.",
    );
  return true;
}

/** Bounded adapter for the sanitized 17-sheet current-state template. */
export function patchPddCurrentStateTemplate(
  template: Uint8Array,
  expectedHash: string,
  sheetOrder: readonly string[],
  values: Record<string, Record<string, string>>,
) {
  if (createHash("sha256").update(template).digest("hex") !== expectedHash)
    throw new Error("Die bereinigte PDD-Vorlage wurde verändert.");
  const source = unzipSync(template);
  const workbook = decoder.decode(source["xl/workbook.xml"]!);
  const rels = decoder.decode(source["xl/_rels/workbook.xml.rels"]!);
  const names = [
    ...workbook.matchAll(/<sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"/g),
  ];
  if (
    JSON.stringify(names.map((item) => item[1])) !== JSON.stringify(sheetOrder)
  )
    throw new Error(
      "Die PDD-Vorlage hat nicht die erwartete Arbeitsblattreihenfolge.",
    );
  const result = { ...source };
  const targetPaths = new Set<string>();
  const cell = (reference: string, value: string, style?: string) =>
    `<c r="${reference}"${style ? ` s="${style}"` : ""} t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
  for (const match of names.slice(0, 3)) {
    const relation = rels.match(
      new RegExp(
        `<Relationship\\b[^>]*\\bId="${match[2]}"[^>]*\\bTarget="([^"]+)"`,
      ),
    );
    if (!relation?.[1])
      throw new Error(
        "Die PDD-Vorlage enthält keine lesbare Arbeitsblattbeziehung.",
      );
    const path = `xl/${relation[1]!.replace(/^\//, "")}`.replace(
      /\/\.\//g,
      "/",
    );
    targetPaths.add(path);
    let xml = decoder.decode(result[path]!);
    for (const [reference, value] of Object.entries(values[match[1]!] ?? {})) {
      const existing = xml.match(
        new RegExp(
          `<c\\b([^>]*\\br="${reference}"[^>]*?)(?:\\/>|>[\\s\\S]*?<\\/c>)`,
        ),
      );
      const style = existing?.[1]?.match(/\bs="(\d+)"/)?.[1];
      const replacement = cell(reference, value, style);
      if (existing) xml = xml.replace(existing[0], replacement);
      else {
        const rowNumber = reference.match(/\d+$/)?.[0];
        const row = new RegExp(
          `(<row\\b[^>]*\\br="${rowNumber}"[^>]*>)([\\s\\S]*?)(<\\/row>)`,
        );
        const rowMatch = xml.match(row);
        if (!rowMatch)
          throw new Error(
            `Die PDD-Vorlage enthält die erwartete Zeile ${rowNumber} nicht.`,
          );
        const targetColumn = reference.match(/^[A-Z]+/)?.[0] ?? "";
        const columnNumber = (letters: string) =>
          [...letters].reduce(
            (total, letter) => total * 26 + letter.charCodeAt(0) - 64,
            0,
          );
        const cells = [
          ...rowMatch[2]!.matchAll(
            /<c\b[^>]*\br="([A-Z]+)\d+"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g,
          ),
        ];
        const next = cells.find(
          (item) => columnNumber(item[1]!) > columnNumber(targetColumn),
        );
        const content = next?.[0]
          ? rowMatch[2]!.replace(next[0], `${replacement}${next[0]}`)
          : `${rowMatch[2]}${replacement}`;
        xml = xml.replace(
          rowMatch[0],
          `${rowMatch[1]}${content}${rowMatch[3]}`,
        );
      }
    }
    result[path] = strToU8(xml);
  }
  const output = zipSync(result, {
    level: 6,
    mtime: new Date("2000-01-01T00:00:00.000Z"),
  });
  const reopened = unzipSync(output);
  for (const [name, original] of Object.entries(source)) {
    const generated = reopened[name];
    if (!generated)
      throw new Error("Die erzeugte PDD-Arbeitsmappe ist unvollständig.");
    if (targetPaths.has(name)) continue;
    if (
      original.byteLength !== generated.byteLength ||
      original.some((byte, index) => byte !== generated[index])
    )
      throw new Error(
        `Die PDD-Arbeitsmappe hat einen nicht freigegebenen Vorlagenteil verändert: ${name}`,
      );
  }
  return output;
}
