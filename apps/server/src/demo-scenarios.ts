/**
 * Gemeinsames Schema und Loader für die Demo-Szenarien unter `demo-data/`.
 *
 * Wird von der Demo-Route (`routes/demo.ts`), dem Seed-Skript und den
 * zugehörigen Tests importiert, damit alle drei dieselbe Vorstellung davon
 * haben, was ein gültiges Szenario ist. `demo-data/` existiert in manchen
 * Arbeitskopien und Deployments nicht — der fehlende Ordner ist ein gültiger,
 * leerer Zustand, kein Fehler.
 */
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export const demoDokumentSchema = z.object({
  quelle: z.string().trim().min(1),
  zielname: z.string().trim().min(1),
  format: z.enum(["pdf", "csv", "txt", "md"]),
});
export type DemoDokument = z.infer<typeof demoDokumentSchema>;

export const demoSzenarioSchema = z.object({
  slug: z.string().trim().min(1),
  titel: z.string().trim().min(1),
  cover: z.object({
    department: z.string().trim().min(1),
    participantName: z.string().trim().min(1),
    participantEmail: z.email(),
    processName: z.string().trim().min(1),
  }),
  interactionMode: z.enum(["chat", "form"]),
  dokumente: z.array(demoDokumentSchema).max(5).default([]),
  formular: z
    .object({
      antworten: z.record(z.string(), z.string()),
      arbeitsmerkmale: z.record(z.string(), z.array(z.string())),
    })
    .optional(),
});
export type DemoSzenario = z.infer<typeof demoSzenarioSchema>;

export const demoZugSchema = z.object({
  nummer: z.number().int().positive(),
  antwort: z.string().min(1),
  hinweis: z.string().optional(),
});
export type DemoZug = z.infer<typeof demoZugSchema>;

export const demoDrehbuchSchema = z.object({
  zuege: z.array(demoZugSchema),
});
export type DemoDrehbuch = z.infer<typeof demoDrehbuchSchema>;

export type DemoScenarioWithScript = DemoSzenario & { zuege: DemoZug[] };

export class DemoScenarioNotFoundError extends Error {
  constructor() {
    super("Szenario nicht gefunden.");
    this.name = "DemoScenarioNotFoundError";
  }
}

export class DemoDocumentNotFoundError extends Error {
  constructor() {
    super("Dokument nicht gefunden.");
    this.name = "DemoDocumentNotFoundError";
  }
}

export function demoDataRoot() {
  return process.env.DEMO_DATA_DIR ?? join(process.cwd(), "demo-data");
}

