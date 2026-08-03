import { cn } from "../lib/utils";

/**
 * Bildmarke der Zukunftswerkstatt: eine Gruppe von Menschen. Eine
 * Zukunftswerkstatt ist ein moderiertes Format — der Wert entsteht dadurch, dass
 * die Leute aus dem Fachbereich im Raum sitzen, nicht durch das Werkzeug. Kein
 * Buchstabe, kein echtes Logo, bewusst schlicht.
 *
 * Die Geometrie ist aus dem lucide-Icon "users" (ISC) übernommen und hier fest
 * eingesetzt statt <Users /> zu rendern: eine Marke soll sich nicht ändern, wenn
 * lucide ein Icon überarbeitet, und das Favicon braucht dieselbe Form ohnehin
 * als Datei. Nicht "workflow" nehmen — das Icon steht in der Anwendung schon für
 * Prozessinhalte (process-list-page, process-detail-page).
 *
 * Das Icon liegt im 24er-Raster von lucide und wird über das transform in die
 * 32er-Kachel gesetzt. Strichstärke 2.6 im Icon-Raster ergibt effektiv rund 1.95
 * — bei einer Änderung in 16/24/32/56 px nebeneinander prüfen, nur die kleinste
 * Größe entscheidet.
 *
 * Dieselbe Form liegt ein zweites Mal als Datei unter
 * assets/zukunftswerkstatt-mark.svg, weil das Favicon in index.html eine echte
 * Datei braucht und keine React-Komponente rendern kann. Zwei Quellen derselben
 * Form driften auseinander; tests/brand-mark.test.ts vergleicht jedes
 * Geometrie-Attribut hier gegen die Datei und die Füllfarbe gegen --primary.
 * Ändert sich hier etwas, ändert sich die Datei mit.
 *
 * Die Fläche nimmt mit currentColor die Textfarbe an, damit die Marke überall
 * zur Umgebung passt — den festen Hex-Wert muss nur die Favicon-Datei führen.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-8 shrink-0 text-primary", className)}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <g
        transform="translate(7 7) scale(0.75)"
        fill="none"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <path d="M16 3.128a4 4 0 0 1 0 7.744" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <circle cx="9" cy="7" r="4" />
      </g>
    </svg>
  );
}

/**
 * Bildmarke und Wortmarke, wie sie in der Kopfzeile und beim Anmelden stehen.
 *
 * Die Wortmarke steht bewusst ausserhalb der semantischen Typo-Skala in
 * styles.css: eine Wortmarke ist ein Logo, keine Fliesstext-Ebene. Deshalb hier
 * feste Werte statt eines text-*-Tokens.
 *
 * Kein <b> um den Namen: <b> erbt `font-weight: bolder` aus dem UA-Stylesheet,
 * und `bolder` ist relativ — geerbte 700 werden dadurch zu 900. Bei Open Sans
 * fiel das nicht auf, weil dessen Gewichtsachse bei 800 endet und 900 still
 * geklemmt wurde. Geist reicht bis 900, dadurch wurde die Wortmarke schlagartig
 * zwei Stufen zu fett. Gewicht immer explizit setzen.
 *
 * Auch kein tracking-tight: Geist ist rund 5 % schmaler als Open Sans, die
 * negative Laufweite liess die Buchstaben zusammenlaufen.
 */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-lg font-bold",
        className,
      )}
    >
      <BrandMark />
      Zukunftswerkstatt
    </span>
  );
}
