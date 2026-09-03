import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { generateThirdPartyNotices } from "../scripts/generate-third-party-notices.ts";

const root = join(import.meta.dirname, "..");

describe("third-party notices", () => {
  test("the committed notice matches the production dependency closure", async () => {
    const committed = await readFile(
      join(root, "THIRD_PARTY_NOTICES.txt"),
      "utf8",
    );
    expect(committed).toBe(await generateThirdPartyNotices());
    expect(committed).toContain("@fontsource-variable/geist@");
    expect(committed).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(committed).toContain(
      "Apache License\n                           Version 2.0",
    );
    expect(committed).toContain("MIT License");
  });

  test("the imprint no longer carries a one-off font notice", async () => {
    const imprint = await readFile(
      join(root, "apps/web/src/pages/imprint-page.tsx"),
      "utf8",
    );
    expect(imprint).not.toContain("Schriftlizenz");
    expect(imprint).not.toContain("openfontlicense.org");
  });
});
