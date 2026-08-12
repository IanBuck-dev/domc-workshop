import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("PDD export UI", () => {
  test("keeps the German PDD action and download handling in the detail page", async () => {
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
    expect(source).toContain("PDD-Export");
    expect(source).toContain("Wird erstellt …");
    expect(source).toContain("URL.createObjectURL");
    expect(source).not.toContain("dark:");
  });
});
