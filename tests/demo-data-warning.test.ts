import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  demoDataWarningDismissalStorageKey,
  dismissDemoDataWarning,
  isDemoDataWarningDismissed,
  type DemoDataWarningPreferenceStorage,
} from "../apps/web/src/lib/demo-data-warning-preference.ts";

function createStorage(
  values: Record<string, string> = {},
): DemoDataWarningPreferenceStorage {
  const data = new Map(Object.entries(values));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

describe("demo-data warning preference", () => {
  test("recognizes only the persisted dismissal value", () => {
    expect(isDemoDataWarningDismissed(createStorage())).toBe(false);
    expect(
      isDemoDataWarningDismissed(
        createStorage({ [demoDataWarningDismissalStorageKey]: "1" }),
      ),
    ).toBe(true);
    expect(
      isDemoDataWarningDismissed(
        createStorage({ [demoDataWarningDismissalStorageKey]: "dismissed" }),
      ),
    ).toBe(false);
    expect(
      isDemoDataWarningDismissed(
        createStorage({ "warning-dismissed-previous-instance": "1" }),
      ),
    ).toBe(false);
  });

  test("stores dismissal with the stable versioned key", () => {
    const writes: Array<[string, string]> = [];
    dismissDemoDataWarning({
      getItem: () => null,
      setItem: (key, value) => writes.push([key, value]),
    });

    expect(writes).toEqual([[demoDataWarningDismissalStorageKey, "1"]]);
  });

  test("fails safely when browser storage cannot be read or written", () => {
    const failingStorage: DemoDataWarningPreferenceStorage = {
      getItem: () => {
        throw new Error("storage read failed");
      },
      setItem: () => {
        throw new Error("storage write failed");
      },
    };

    expect(isDemoDataWarningDismissed(failingStorage)).toBe(false);
    expect(() => dismissDemoDataWarning(failingStorage)).not.toThrow();
  });
});

describe("demo-data warning UI contract", () => {
  test("uses the browser preference without health or session storage", async () => {
    const source = await readFile(
      join(process.cwd(), "apps/web/src/components/demo-data-warning.tsx"),
      "utf8",
    );

    expect(source).toContain("isDemoDataWarningDismissed");
    expect(source).toContain("dismissDemoDataWarning");
    expect(source).not.toContain("/api/health");
    expect(source).not.toContain("instanceId");
    expect(source).not.toContain("sessionStorage");
    expect(source).toContain(
      'aria-label="Hinweis dauerhaft in diesem Browser ausblenden"',
    );
  });

  test("discloses the local browser dismissal preference", async () => {
    const source = await readFile(
      join(process.cwd(), "apps/web/src/pages/privacy-page.tsx"),
      "utf8",
    );

    expect(source).toContain("Hinweis zur Verwendung von");
    expect(source).toContain("Demo-Daten dauerhaft ausblenden");
    expect(source).toContain("Löschen der Website-Daten");
  });
});
