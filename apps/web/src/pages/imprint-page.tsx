import { PublicPageLayout } from "../components/public-page-layout";

export function ImprintPage() {
  return (
    <PublicPageLayout>
      {(information) => (
        <article className="space-y-8">
          <header className="space-y-3">
            <p className="text-eyebrow uppercase text-primary">
              Rechtliche Informationen
            </p>
            <h1 className="text-title sm:text-display">Impressum</h1>
          </header>
          <section className="space-y-3">
            <h2 className="text-heading">Angaben gemäß § 5 DDG</h2>
            <Address
              name={information.operatorName}
              address={information.serviceAddress}
            />
            <p>
              <a
                className="font-medium text-primary hover:underline"
                href={`mailto:${information.contactEmail}`}
              >
                {information.contactEmail}
              </a>
            </p>
          </section>
          {information.vatId && (
            <section className="space-y-2">
              <h2 className="text-heading">Umsatzsteuer-ID</h2>
              <p>{information.vatId}</p>
            </section>
          )}
          {information.register && (
            <section className="space-y-2">
              <h2 className="text-heading">Registereintrag</h2>
              <p>{information.register}</p>
            </section>
          )}
          {information.supervisoryAuthority && (
            <section className="space-y-2">
              <h2 className="text-heading">Zuständige Aufsichtsbehörde</h2>
              <p>{information.supervisoryAuthority}</p>
            </section>
          )}
          {/* OFL-1.1 requires the copyright and licence notice to travel with
              the font files, which Vite emits into the bundle. This is where
              that notice lives — keep it in sync with --font-sans in styles.css. */}
          <section className="space-y-2">
            <h2 className="text-heading">Schriftlizenz</h2>
            <p className="text-ui text-muted-foreground">
              Diese Anwendung verwendet die Schriftart Geist, Copyright 2024 The
              Geist Project Authors, lizenziert unter der SIL Open Font License
              1.1.{" "}
              <a
                className="font-medium text-primary hover:underline"
                href="https://openfontlicense.org"
                rel="noreferrer noopener"
                target="_blank"
              >
                Lizenztext
              </a>
            </p>
          </section>
          <p className="border-t pt-5 text-ui text-muted-foreground">
            Stand: {formatDate(information.lastUpdated)}
          </p>
        </article>
      )}
    </PublicPageLayout>
  );
}

function Address({
  name,
  address,
}: {
  name: string;
  address: [string, string, string];
}) {
  return (
    <address className="not-italic">
      {name}
      <br />
      {address.map((line) => (
        <span key={line}>
          {line}
          <br />
        </span>
      ))}
    </address>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(
    new Date(`${value}T12:00:00`),
  );
}
