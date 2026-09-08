import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { buildCodexDocumentContext } from "../packages/ai-runtime/src/codex-document-context.ts";

const scenarioRoot = resolve(
  "demo-data/szenarien/vertragskuendigung-sach/dokumente",
);

test("Codex document context supplies selected TXT and PDF contents without filesystem tools", async () => {
  const context = await buildCodexDocumentContext(
    [
      {
        path: resolve(scenarioRoot, "beispiel-kuendigungsanfrage.txt"),
        mediaType: "text/plain",
      },
      {
        path: resolve(
          scenarioRoot,
          "Arbeitsanweisung_Vertragskuendigung_Sach.pdf",
        ),
        mediaType: "application/pdf",
      },
    ],
    200_000,
  );

  expect(context).toContain("Vom System bereitgestellte Dokumentinhalte");
  expect(context).toContain("beispiel-kuendigungsanfrage.txt");
  expect(context).toContain("Kündigung Wohngebäude");
  expect(context).toContain("Arbeitsanweisung_Vertragskuendigung_Sach.pdf");
  expect(context).toContain("Vertragskündigung Sach");
  expect(context).not.toContain("technisch nicht bereitgestellt");
});

test("Codex document context marks a bounded document as truncated", async () => {
  const context = await buildCodexDocumentContext(
    [
      {
        path: resolve(scenarioRoot, "beispiel-kuendigungsanfrage.txt"),
        mediaType: "text/plain",
      },
    ],
    20,
  );

  expect(context).toContain("Extrahierte Zeichen: 20 (gekürzt)");
});
