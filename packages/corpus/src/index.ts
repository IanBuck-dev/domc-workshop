import { createHash } from "node:crypto";
import { z } from "zod";
import {
  confirmationQualitySchema,
  normalizedProcessName,
  processUnderstandingSchema,
} from "../../domain/src/process-understanding.ts";

export const rendererVersion = 2;
export const emptySection = "_Keine Angaben erfasst._";

const processIdSchema = z.string().regex(/^PROC-\d{4}$/);
export const corpusSourceSchema = z
  .object({
    id: processIdSchema,
    cover: z.object({
      processName: z.string().trim().min(1).max(240),
      department: z.string().trim().min(1).max(120),
    }),
    understanding: processUnderstandingSchema,
    confirmedAt: z.string().datetime(),
    confirmationQuality: confirmationQualitySchema.unwrap(),
  })
  .strict();
export type CorpusSource = z.infer<typeof corpusSourceSchema>;

export const corpusFrontmatterSchema = z
  .object({
    id: processIdSchema,
    titel: z.string().min(1),
    fachbereich: z.string().min(1),
    status: z.literal("aktiv"),
    bestaetigt_am: z.string().datetime(),
    qualitaet: z.enum(["complete", "with_gaps"]),
    quell_revision: z.string().regex(/^[a-f0-9]{64}$/),
    // Bereits veröffentlichte Dokumente bleiben nach einem Renderer-Upgrade
    // lesbar. Neue Ausgaben schreiben trotzdem immer rendererVersion.
    renderer_version: z.number().int().positive(),
    offene_punkte: z.number().int().nonnegative(),
  })
  .strict();
export type CorpusFrontmatter = z.infer<typeof corpusFrontmatterSchema>;

