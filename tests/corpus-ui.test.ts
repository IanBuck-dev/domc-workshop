import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { CorpusTree } from "../apps/web/src/components/corpus-tree.tsx";
import { CorpusDocument } from "../apps/web/src/components/corpus-document.tsx";
import { CorpusHistory } from "../apps/web/src/components/corpus-history.tsx";
import { CorpusDiff } from "../apps/web/src/components/corpus-diff.tsx";
import {
  buildCorpusTree,
  directoryPaths,
  firstDocument,
} from "../apps/web/src/lib/corpus-tree.ts";
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
      }),
    );

    expect(markup).toContain("Beitragsinkasso");
    expect(markup).not.toContain(".md");
    expect(markup).toContain('aria-current="true"');
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
