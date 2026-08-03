export const demoDataWarningDismissalStorageKey =
  "claims-ai.demo-data-warning.dismissed.v1";

export type DemoDataWarningPreferenceStorage = Pick<
  Storage,
  "getItem" | "setItem"
>;

function getBrowserStorage(): DemoDataWarningPreferenceStorage | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

export function isDemoDataWarningDismissed(
  storage?: DemoDataWarningPreferenceStorage,
): boolean {
  try {
    return (
      (storage ?? getBrowserStorage())?.getItem(
        demoDataWarningDismissalStorageKey,
      ) === "1"
    );
  } catch {
    return false;
  }
}

export function dismissDemoDataWarning(
  storage?: DemoDataWarningPreferenceStorage,
): void {
  try {
    (storage ?? getBrowserStorage())?.setItem(
      demoDataWarningDismissalStorageKey,
      "1",
    );
  } catch {
    // The warning remains dismissed for this page even when storage is unavailable.
  }
}
