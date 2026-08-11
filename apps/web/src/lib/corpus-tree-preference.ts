/**
 * Klappzustand des Dokumentenbaums im Browserspeicher.
 *
 * Gespeichert werden die **eingeklappten** Ordner, nicht die offenen. Damit
 * bleibt „alles offen" der Ausgangszustand, und ein neu hinzugekommener
 * Fachbereich erscheint aufgeklappt statt unsichtbar hinter einem Zustand, den
 * niemand gesetzt hat.
 */
export const corpusTreeCollapsedStorageKey =
  "claims-ai.corpus-tree.collapsed.v1";

export type CorpusTreeStorage = Pick<Storage, "getItem" | "setItem">;

function getBrowserStorage(): CorpusTreeStorage | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

/** Eingeklappte Ordnerpfade; bei fehlendem oder unlesbarem Eintrag leer. */
export function loadCollapsedFolders(storage?: CorpusTreeStorage): string[] {
  try {
    const raw = (storage ?? getBrowserStorage())?.getItem(
      corpusTreeCollapsedStorageKey,
    );
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    // Ein beschädigter Eintrag darf die Seite nicht blockieren — der Baum
    // startet dann eben vollständig aufgeklappt.
    return [];
  }
}

export function saveCollapsedFolders(
  paths: string[],
  storage?: CorpusTreeStorage,
): void {
  try {
    (storage ?? getBrowserStorage())?.setItem(
      corpusTreeCollapsedStorageKey,
      JSON.stringify([...paths].sort()),
    );
  } catch {
    // Ohne Speicher gilt der Zustand nur für diese Sitzung.
  }
}
