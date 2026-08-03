/**
 * Erzeugt die PNG-Varianten der Bildmarke aus der SVG-Quelle.
 *
 * Warum ueberhaupt PNGs: das SVG-Favicon reicht fuer jeden aktuellen Browser,
 * aber iOS ignoriert SVG beim Ablegen auf dem Home-Bildschirm und braucht ein
 * apple-touch-icon als PNG. Ohne das bekommt die Anwendung dort einen
 * Screenshot der Seite statt der Marke.
 *
 * Warum headless Chrome und keine Bibliothek: jeder SVG-Rasterizer aus npm
 * bringt entweder native Abhaengigkeiten mit (sharp, resvg) oder eine
 * System-Bibliothek (cairo). Fuer drei Dateien, die sich fast nie aendern, ist
 * das zu teuer. Chrome ist auf jedem Entwicklungsrechner ohnehin vorhanden und
 * rendert exakt das, was der Browser spaeter auch anzeigt.
 *
 * Der Umweg ueber eine HTML-Seite ist noetig: laedt man das SVG direkt, skaliert
 * Chrome es auf die Fenstergroesse und der Rand des Dokuments schneidet die
 * Marke an. Die Seite setzt margin 0 und zeichnet das SVG in exakter Groesse.
 *
 * Aufruf: bun run icons
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SOURCE = "apps/web/src/assets/zukunftswerkstatt-mark.svg";
const OUTPUT_DIRECTORY = "apps/web/public";
/**
 * 180 ist die Groesse, die iOS fuer das apple-touch-icon erwartet; 512 deckt
 * Android und alles ab, was sich selbst herunterskaliert. Kleinere Groessen
 * bewusst nicht: dafuer ist das SVG da, und ein 32er PNG saehe schlechter aus
 * als das gerenderte SVG.
 */
const SIZES = [180, 512] as const;

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const svg = await Bun.file(SOURCE).text();
if (!svg.includes("<svg")) {
  console.error(`${SOURCE} enthaelt kein SVG.`);
  process.exit(1);
}

const workspace = await mkdtemp(join(tmpdir(), "zw-icons-"));
try {
  for (const size of SIZES) {
    const page = join(workspace, `icon-${size}.html`);
    await writeFile(
      page,
      `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:transparent}
svg{display:block;width:${size}px;height:${size}px}</style>
${svg}`,
    );

    const output = join(OUTPUT_DIRECTORY, `icon-${size}.png`);
    const chrome = Bun.spawn(
      [
        CHROME,
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        "--default-background-color=00000000",
        `--window-size=${size},${size}`,
        `--screenshot=${output}`,
        `file://${page}`,
      ],
      { stdout: "ignore", stderr: "pipe" },
    );
    if (await chrome.exited) {
      console.error(await new Response(chrome.stderr).text());
      console.error(
        `Chrome nicht gefunden oder fehlgeschlagen. Pfad ueber CHROME_PATH setzen.`,
      );
      process.exit(1);
    }
    console.log(`${output} (${size}x${size})`);
  }
  /**
   * Pruefsumme der Quelle mitschreiben. Ein PNG laesst sich nicht gegen das SVG
   * vergleichen, ohne es neu zu rendern — dafuer ist ein Test zu langsam. Der
   * Hash macht daraus einen Stringvergleich: tests/brand-mark.test.ts schlaegt
   * an, wenn jemand die Marke aendert und vergisst, `bun run icons` laufen zu
   * lassen.
   */
  await Bun.write(
    "apps/web/src/assets/icon-source.sha256",
    `${new Bun.CryptoHasher("sha256").update(svg).digest("hex")}\n`,
  );
} finally {
  await rm(workspace, { recursive: true, force: true });
}
