import { cn } from "../../lib/utils";

/**
 * Bildmarke der Zukunftswerkstatt: ein Z, das zugleich eine Treppe ist —
 * Schritt für Schritt vom heutigen Ablauf zum nächsten. Die Fläche nimmt die
 * Textfarbe an, damit die Marke überall zur Umgebung passt.
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
      <path
        d="M10 10h12L10 22h12"
        fill="none"
        stroke="white"
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
    <span
      className={cn(
        "inline-flex items-center gap-2 text-lg font-bold tracking-tight",
        className,
      )}
    >
      <BrandMark />
      <b>Zukunftswerkstatt</b>
    </span>
  );
}
