import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { CorpusTree } from "../apps/web/src/components/corpus-tree.tsx";
import { CorpusDocument } from "../apps/web/src/components/corpus-document.tsx";
import { CorpusHistory } from "../apps/web/src/components/corpus-history.tsx";
import { CorpusDiff } from "../apps/web/src/components/corpus-diff.tsx";
import {
  ancestorPaths,
  buildCorpusTree,
  directoryPaths,
  firstDocument,
} from "../apps/web/src/lib/corpus-tree.ts";
import {
  filterCorpusTree,
  documentPaths,
  splitOnMatches,
} from "../apps/web/src/lib/corpus-search.ts";
import { copyPayload } from "../apps/web/src/lib/corpus-export.ts";
import {
  corpusTreeCollapsedStorageKey,
  loadCollapsedFolders,
  saveCollapsedFolders,
  type CorpusTreeStorage,
} from "../apps/web/src/lib/corpus-tree-preference.ts";
import {
  anlassLabel,
  documentTitle,
  entryLabel,
  splitFrontmatter,
} from "../apps/web/src/lib/corpus-types.ts";
import type {
  CorpusEntry,
  CorpusLogEntry,
} from "../apps/web/src/lib/corpus-types.ts";

const entries: CorpusEntry[] = [
  { name: "index.md", path: "index.md", type: "blob", size: 120 },
  {
    name: "schaden-erstaufnahme.md",
    path: "prozesse/schaden-leistung/schaden-erstaufnahme.md",
    type: "blob",
    size: 2400,
  },
  {
    name: "beitragsinkasso.md",
    path: "prozesse/betrieb/beitragsinkasso.md",
    type: "blob",
    size: 1800,
  },
];

const document = `---
id: PROC-0007
titel: Schaden-Erstaufnahme
fachbereich: Schaden und Leistung
status: aktiv
qualitaet: with_gaps
quell_revision: 4f2b91c
offene_punkte: 2
---

# Schaden-Erstaufnahme

## Zweck und Ergebnis

Der Prozess nimmt gemeldete Schäden auf.
`;

describe("Korpus-Baum", () => {
  test("gruppiert Dateien nach Ordner, Ordner zuerst und alphabetisch", () => {
    const tree = buildCorpusTree(entries);

    expect(tree.map((node) => node.name)).toEqual(["prozesse", "index.md"]);
    expect(tree[0]!.children.map((node) => node.name)).toEqual([
      "betrieb",
      "schaden-leistung",
    ]);
    expect(directoryPaths(tree)).toEqual([
      "prozesse",
      "prozesse/betrieb",
      "prozesse/schaden-leistung",
    ]);
  });

  test("wählt die erste Datei im Baum vor", () => {
    expect(firstDocument(buildCorpusTree(entries))?.path).toBe(
      "prozesse/betrieb/beitragsinkasso.md",
    );
  });

  test("beschriftet Einträge fachlich statt mit dem Dateinamen", () => {
    expect(entryLabel("schaden-erstaufnahme.md")).toBe("Schaden erstaufnahme");

    const markup = renderToStaticMarkup(
      createElement(CorpusTree, {
        nodes: buildCorpusTree(entries),
        selectedPath: "prozesse/betrieb/beitragsinkasso.md",
        onSelect: () => {},
        collapsed: new Set<string>(),
        onToggleFolder: () => {},
      }),
    );

    expect(markup).toContain("Beitragsinkasso");
    expect(markup).not.toContain(".md");
    expect(markup).toContain('aria-current="true"');
  });

  test("verbirgt die Kinder eines zugeklappten Ordners", () => {
    const nodes = buildCorpusTree(entries);
    const render = (collapsed: Set<string>) =>
      renderToStaticMarkup(
        createElement(CorpusTree, {
          nodes,
          selectedPath: "",
          onSelect: () => {},
          collapsed,
          onToggleFolder: () => {},
        }),
      );

    const offen = render(new Set());
    expect(offen).toContain("Beitragsinkasso");
    expect(offen).toContain('aria-expanded="true"');

    const zu = render(new Set(["prozesse"]));
    expect(zu).not.toContain("Beitragsinkasso");
    expect(zu).not.toContain("Betrieb");
    expect(zu).toContain("Prozesse");
    expect(zu).toContain('aria-expanded="false"');
  });

  test("nennt die Elternordner eines Dokuments", () => {
    expect(ancestorPaths("prozesse/betrieb/beitragsinkasso.md")).toEqual([
      "prozesse",
      "prozesse/betrieb",
    ]);
    expect(ancestorPaths("index.md")).toEqual([]);
  });
});