function szenarienRoot() {
  return join(demoDataRoot(), "szenarien");
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function loadSzenario(slug: string): Promise<DemoSzenario> {
  return demoSzenarioSchema.parse(
    await readJson(join(szenarienRoot(), slug, "szenario.json")),
  );
}

/**
 * Liest alle Szenarien inklusive Drehbuch. Ein fehlender `szenarien/`-Ordner
 * liefert eine leere Liste — das ist der normale Zustand vor dem Seeden bzw.
 * in Deployments ohne Demo-Daten. Ein vorhandenes, aber kaputtes Szenario
 * (ungültiges JSON oder Schemaverstoß) wirft dagegen einen Fehler: das soll
 * beim Aufbau der Demo-Daten aktiv auffallen statt still zu fehlen.
 */
export async function listDemoScenarios(): Promise<DemoScenarioWithScript[]> {
  const root = szenarienRoot();
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const slugs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const szenarien: DemoScenarioWithScript[] = [];
  for (const slug of slugs) {
    const szenario = await loadSzenario(slug);
    const drehbuch = demoDrehbuchSchema.parse(
      await readJson(join(root, slug, "drehbuch.json")),
    );
    szenarien.push({ ...szenario, zuege: drehbuch.zuege });
  }
  return szenarien;
}

const contentTypes: Record<DemoDokument["format"], string> = {
  pdf: "application/pdf",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
};

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function isTableRow(line: string): boolean {
  return /^\|.*\|$/.test(line.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

function tableCells(row: string): string[] {
  return row
    .trim()
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * Winziger, selbst geschriebener Markdown-zu-HTML-Konverter für
 * Überschriften, Absätze, Listen und Tabellen — genug für die einfachen
 * Arbeitsanweisungen in `demo-data/`. Keine neue Abhängigkeit dafür.
 */
function markdownToHtmlBody(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]!;
    if (!line.trim()) {
      index++;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      blocks.push(
        `<h${level}>${inlineMarkdown(heading[2]!.trim())}</h${level}>`,
      );
      index++;
      continue;
    }
    if (isTableRow(line)) {
      const rows: string[] = [];
      while (index < lines.length && isTableRow(lines[index]!)) {
        rows.push(lines[index]!);
        index++;
      }
      const [headerRow, maybeSeparator, ...rest] = rows;
      const bodyRows =
        maybeSeparator && isTableSeparator(maybeSeparator)
          ? rest
          : rows.slice(1);
      const thead = headerRow
        ? `<thead><tr>${tableCells(headerRow)
            .map((cell) => `<th>${inlineMarkdown(cell)}</th>`)
            .join("")}</tr></thead>`
        : "";
      const tbody = `<tbody>${bodyRows
        .map(
          (row) =>
            `<tr>${tableCells(row)
              .map((cell) => `<td>${inlineMarkdown(cell)}</td>`)
              .join("")}</tr>`,
        )
        .join("")}</tbody>`;
      blocks.push(`<table>${thead}${tbody}</table>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index]!)) {
        items.push(lines[index]!.replace(/^[-*]\s+/, ""));
        index++;
      }
      blocks.push(
        `<ul>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`,
      );
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index]!)) {
        items.push(lines[index]!.replace(/^\d+\.\s+/, ""));
        index++;
      }
      blocks.push(
        `<ol>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ol>`,
      );
      continue;
    }
    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index]!.trim() &&
      !/^(#{1,6})\s+/.test(lines[index]!) &&
      !/^[-*]\s+/.test(lines[index]!) &&
      !/^\d+\.\s+/.test(lines[index]!) &&
      !isTableRow(lines[index]!)
    ) {
      paragraph.push(lines[index]!);
      index++;
    }
    blocks.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
  }
  return blocks.join("\n");
}

function markdownToHtmlDocument(markdown: string): string {
  return `<!doctype html><meta charset="utf-8">
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; margin: 40px; line-height: 1.5; }
  h1, h2, h3, h4, h5, h6 { color: #111111; margin-top: 1.4em; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #cccccc; padding: 6px 10px; text-align: left; font-size: 0.95em; }
  th { background: #f2f2f2; }
  ul, ol { margin: 0.5em 0; padding-left: 1.4em; }
  p { margin: 0.6em 0; }
</style>
<body>
${markdownToHtmlBody(markdown)}
</body>`;
}

/**
 * Rendert die Markdown-Quelle eines als `pdf` markierten Dokuments über
 * headless Chrome (Muster aus `scripts/generate-icons.ts`) und legt das
 * Ergebnis unter `demo-data/.cache/<slug>/<zielname>` ab. Der Cache ist
 * ungültig, sobald die Quelldatei neuer ist als das Cachefile.
 */
async function renderMarkdownToPdf(
  slug: string,
  dokument: DemoDokument,
  quellPath: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const cacheDir = join(demoDataRoot(), ".cache", slug);
  const cachePath = join(cacheDir, dokument.zielname);
  const quellStat = await stat(quellPath);
  if (existsSync(cachePath)) {
    const cacheStat = await stat(cachePath);
    if (cacheStat.mtimeMs >= quellStat.mtimeMs)
      return new Uint8Array(
        await readFile(cachePath),
      ) as Uint8Array<ArrayBuffer>;
  }
  const markdown = await readFile(quellPath, "utf8");
  const html = markdownToHtmlDocument(markdown);
  await mkdir(cacheDir, { recursive: true });
  const workspace = await mkdtemp(join(tmpdir(), "demo-pdf-"));
  try {
    const page = join(workspace, "dokument.html");
    await writeFile(page, html);
    const chrome = Bun.spawn(
      [
        CHROME,
        "--headless",
        "--disable-gpu",
        "--no-pdf-header-footer",
        `--print-to-pdf=${cachePath}`,
        `file://${page}`,
      ],
      { stdout: "ignore", stderr: "pipe" },
    );
    if (await chrome.exited) {
      const stderr = await new Response(chrome.stderr).text();
      throw new Error(
        `PDF-Rendering für „${dokument.zielname}" ist fehlgeschlagen. Chrome nicht gefunden oder Fehler: ${stderr}`,
      );
    }
    return new Uint8Array(await readFile(cachePath)) as Uint8Array<ArrayBuffer>;
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

/**
 * Liest ein Dokument eines Szenarios. `zielname` kommt aus der Route und ist
 * damit Nutzereingabe — deshalb wird er ausschließlich gegen die bekannte
 * `dokumente[]`-Liste des Szenarios geprüft, statt direkt einen Dateipfad
 * daraus zu bauen (Path-Traversal-Schutz). Der tatsächliche Dateiname auf der
 * Platte (`quelle`) stammt ausschließlich aus dem vertrauenswürdigen
 * `szenario.json`.
 */
export async function readDemoDocument(
  slug: string,
  zielname: string,
): Promise<{
  bytes: Uint8Array<ArrayBuffer>;
  contentType: string;
  dateiname: string;
}> {
  const root = szenarienRoot();
  if (!existsSync(join(root, slug))) throw new DemoScenarioNotFoundError();
  const szenario = await loadSzenario(slug);
  const dokument = szenario.dokumente.find(
    (eintrag) => eintrag.zielname === zielname,
  );
  if (!dokument) throw new DemoDocumentNotFoundError();
  const quellPath = join(root, slug, dokument.quelle);
  if (dokument.format === "pdf") {
    const bytes = await renderMarkdownToPdf(slug, dokument, quellPath);
    return {
      bytes,
      contentType: contentTypes.pdf,
      dateiname: dokument.zielname,
    };
  }
  const bytes = await readFile(quellPath);
  return {
    bytes: new Uint8Array(bytes) as Uint8Array<ArrayBuffer>,
    contentType: contentTypes[dokument.format],
    dateiname: dokument.zielname,
  };
}
