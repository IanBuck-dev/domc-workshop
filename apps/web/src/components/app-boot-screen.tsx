import { BrandMark } from "./brand-mark";

/**
 * Was zwischen dem Start der Anwendung und der ersten echten Seite steht,
 * während `api.session()` läuft.
 *
 * Bewusst ohne Spinner: die Sitzungsprüfung ist im Normalfall nach wenigen
 * Millisekunden durch, und etwas, das nur so kurz steht, sieht drehend nach
 * Störung aus statt nach Ladezustand.
 *
 * Die verzögerte Einblendung ist der eigentliche Trick. `fill-mode-backwards`
 * legt den Startzustand der Animation — Deckkraft 0 — schon über die
 * Verzögerung, die Fläche bleibt die ersten 200 ms also unsichtbar. Im
 * Normalfall sieht deshalb niemand irgendetwas; nur wenn die Prüfung wirklich
 * hängt, blendet eine ruhige Markenfläche auf. Dasselbe Muster passt überall
 * dort, wo ein Ladezustand meistens zu schnell ist, um gesehen zu werden.
 */
export function AppBootScreen() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-label="Anwendung wird geladen"
      className="flex min-h-screen animate-in items-center justify-center fill-mode-backwards p-8 delay-200 duration-300 fade-in"
    >
      <span className="sr-only">Anwendung wird geladen</span>
      <BrandMark className="size-12" />
    </main>
  );
}
