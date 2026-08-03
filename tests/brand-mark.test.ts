import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Die Bildmarke existiert zwangsläufig zweimal: als React-Komponente für die
 * Oberfläche (mit currentColor) und als Datei für das Favicon in index.html.
 * Diese Tests halten beide Fassungen zusammen — ohne sie fällt eine Änderung an
 * Form oder Markenfarbe erst auf, wenn jemand den Browser-Tab anschaut.
 */
const read = (path: string) =>
  readFile(join(process.cwd(), path), "utf8") as Promise<string>;

const COMPONENT = "apps/web/src/components/brand-mark.tsx";
const FAVICON = "apps/web/src/assets/zukunftswerkstatt-mark.svg";
const STYLES = "apps/web/src/styles.css";

/**
 * Jedes Geometrie-Attribut aus dem <svg> der Komponente, in SVG-Schreibweise.
 * Bewusst generisch statt einer festen Liste von Konstanten: so faellt auch ein
 * neu hinzugefuegter Pfad auf, an den beim Favicon niemand gedacht hat.
 */
function geometry(componentSource: string) {
  const svg = componentSource.slice(componentSource.indexOf("<svg"));
  return [
    ...svg.matchAll(
      /\b(d|cx|cy|r|rx|width|height|viewBox|transform|strokeWidth)="([^"]+)"/g,
    ),
  ].map(([, name, value]) =>
    name === "strokeWidth" ? `stroke-width="${value}"` : `${name}="${value}"`,
  );
}

describe("brand mark", () => {
  test("favicon file draws the same shape as the component", async () => {
    const [component, favicon] = await Promise.all([
      read(COMPONENT),
      read(FAVICON),
    ]);

    const attributes = geometry(component);
    // Absicherung gegen eine Regex, die ins Leere laeuft und alles durchwinkt.
    expect(attributes.length).toBeGreaterThan(10);
    for (const attribute of attributes) {
      expect(favicon).toContain(attribute);
    }
  });

  test("favicon fill matches --primary", async () => {
    const [favicon, styles] = await Promise.all([read(FAVICON), read(STYLES)]);

    const primary = styles.match(/^\s*--primary:\s*(#[0-9a-f]{6});/m)?.[1];
    expect(primary).toBeTruthy();
    expect(favicon).toContain(`fill="${primary}"`);
  });

  test("index.html wires up the favicon and a matching theme colour", async () => {
    const [html, styles] = await Promise.all([
      read("apps/web/index.html"),
      read(STYLES),
    ]);

    const primary = styles.match(/^\s*--primary:\s*(#[0-9a-f]{6});/m)?.[1];
    expect(html).toContain("zukunftswerkstatt-mark.svg");
    expect(html).toContain(`content="${primary}"`);
    expect(html).toContain('rel="apple-touch-icon" href="/icon-180.png"');
  });

  test("the favicon file is valid XML", async () => {
    const favicon = await read(FAVICON);

    // Ein doppeltes Minus in einem Kommentar macht die Datei ungueltig, und der
    // Browser zeigt dann gar kein Favicon an, ohne sich zu beschweren. Genau das
    // ist einmal passiert, weil im Kommentar eine CSS-Variable stand.
    const comments = favicon.match(/<!--[\s\S]*?-->/g) ?? [];
    expect(comments.length).toBeGreaterThan(0);
    for (const comment of comments) {
      expect(comment.slice(4, -3)).not.toContain("--");
    }
    expect(favicon).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  test("the generated PNGs are up to date with the SVG source", async () => {
    const [favicon, recorded] = await Promise.all([
      read(FAVICON),
      read("apps/web/src/assets/icon-source.sha256"),
    ]);

    const current = new Bun.CryptoHasher("sha256")
      .update(favicon)
      .digest("hex");
    // Schlaegt fehl, wenn die Marke geaendert wurde: `bun run icons` ausfuehren.
    expect(recorded.trim()).toBe(current);
  });
});
