import type { CorpusNode } from "./corpus-tree";
import { entryLabel, splitFrontmatter } from "./corpus-types";

/**
 * Suche über den Dokumentenbaum: Beschriftung und Fließtext.
 *
 * Rein und ohne React, damit sich das Verhalten ohne Oberfläche prüfen lässt.
 * Das Frontmatter bleibt außen vor — es ist Maschinenmetadatum, eine Suche
 * nach `quell_revision` darf keinen Treffer liefern.
 */

/** Vergleichsform für die Suche: deutsche Kleinschreibung ohne Randleerzeichen. */
export function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("de-DE");
}

export type CorpusSearchResult = {
  /** Beschnittener Baum: passende Dateien samt ihrer Elternordner. */
  nodes: CorpusNode[];
  /** Fundstellen im Fließtext je Dateipfad; ein reiner Titeltreffer zählt 0. */
  treffer: Map<string, number>;
  /** Zahl der gefundenen Dokumente. */
  gefunden: number;
  /** Zahl aller Dokumente im Baum. */
  gesamt: number;
};

export function filterCorpusTree(
  nodes: CorpusNode[],
  query: string,
  contents: ReadonlyMap<string, string>,
): CorpusSearchResult {
  const needle = normalized(query);
  const treffer = new Map<string, number>();
  const gesamt = countDocuments(nodes);
  if (!needle) return { nodes, treffer, gefunden: gesamt, gesamt };

  const gefiltert = prune(nodes, needle, contents, treffer);
  return { nodes: gefiltert, treffer, gefunden: treffer.size, gesamt };
}

function prune(
  nodes: CorpusNode[],
  needle: string,
  contents: ReadonlyMap<string, string>,
  treffer: Map<string, number>,
): CorpusNode[] {
  const result: CorpusNode[] = [];
  for (const node of nodes) {
    if (node.type === "tree") {
      const children = prune(node.children, needle, contents, treffer);
      if (children.length) result.push({ ...node, children });
      continue;
    }
    const imTitel = normalized(entryLabel(node.name)).includes(needle);
    const imText = countMatches(contents.get(node.path), needle);
    if (!imTitel && !imText) continue;
    treffer.set(node.path, imText);
    result.push(node);
  }
  return result;
}

/** Fundstellen im Fließtext eines Dokuments; ohne geladenen Inhalt null. */
function countMatches(source: string | undefined, needle: string): number {
  if (!source) return 0;
  const body = normalized(splitFrontmatter(source).body);
  let count = 0;
  let index = body.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = body.indexOf(needle, index + needle.length);
  }
  return count;
}

function countDocuments(nodes: CorpusNode[]): number {
  return nodes.reduce(
    (sum, node) =>
      sum + (node.type === "blob" ? 1 : countDocuments(node.children)),
    0,
  );
}

/** Alle Dateipfade des Baums — die Ladeliste für den Volltextindex. */
export function documentPaths(nodes: CorpusNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === "blob" ? [node.path] : documentPaths(node.children),
  );
}

/**
 * Zerlegt einen Text an den Fundstellen. Gerade Positionen sind unveränderter
 * Text, ungerade sind Treffer — so lässt sich daraus ohne weitere Logik eine
 * Folge aus Text und `<mark>` bauen.
 */
export function splitOnMatches(text: string, query: string): string[] {
  const needle = normalized(query);
  if (!needle) return [text];
  const haystack = text.toLocaleLowerCase("de-DE");
  const parts: string[] = [];
  let cursor = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    parts.push(
      text.slice(cursor, index),
      text.slice(index, index + needle.length),
    );
    cursor = index + needle.length;
    index = haystack.indexOf(needle, cursor);
  }
  parts.push(text.slice(cursor));
  return parts;
}