export const catalogEntrySchema = z
  .object({
    id: processIdSchema,
    titel: z.string().min(1),
    slug: z.string().min(1),
    fachbereich: z.string().min(1),
    systeme: z.array(z.string()),
    quellProzessIds: z.array(processIdSchema).min(1),
    quellRevision: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const catalogSchema = z.array(catalogEntrySchema);
export const corpusIndexSchema = z
  .string()
  .regex(/^# Prozessdokumentation\n/, "Der Gesamtindex ist ungültig.");
export type Catalog = z.infer<typeof catalogSchema>;
export type CatalogEntry = z.infer<typeof catalogEntrySchema>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

/** Die explizite, persistierte Publikationsquelle wird unverändert gehasht. */
export function computeSourceRevision(input: CorpusSource): string {
  return createHash("sha256")
    .update(canonical(corpusSourceSchema.parse(input)))
    .digest("hex");
}

export function slug(value: string) {
  const normalized = value
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "prozess";
}

export { normalizedProcessName };

function documentPaths(sources: CorpusSource[]) {
  const grouped = new Map<string, CorpusSource[]>();
  for (const source of sources) {
    const path = `prozesse/${slug(source.cover.department)}/${slug(source.cover.processName)}.md`;
    grouped.set(path, [...(grouped.get(path) ?? []), source]);
  }
  const paths = new Map<string, string>();
  for (const [base, colliding] of grouped) {
    const sorted = [...colliding].sort((a, b) => a.id.localeCompare(b.id));
    if (sorted.length === 1) paths.set(sorted[0]!.id, base);
    else
      for (const source of sorted)
        paths.set(
          source.id,
          base.replace(/\.md$/, `--${source.id.toLowerCase()}.md`),
        );
  }
  return paths;
}

export function processPath(source: CorpusSource, sources = [source]) {
  return documentPaths(
    sources.map((item) => corpusSourceSchema.parse(item)),
  ).get(source.id)!;
}

function lines(value: string[] | null) {
  return value?.length
    ? value.map((item) => `- ${item}`).join("\n")
    : emptySection;
}
function fact(value: string | null) {
  return value ?? emptySection;
}
function yaml(value: string) {
  return JSON.stringify(value);
}

export function renderProcess(
  sourceInput: CorpusSource,
  sources = [sourceInput],
) {
  const source = corpusSourceSchema.parse(sourceInput);
  const { understanding } = source;
  const revision = computeSourceRevision(source);
  const frontmatter = corpusFrontmatterSchema.parse({
    id: source.id,
    titel: source.cover.processName,
    fachbereich: source.cover.department,
    status: "aktiv",
    bestaetigt_am: source.confirmedAt,
    qualitaet: source.confirmationQuality,
    quell_revision: revision,
    renderer_version: rendererVersion,
    offene_punkte:
      understanding.knowledgeGaps.length + understanding.conflicts.length,
  });
  const steps = [...understanding.steps]
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map(
      (step) =>
        `### ${step.order}. ${step.name}\n\n**Tätigkeit:** ${step.activity}\n\n**Eingaben:**\n${lines(step.inputs)}\n\n**Ausgaben:**\n${lines(step.outputs)}`,
    )
    .join("\n\n");
  const documents = [
    ...(understanding.informationSources.value ?? []),
    ...understanding.documentCoverage.map((item) => item.name),
  ];
  const open = [
    ...understanding.knowledgeGaps.map((item) => `- Offene Frage: ${item}`),
    ...understanding.conflicts.map((item) => `- Widerspruch: ${item}`),
  ];
  const quality =
    source.confirmationQuality === "complete"
      ? "Vollständig bestätigt"
      : "Mit offenen Punkten bestätigt";
  const markdown = `---\nid: ${yaml(frontmatter.id)}\ntitel: ${yaml(frontmatter.titel)}\nfachbereich: ${yaml(frontmatter.fachbereich)}\nstatus: aktiv\nbestaetigt_am: ${yaml(frontmatter.bestaetigt_am)}\nqualitaet: ${frontmatter.qualitaet}\nquell_revision: ${frontmatter.quell_revision}\nrenderer_version: ${rendererVersion}\noffene_punkte: ${frontmatter.offene_punkte}\n---\n\n# ${source.cover.processName}\n\n## Zweck und Ergebnis\n\n**Zweck:** ${fact(understanding.purpose.value)}\n\n**Ergebnis:** ${fact(understanding.outcome.value)}\n\n## Auslöser\n\n${fact(understanding.trigger.value)}\n\n## Geltungsbereich und Abgrenzung\n\n${fact(understanding.boundaries.value)}\n\n## Beteiligte und Rollen\n\n${lines(understanding.participants.value)}\n\n## Ablauf\n\n${steps}\n\n## Systeme\n\n${lines(understanding.systems.value)}\n\n## Informationsquellen und Dokumente\n\n${documents.length ? documents.map((item) => `- ${item}`).join("\n") : emptySection}\n\n## Kontrollen\n\n${lines(understanding.controls.value)}\n\n## Übergaben\n\n${lines(understanding.handoffs.value)}\n\n## Mengen und Zeiten\n\n${lines(understanding.volumeAndTime.value)}\n\n## Bekannte Schwachstellen\n\n${lines(understanding.painPoints.value)}\n\n## Verbesserungsziele\n\n${lines(understanding.improvementGoals.value)}\n\n## Offene Fragen und Widersprüche\n\n${open.length ? open.join("\n") : emptySection}\n\n## Quellen und Änderungshistorie\n\n- Quell-Prozess: ${source.id}\n- Bestätigungsdatum: ${source.confirmedAt}\n- Qualität: ${quality}\n`;
  const path = processPath(source, sources);
  return { path, pfad: path, frontmatter, markdown };
}

export function buildCatalog(sourcesInput: CorpusSource[]): Catalog {
  const sources = sourcesInput.map((source) =>
    corpusSourceSchema.parse(source),
  );
  return catalogSchema.parse(
    sources
      .map((source) => ({
        id: source.id,
        titel: source.cover.processName,
        slug: processPath(source, sources)
          .replace(/^prozesse\//, "")
          .replace(/\.md$/, ""),
        fachbereich: source.cover.department,
        systeme: [...(source.understanding.systems.value ?? [])].sort((a, b) =>
          a.localeCompare(b),
        ),
        quellProzessIds: [source.id],
        quellRevision: computeSourceRevision(source),
      }))
      .sort(
        (a, b) =>
          a.fachbereich.localeCompare(b.fachbereich) ||
          a.titel.localeCompare(b.titel) ||
          a.id.localeCompare(b.id),
      ),
  );
}

export function renderIndex(catalogInput: Catalog) {
  const catalog = catalogSchema.parse(catalogInput);
  const groups = new Map<string, CatalogEntry[]>();
  for (const entry of catalog)
    groups.set(entry.fachbereich, [
      ...(groups.get(entry.fachbereich) ?? []),
      entry,
    ]);
  const sections = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([department, entries]) =>
        `## ${department}\n\n${entries
          .sort(
            (a, b) =>
              a.titel.localeCompare(b.titel) || a.id.localeCompare(b.id),
          )
          .map(
            (entry) =>
              `- [${entry.titel}](./prozesse/${entry.slug}.md) — ${entry.id}`,
          )
          .join("\n")}`,
    )
    .join("\n\n");
  return corpusIndexSchema.parse(
    `# Prozessdokumentation\n\n${sections || emptySection}\n`,
  );
}

export function parseCorpusMarkdown(value: string) {
  const match = value.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match)
    throw new Error(
      "Die Dokumentationsdatei enthält kein gültiges Frontmatter.",
    );
  const fields = Object.fromEntries(
    match[1].split("\n").map((line) => {
      const separator = line.indexOf(":");
      if (separator < 1)
        throw new Error(
          "Die Dokumentationsdatei enthält ungültiges Frontmatter.",
        );
      const raw = line.slice(separator + 1).trim();
      return [
        line.slice(0, separator),
        raw.startsWith('"') ? JSON.parse(raw) : raw,
      ];
    }),
  );
  return corpusFrontmatterSchema.parse({
    ...fields,
    renderer_version: Number(fields.renderer_version),
    offene_punkte: Number(fields.offene_punkte),
  });
}
