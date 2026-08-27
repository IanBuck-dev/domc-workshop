import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("process detail module cards", () => {
  test("uses a stable workflow-step anatomy with visible locked actions", async () => {
    const source = await readFile(
      join(
        import.meta.dir,
        "..",
        "apps",
        "web",
        "src",
        "pages",
        "process-detail-page.tsx",
      ),
      "utf8",
    );

    for (const step of ["01", "02", "03", "04"])
      expect(source).toContain(`step="${step}"`);
    expect(source.indexOf("{step}")).toBeLessThan(
      source.indexOf('<h2 className="min-w-0 text-heading">{title}</h2>'),
    );
    expect(source).toContain('disabledActionLabel="Excel erstellen"');
    expect(source).toContain('disabledActionLabel="Starten"');
    expect(source).toContain('disabledActionLabel="Bewertung starten"');
    expect(source).toContain("<LockKeyhole /> {disabledActionLabel}");
    expect(source).toContain(
      'className="absolute right-5 bottom-4 flex h-9 justify-end"',
    );
    expect(source).toContain("px-5 pt-4 pb-17");
    expect(source).not.toContain("dark:");
  });
});
