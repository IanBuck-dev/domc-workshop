import { classNames } from "./class-names";

/**
 * Bildmarke der Zukunftswerkstatt: ein Z, das zugleich eine Treppe ist —
 * Schritt für Schritt vom heutigen Ablauf zum nächsten. Die Fläche nimmt die
 * Textfarbe an, damit die Marke überall zur Umgebung passt.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={classNames("brand-mark", className)}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M10 10h12L10 22h12"
        fill="none"
        stroke="var(--surface)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Bildmarke und Wortmarke, wie sie in der Kopfzeile und beim Anmelden stehen. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={classNames("brand-lockup", className)}>
      <BrandMark />
      <b>Zukunftswerkstatt</b>
    </span>
  );
}
