const businessCode = /^([A-Z]{2,8}-\d{2,4})\s*·\s*/u;

/** The optional business code stays part of the process name, never storage. */
export function businessProcessCode(processName: string) {
  return processName.trim().match(businessCode)?.[1] ?? null;
}

/** Stable, user-facing file names must not expose a technical process ID. */
export function safeProcessArtifactFilename(
  prefix: string,
  processName: string,
) {
  const segment = (value: string) =>
    value
      .trim()
      .replace(/ß/g, "ss")
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/Ä/g, "Ae")
      .replace(/Ö/g, "Oe")
      .replace(/Ü/g, "Ue")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100);
  const safePrefix = segment(prefix);
  const code = businessProcessCode(processName);
  const safeName = code
    ? `${code}_${segment(processName.replace(businessCode, ""))}`
    : segment(processName);
  if (!safePrefix || !safeName)
    throw new Error(
      "Der Prozessname kann nicht als Dateiname verwendet werden.",
    );
  return `${safePrefix}_${safeName}.xlsx`;
}
