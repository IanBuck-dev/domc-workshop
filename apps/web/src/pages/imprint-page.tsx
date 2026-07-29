import { PublicPageLayout } from "../components/public-page-layout";

export function ImprintPage() {
  return (
    <PublicPageLayout>
      {(information) => (
        <article className="space-y-8">
          <header className="space-y-3">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">
              Rechtliche Informationen
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Impressum
            </h1>
          </header>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Angaben gemäß § 5 DDG</h2>
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
              <h2 className="text-xl font-semibold">Umsatzsteuer-ID</h2>
              <p>{information.vatId}</p>
            </section>
          )}
          {information.register && (
            <section className="space-y-2">
              <h2 className="text-xl font-semibold">Registereintrag</h2>
              <p>{information.register}</p>
            </section>
          )}
          {information.supervisoryAuthority && (
            <section className="space-y-2">
              <h2 className="text-xl font-semibold">
                Zuständige Aufsichtsbehörde
              </h2>
              <p>{information.supervisoryAuthority}</p>
            </section>
          )}
          <p className="border-t pt-5 text-sm text-muted-foreground">
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