describe("Klappzustand im Browserspeicher", () => {
  function createStorage(
    values: Record<string, string> = {},
  ): CorpusTreeStorage {
    const data = new Map(Object.entries(values));
    return {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
    };
  }

  test("behält die eingeklappten Ordner über einen Neuaufbau", () => {
    const storage = createStorage();
    saveCollapsedFolders(["prozesse/betrieb", "prozesse"], storage);
    expect(loadCollapsedFolders(storage)).toEqual([
      "prozesse",
      "prozesse/betrieb",
    ]);
  });

  test("startet aufgeklappt, wenn nichts oder Unlesbares gespeichert ist", () => {
    expect(loadCollapsedFolders(createStorage())).toEqual([]);
    expect(
      loadCollapsedFolders(
        createStorage({ [corpusTreeCollapsedStorageKey]: "{kaputt" }),
      ),
    ).toEqual([]);
    expect(
      loadCollapsedFolders(
        createStorage({ [corpusTreeCollapsedStorageKey]: '{"a":1}' }),
      ),
    ).toEqual([]);
  });
});

describe("Suche in der Dokumentation", () => {
  const nodes = buildCorpusTree(entries);
  const contents = new Map([
    [
      "prozesse/betrieb/beitragsinkasso.md",
      "---\nid: PROC-0002\nquell_revision: 4f2b91c\n---\n\n# Beitragsinkasso\n\nEine Rücklastschrift wird geprüft. Die Rücklastschrift geht an den Vertrieb.\n",
    ],
    ["prozesse/schaden-leistung/schaden-erstaufnahme.md", document],
  ]);

  test("findet ein Dokument über seinen Titel, auch ohne geladenen Inhalt", () => {
    const result = filterCorpusTree(nodes, "erstaufnahme", new Map());

    expect(result.gefunden).toBe(1);
    expect(result.gesamt).toBe(3);
    expect(result.nodes.map((node) => node.name)).toEqual(["prozesse"]);
    expect(result.nodes[0]!.children.map((node) => node.name)).toEqual([
      "schaden-leistung",
    ]);
  });

  test("findet einen Begriff, der nur im Fließtext steht, und zählt die Stellen", () => {
    const result = filterCorpusTree(nodes, "Rücklastschrift", contents);

    expect(result.gefunden).toBe(1);
    expect(result.treffer.get("prozesse/betrieb/beitragsinkasso.md")).toBe(2);
  });

  test("sucht nie im Frontmatter", () => {
    expect(filterCorpusTree(nodes, "quell_revision", contents).gefunden).toBe(
      0,
    );
    expect(filterCorpusTree(nodes, "4f2b91c", contents).gefunden).toBe(0);
  });

  test("achtet nicht auf Groß- und Kleinschreibung", () => {
    expect(filterCorpusTree(nodes, "SCHÄDEN", contents).gefunden).toBe(1);
    expect(filterCorpusTree(nodes, "  ", contents).gefunden).toBe(3);
  });

  test("liefert alle Dateipfade für den Volltextindex", () => {
    expect(documentPaths(nodes)).toEqual([
      "prozesse/betrieb/beitragsinkasso.md",
      "prozesse/schaden-leistung/schaden-erstaufnahme.md",
      "index.md",
    ]);
  });

  test("zerlegt einen Text an den Fundstellen", () => {
    expect(splitOnMatches("Die Rücklastschrift", "rück")).toEqual([
      "Die ",
      "Rück",
      "lastschrift",
    ]);
    expect(splitOnMatches("Ohne Treffer", "")).toEqual(["Ohne Treffer"]);
  });
});

describe("Herausnehmen eines Dokuments", () => {
  test("entfernt die Suchmarkierungen aus der Zwischenablage", () => {
    const { html, text } = copyPayload(
      '<p>Die <mark class="rounded">Rücklastschrift</mark> wird geprüft.</p>',
      "  Die Rücklastschrift wird geprüft.  ",
    );

    expect(html).toBe("<p>Die Rücklastschrift wird geprüft.</p>");
    expect(html).not.toContain("mark");
    expect(text).toBe("Die Rücklastschrift wird geprüft.");
  });
});

