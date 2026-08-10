/**
 * Typen des Dokumentationskorpus, wie ihn `/api/corpus/*` ausliefert.
 *
 * Das Korpus ist ein abgeleitetes Read Model: die Oberfläche liest es
 * ausschließlich, einzige Schreibaktion ist die Rücknahme einer Änderung.
 * Git-Vokabular bleibt in dieser Schicht — ab der Oberfläche wird
 * ausschließlich Fachsprache verwendet (siehe `anlassLabel`).
 */

export type CorpusEntry = {
  name: string;
  path: string;
  type: "blob" | "tree";
  size: number;
};

/** Der Anlass einer Änderung — der Trailer `Anlass:` der Commit-Nachricht. */
export type CorpusAnlass = "bestaetigung" | "reconciliation" | "ruecknahme";

export type CorpusChangedFile = {
  status: string;
  path: string;
};

export type CorpusLogEntry = {
  sha: string;
  autor: string;
  datum: string;
  anlass: CorpusAnlass | null;
  prozessId: string | null;
  zusammenfassung: string;
  dateien: CorpusChangedFile[];
};

export type CorpusReconcileReport = {
  aktualisiert: number;
  entfernt: number;
  unveraendert: number;
  fehler: number;
};

export type SimilarProcess = {
  id: string;
  processName: string;
  department?: string;
};

const anlassLabels: Record<CorpusAnlass, string> = {
  bestaetigung: "Nach fachlicher Bestätigung",
  reconciliation: "Beim Abgleich der Dokumentation",
  ruecknahme: "Rücknahme einer Änderung",
};

/** Anlass in Fachsprache. Nie den Rohwert anzeigen. */
export function anlassLabel(anlass: CorpusAnlass | null): string {
  return anlass ? anlassLabels[anlass] : "Automatische Aktualisierung";
}

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Zeitpunkt einer Änderung, leer bei unlesbarem Datum. */
export function formatChangeDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `${dateFormat.format(date)} Uhr`;
}

/**
 * Beschriftung eines Baumeintrags: Dateiname ohne Endung, Bindestriche zu
 * Leerzeichen, erster Buchstabe groß. Datei- und Ordnernamen sind Slugs von
 * Prozessname bzw. Fachbereich — das reicht als Beschriftung, bis der gerenderte
 * Titel des Dokuments geladen ist.
 */
export function entryLabel(name: string): string {
  const spaced = name.replace(/\.md$/, "").replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Erste Überschrift des Dokuments, sonst der Dateiname. */
export function documentTitle(markdown: string, fallbackName: string): string {
  const heading = markdown
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .match(/^#\s+(.+)$/m);
  return heading ? heading[1].trim() : entryLabel(fallbackName);
}

/**
 * Trennt das Frontmatter vom Fließtext. Das Frontmatter ist Maschinenmetadatum
 * und wird nie roh angezeigt — die Oberfläche zeigt daraus nur ausgewählte
 * Felder in Fachsprache.
 */
export function splitFrontmatter(source: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { frontmatter: {}, body: source };
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    frontmatter[line.slice(0, separator).trim()] = line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return { frontmatter, body: source.slice(match[0].length) };
}
