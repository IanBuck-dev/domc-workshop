/**
 * Herausnehmen eines Dokuments aus dem Viewer: Zwischenablage und Druck.
 *
 * Kopiert wird das gerenderte Dokument in zwei Formen — als HTML, damit Word
 * und Outlook Überschriften und Listen behalten, und als Klartext für alles
 * andere. Suchmarkierungen sind eine Sache der Oberfläche und gehören nicht in
 * die Zwischenablage.
 */

/** Zwischenablage-Nutzlast aus dem gerenderten Dokument, ohne Suchmarkierungen. */
export function copyPayload(
  html: string,
  text: string,
): { html: string; text: string } {
  return { html: html.replace(/<\/?mark\b[^>]*>/gi, ""), text: text.trim() };
}

export async function copyDocument(node: HTMLElement): Promise<void> {
  const { html, text } = copyPayload(node.innerHTML, node.innerText);
  const clipboard = navigator.clipboard;
  if (!clipboard) throw new Error("Die Zwischenablage ist nicht verfügbar.");
  try {
    if (typeof ClipboardItem === "undefined")
      throw new Error("no rich clipboard");
    await clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
  } catch {
    // Ohne formatierte Zwischenablage bleibt der Klartext — besser als nichts.
    await clipboard.writeText(text);
  }
}

/** Öffnet die Druckansicht des Browsers; das Layout steuert `@media print`. */
export function printDocument(): void {
  window.print();
}
