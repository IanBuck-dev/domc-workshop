export function PublicFooter() {
  return (
    <footer className="mx-auto grid w-full max-w-7xl justify-items-center gap-2 px-4 py-8 text-center text-caption text-muted-foreground sm:px-6 lg:px-8">
      <span>Workshop-Prototyp · @Ian Buck 2026</span>
      <nav
        className="flex flex-wrap justify-center gap-x-4 gap-y-2"
        aria-label="Rechtliche Informationen"
      >
        <a className="hover:text-foreground hover:underline" href="/impressum">
          Impressum
        </a>
        <a
          className="hover:text-foreground hover:underline"
          href="/datenschutz"
        >
          Datenschutz
        </a>
        <a
          className="hover:text-foreground hover:underline"
          href="/nutzungshinweise"
        >
          Nutzungshinweise
        </a>
      </nav>
    </footer>
  );
}