describe("Korpus-Dokument", () => {
  test("zeigt das Frontmatter nie roh, sondern als fachliche Angabe", () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(CorpusDocument, { source: document }),
      ),
    );

    expect(markup).toContain("Schaden und Leistung");
    expect(markup).toContain("Bestätigt mit offenen Punkten");
    expect(markup).toContain("2 offene Punkte");
    expect(markup).toContain('href="/processes/PROC-0007"');
    expect(markup).toContain("Zweck und Ergebnis");
    // Quellrevision und Rendererversion sind Maschinenmetadaten.
    expect(markup).not.toContain("4f2b91c");
    expect(markup).not.toContain("quell_revision");
  });

  test("hebt die Fundstellen der Suche hervor, ohne Metadaten zu zeigen", () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(CorpusDocument, { source: document, query: "schäden" }),
      ),
    );

    expect(markup).toContain("<mark>Schäden</mark>");
    expect(markup).toContain("Der Prozess nimmt gemeldete");
    expect(markup).not.toContain("quell_revision");
    // Der Baumknoten von react-markdown darf nicht als Attribut im Markup
    // landen; sonst steht er auch im kopierten HTML.
    expect(markup).not.toContain("node=");
  });

  test("trennt Frontmatter und Fließtext", () => {
    const { frontmatter, body } = splitFrontmatter(document);

    expect(frontmatter.id).toBe("PROC-0007");
    expect(frontmatter.offene_punkte).toBe("2");
    expect(body.startsWith("\n# Schaden-Erstaufnahme")).toBe(true);
    expect(documentTitle(document, "schaden-erstaufnahme.md")).toBe(
      "Schaden-Erstaufnahme",
    );
  });
});

describe("Änderungsverlauf", () => {
  const log: CorpusLogEntry[] = [
    {
      sha: "b2c3d4e",
      autor: "Prozessdokumentation",
      datum: "2026-08-08T09:15:00.000Z",
      anlass: "bestaetigung",
      prozessId: "PROC-0007",
      zusammenfassung: "Dokumentation aktualisiert: Schaden-Erstaufnahme",
      dateien: [
        {
          status: "M",
          path: "prozesse/schaden-leistung/schaden-erstaufnahme.md",
        },
      ],
    },
    {
      sha: "a1b2c3d",
      autor: "Prozessdokumentation",
      datum: "2026-08-01T08:00:00.000Z",
      anlass: "reconciliation",
      prozessId: null,
      zusammenfassung: "Reconciliation",
      dateien: [],
    },
  ];

  test("nennt den Anlass in Fachsprache und zeigt kein Git-Vokabular", () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(CorpusHistory, {
          entries: log,
          loading: false,
          documentPath: "prozesse/schaden-leistung/schaden-erstaufnahme.md",
          onReverted: () => {},
        }),
      ),
    );

    expect(markup).toContain("Nach fachlicher Bestätigung");
    expect(markup).toContain("Beim Abgleich der Dokumentation");
    expect(markup).toContain("Änderung zurücknehmen");
    expect(markup).toContain('href="/processes/PROC-0007"');
    expect(markup).not.toContain("b2c3d4e");
    for (const word of ["Commit", "Branch", "Repository", "Revert"])
      expect(markup).not.toContain(word);
  });

  test("beschreibt den leeren Verlauf statt ihn wegzulassen", () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(CorpusHistory, {
          entries: [],
          loading: false,
          documentPath: "index.md",
          onReverted: () => {},
        }),
      ),
    );

    expect(markup).toContain("noch keine Änderung verzeichnet");
  });

  test("übersetzt jeden Anlass", () => {
    expect(anlassLabel("ruecknahme")).toBe("Rücknahme einer Änderung");
    expect(anlassLabel(null)).toBe("Automatische Aktualisierung");
  });
});

describe("Änderungsvorschau", () => {
  const diff = `diff --git a/prozesse/betrieb/beitragsinkasso.md b/prozesse/betrieb/beitragsinkasso.md
index 1111111..2222222 100644
--- a/prozesse/betrieb/beitragsinkasso.md
+++ b/prozesse/betrieb/beitragsinkasso.md
@@ -1,3 +1,3 @@
 ## Auslöser
-Eine Lastschrift wird zurückgegeben.
+Eine Lastschrift wird von der Bank zurückgegeben.
`;

  test("stellt hinzugefügte und entfernte Zeilen dar", () => {
    const markup = renderToStaticMarkup(createElement(CorpusDiff, { diff }));

    expect(markup).toContain("Eine Lastschrift wird zurückgegeben.");
    expect(markup).toContain(
      "Eine Lastschrift wird von der Bank zurückgegeben.",
    );
    expect(markup).toContain("diff-code-delete");
    expect(markup).toContain("diff-code-insert");
  });

  test("sagt es ausdrücklich, wenn sich inhaltlich nichts geändert hat", () => {
    expect(
      renderToStaticMarkup(createElement(CorpusDiff, { diff: "" })),
    ).toContain("keinen inhaltlichen Unterschied");
  });
});
