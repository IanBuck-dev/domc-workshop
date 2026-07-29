import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadPublicSiteInformation } from "../apps/server/src/public-site-information.ts";

const paths: string[] = [];

afterEach(async () => {
  delete process.env.PUBLIC_SITE_INFORMATION_PATH;
  await Promise.all(
    paths.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("public site information", () => {
  test("loads complete public operator information from the configured local file", async () => {
    const root = await mkdtemp(join(tmpdir(), "public-site-information-"));
    paths.push(root);
    const path = join(root, "public-site-information.json");
    process.env.PUBLIC_SITE_INFORMATION_PATH = path;
    await writeFile(
      path,
      JSON.stringify({
        operatorName: "Max Mustermann",
        serviceAddress: ["Musterstraße 1", "20095 Hamburg", "Deutschland"],
        contactEmail: "kontakt@example.de",
        vatId: null,
        register: null,
        supervisoryAuthority: null,
        dataProtectionAuthority: {
          name: "Hamburgische Datenschutzaufsicht",
          address: ["Musterweg 1", "20095 Hamburg", "Deutschland"],
          email: "aufsicht@example.de",
          website: "https://example.de/beschwerde",
        },
        dataRetention: "Nach Ende des Workshops löschen.",
        lastUpdated: "2026-07-30",
      }),
    );

    await expect(loadPublicSiteInformation()).resolves.toMatchObject({
      operatorName: "Max Mustermann",
      contactEmail: "kontakt@example.de",
    });
  });

  test("rejects incomplete public operator information", async () => {
    const root = await mkdtemp(join(tmpdir(), "public-site-information-"));
    paths.push(root);
    const path = join(root, "public-site-information.json");
    process.env.PUBLIC_SITE_INFORMATION_PATH = path;
    await writeFile(path, JSON.stringify({ operatorName: "" }));
    await expect(loadPublicSiteInformation()).rejects.toThrow();
  });
});
