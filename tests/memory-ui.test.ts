import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const sectionPath = join(
  process.cwd(),
  "apps/web/src/components/company-knowledge-section.tsx",
);

describe("settings UI for the learned company knowledge", () => {
  test("lives in its own settings section on the settings page", async () => {
    const page = await readFile(
      join(process.cwd(), "apps/web/src/pages/settings-page.tsx"),
      "utf8",
    );
    expect(page).toContain('<SettingsSection title="Gelerntes Firmenwissen">');
    expect(page).toContain("<CompanyKnowledgeSection />");
  });

  test("offers read-only topics, cleanup and reset in everyday German", async () => {
    const source = await readFile(sectionPath, "utf8");
    expect(source).toContain("Wissen aufräumen");
    expect(source).toContain("Alles vergessen");
    expect(source).toContain("Wirklich alles vergessen?");
    expect(source).toContain("lernt aus bestätigten Prozessaufnahmen");
    expect(source).toContain("zuletzt gelernt am");
    expect(source).toContain("api.consolidateMemory()");
    expect(source).toContain("api.forgetMemory()");
    expect(source).toContain("useMemoryConsolidation()");
    // Ein laufender Lauf darf nicht erneut gestartet werden; 409 bleibt ruhig.
    expect(source).toContain("disabled={running || starting}");
    expect(source).toContain("reason.status === 409");
    expect(source).toContain("Das Aufräumen läuft bereits.");
    // Keine Einzelbearbeitung, kein Modell-Jargon, keine Dateipfade.
    expect(source).not.toContain("memory/");
    expect(source).not.toContain(".md");
    expect(source).not.toMatch(/Gedächtnis|Prompt|Modell|Token/u);
  });

  test("keeps the skeleton vocabulary and light-mode-only styling", async () => {
    const source = await readFile(sectionPath, "utf8");
    expect(source).toContain('from "./ui/skeleton"');
    expect(source).toContain('aria-busy="true"');
    expect(source).toContain(
      'aria-label="Gelerntes Firmenwissen wird geladen"',
    );
    expect(source).not.toContain("dark:");
  });

  test("forwards the consolidation status from the event stream", async () => {
    const source = await readFile(
      join(process.cwd(), "apps/web/src/lib/process-events.tsx"),
      "utf8",
    );
    expect(source).toContain('source.addEventListener("memory-consolidation"');
    expect(source).toContain("export function useMemoryConsolidation()");
  });
});
