import type { CorpusEntry } from "./corpus-types";

export type CorpusNode = {
  name: string;
  path: string;
  type: "blob" | "tree";
  size: number;
  children: CorpusNode[];
};

/**
 * Baut den Ordnerbaum aus der flachen Dateiliste des Korpus.
 *
 * Sortierung ist fest: Ordner vor Dateien, danach alphabetisch nach deutschem
 * Vergleich. Ein deterministischer Baum verhindert, dass die Auswahl in der
 * Oberfläche beim Neuladen springt.
 */
export function buildCorpusTree(entries: CorpusEntry[]): CorpusNode[] {
  const roots: CorpusNode[] = [];
  for (const entry of entries) {
    const segments = entry.path.split("/").filter(Boolean);
    let level = roots;
    segments.forEach((segment, index) => {
      const last = index === segments.length - 1;
      const path = segments.slice(0, index + 1).join("/");
      let node = level.find((candidate) => candidate.name === segment);
      if (!node) {
        node = {
          name: segment,
          path,
          type: last ? entry.type : "tree",
          size: last ? entry.size : 0,
          children: [],
        };
        level.push(node);
      }
      level = node.children;
    });
  }
  return sortNodes(roots);
}

function sortNodes(nodes: CorpusNode[]): CorpusNode[] {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
    return a.name.localeCompare(b.name, "de");
  });
  for (const node of nodes) sortNodes(node.children);
  return nodes;
}

/** Erste Datei im Baum — die Vorauswahl beim Öffnen der Seite. */
export function firstDocument(nodes: CorpusNode[]): CorpusNode | null {
  for (const node of nodes) {
    if (node.type === "blob") return node;
    const nested = firstDocument(node.children);
    if (nested) return nested;
  }
  return null;
}

/** Alle Ordnerpfade — der Baum startet vollständig aufgeklappt. */
export function directoryPaths(nodes: CorpusNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === "tree" ? [node.path, ...directoryPaths(node.children)] : [],
  );
}
