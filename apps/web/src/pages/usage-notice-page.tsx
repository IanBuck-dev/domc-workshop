import { PublicPageLayout } from "../components/public-page-layout";

export function UsageNoticePage() {
  return (
    <PublicPageLayout>
      {(information) => (
        <article className="space-y-8 leading-7">
          <header className="space-y-3">
            <p className="text-eyebrow uppercase text-primary">
              Workshop-Prototyp
            </p>
            <h1 className="text-title sm:text-display">Nutzungshinweise</h1>
          </header>
          <section className="space-y-3">
            <h2 className="text-heading">Ausschließlich Testbetrieb</h2>
            <p>
              Diese Anwendung ist ein Workshop-Prototyp zur Erfassung von
              Geschäftsprozessen und zur Exploration möglicher KI-Potenziale.
              Sie ist kein Produktionssystem und nicht für operative
              Versicherungs-, Kunden- oder Personalprozesse freigegeben.
            </p>
          </section>
          <section className="space-y-3">
            <h2 className="text-heading">Nur zulässige Testdaten</h2>
            <p>
              Verwenden Sie ausschließlich fiktive, wirksam anonymisierte oder
              ausdrücklich freigegebene Testdaten. Geben Sie insbesondere keine
              echten Kunden-, Vertrags-, Schaden-, Gesundheits-, Beschäftigten-
              oder sonstigen vertraulichen Daten ein und laden Sie keine
              entsprechenden Dateien hoch.
            </p>
          </section>
          <section className="space-y-3">
            <h2 className="text-heading">KI-Ausgaben prüfen</h2>
            <p>
              Die KI-Unterstützung liefert unverbindliche Vorschläge und
              Strukturierungen. Alle Inhalte, Schlussfolgerungen und
              Prozessbilder müssen fachlich durch Menschen geprüft und bestätigt
              werden. Ausgaben dürfen nicht unmittelbar für Leistungs-,
              Ablehnungs-, Auszahlungs-, Betrugs-, Kunden- oder
              Personalentscheidungen verwendet werden.
            </p>
          </section>
          <section className="space-y-3">
            <h2 className="text-heading">Zugang und Löschung</h2>
            <p>
              Der gemeinsame Testzugang ist keine personenbezogene
              Berechtigungsverwaltung. Melden Sie sich nach der Nutzung ab.{" "}
              {information.dataRetention}
            </p>
            <p>
              Fragen zur Nutzung oder zur Löschung richten Sie bitte an{" "}
              <a
                className="font-medium text-primary hover:underline"
                href={`mailto:${information.contactEmail}`}
              >
                {information.contactEmail}
              </a>
              .
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(
    new Date(`${value}T12:00:00`),
  );
}
