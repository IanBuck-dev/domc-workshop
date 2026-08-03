import { PublicPageLayout } from "../components/public-page-layout";

export function PrivacyPage() {
  return (
    <PublicPageLayout>
      {(information) => (
        <article className="space-y-8 leading-7">
          <header className="space-y-3">
            <p className="text-eyebrow uppercase text-primary">
              Rechtliche Informationen
            </p>
            <h1 className="text-title sm:text-display">Datenschutzhinweise</h1>
            <p className="text-muted-foreground">
              Diese Hinweise erläutern die Datenverarbeitung in diesem
              Workshop-Prototyp.
            </p>
          </header>
          <PrivacySection title="1. Verantwortliche Stelle">
            <p>Verantwortlich für die Datenverarbeitung ist:</p>
            <address className="not-italic">
              {information.operatorName}
              <br />
              {information.serviceAddress.map((line) => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ))}
              <a
                className="font-medium text-primary hover:underline"
                href={`mailto:${information.contactEmail}`}
              >
                {information.contactEmail}
              </a>
            </address>
          </PrivacySection>
          <PrivacySection title="2. Zweck und Testdatenrahmen">
            <p>
              Die Anwendung dient ausschließlich der Durchführung von Workshops
              zur Erfassung und Analyse fiktiver, wirksam anonymisierter oder
              ausdrücklich freigegebener Testprozesse. Sie ist kein
              Produktionssystem. Bitte geben Sie keine echten Kunden-,
              Vertrags-, Schaden-, Gesundheits-, Beschäftigten- oder sonstigen
              vertraulichen Daten ein und laden Sie keine solchen Dateien hoch.
            </p>
          </PrivacySection>
          <PrivacySection title="3. Verarbeitete Daten">
            <p>
              Je nach Nutzung verarbeitet die Anwendung Anmeldedaten, technische
              Verbindungsdaten, eingegebene Namen und E-Mail-Adressen,
              Prozessbeschreibungen, Antworten, hochgeladene Dateien, erzeugte
              Prozessbilder, KI-Ausgaben sowie die zur Nachvollziehbarkeit
              geführten Änderungs- und Auditverläufe.
            </p>
            <p>
              Die Anwendung selbst verwendet keine Analyse-, Marketing- oder
              Trackingdienste.
            </p>
          </PrivacySection>
          <PrivacySection title="4. Zwecke und Rechtsgrundlagen">
            <p>
              Die Verarbeitung erfolgt zur sicheren Bereitstellung und
              Durchführung des angeforderten Workshop-Prototyps, zur
              Missbrauchsabwehr, zur Bearbeitung von Anfragen und zur
              technischen Nachvollziehbarkeit. Soweit personenbezogene Daten
              hierfür verarbeitet werden, beruht dies auf Art. 6 Abs. 1 lit. f
              DSGVO; das berechtigte Interesse besteht in der sicheren
              Durchführung und dem Betrieb des Testsystems. Soweit eine
              Verarbeitung auf einer Einwilligung beruht, gilt Art. 6 Abs. 1
              lit. a DSGVO.
            </p>
          </PrivacySection>
          <PrivacySection title="5. Hosting, Speicherung und Löschung">
            <p>
              Die Prozess-, Upload-, Ergebnis- und Auditdaten werden auf einem
              vom Betreiber verwalteten Raspberry Pi gespeichert. Der Dienst ist
              über einen Cloudflare Tunnel per HTTPS erreichbar. Cloudflare
              verarbeitet beim Verbindungsaufbau technische Daten nach den
              eigenen Datenschutzbestimmungen. Die Anwendung erzeugt keine
              Analyseprofile.
            </p>
            <p>{information.dataRetention}</p>
          </PrivacySection>
          <PrivacySection title="6. Sitzungsdaten und Browser-Speicher">
            <p>
              Für die Anmeldung setzt die Anwendung ein technisch notwendiges,
              signiertes und ausschließliches Sitzungs-Cookie. Es enthält den
              Benutzernamen und läuft nach acht Stunden ab. In den
              Browser-Einstellungen können zusätzlich lokale
              Konfigurationsüberschreibungen für neue Prozessaufnahmen
              gespeichert werden. Wenn Sie den Hinweis zur Verwendung von
              Demo-Daten dauerhaft ausblenden, speichert die Anwendung diese
              Einstellung ebenfalls lokal in Ihrem Browser. Sie können sie durch
              das Löschen der Website-Daten dieser Anwendung entfernen. Dies
              dient ausschließlich der ausdrücklich angeforderten Nutzung der
              Anwendung. Es werden keine nicht notwendigen Cookies eingesetzt.
            </p>
          </PrivacySection>
          <PrivacySection title="7. KI-Unterstützung durch Anthropic">
            <p>
              Eine Übermittlung an Anthropic erfolgt nur, wenn eine Nutzerin
              oder ein Nutzer eine KI-Aktion ausdrücklich startet. Dafür werden
              ausschließlich die für die jeweilige Aktion erforderlichen
              Prozessangaben, ausgewählten Uploads, eingefrorenen
              Konfigurationen und Antworten an die lokal authentifizierte
              Claude-CLI übergeben. Nicht ausgewählte Dateien und unabhängige
              Repository-Inhalte werden nicht übermittelt.
            </p>
            <p>
              Anthropic verarbeitet die übermittelten Inhalte als externer
              KI-Anbieter. Dabei kann eine Verarbeitung in Drittländern,
              insbesondere den USA, nicht ausgeschlossen werden. Es gelten
              zusätzlich die für das eingesetzte Claude-Konto vereinbarten
              Datenschutz- und Vertragsbedingungen von Anthropic. Der Prototyp
              ist deshalb nur für die in diesen Hinweisen beschriebenen
              Testdaten bestimmt.
            </p>
          </PrivacySection>
          <PrivacySection title="8. Empfänger">
            <p>
              Empfänger der Daten sind der Betreiber, soweit dies für Betrieb
              und Workshop erforderlich ist, Cloudflare für die Bereitstellung
              des abgesicherten Tunnelzugangs sowie Anthropic bei ausdrücklich
              gestarteten KI-Aktionen. Eine Weitergabe für Werbung oder Analyse
              findet nicht statt.
            </p>
          </PrivacySection>
          <PrivacySection title="9. Ihre Rechte">
            <p>
              Sie haben nach Maßgabe der DSGVO das Recht auf Auskunft,
              Berichtigung, Löschung, Einschränkung der Verarbeitung,
              Datenübertragbarkeit sowie Widerspruch gegen eine auf Art. 6 Abs.
              1 lit. f DSGVO gestützte Verarbeitung. Eine erteilte Einwilligung
              können Sie jederzeit mit Wirkung für die Zukunft widerrufen.
              Wenden Sie sich hierfür an {information.contactEmail}.
            </p>
          </PrivacySection>
          <PrivacySection title="10. Beschwerderecht">
            <p>
              Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde zu
              beschweren. Zuständig am Sitz des Betreibers ist:
            </p>
            <address className="not-italic">
              {information.dataProtectionAuthority.name}
              <br />
              {information.dataProtectionAuthority.address.map((line) => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ))}
              <a
                className="font-medium text-primary hover:underline"
                href={`mailto:${information.dataProtectionAuthority.email}`}
              >
                {information.dataProtectionAuthority.email}
              </a>
              <br />
              <a
                className="font-medium text-primary hover:underline"
                href={information.dataProtectionAuthority.website}
                target="_blank"
                rel="noreferrer"
              >
                Beschwerdeinformationen
              </a>
            </address>
          </PrivacySection>
          <p className="border-t pt-5 text-ui text-muted-foreground">
            Stand: {formatDate(information.lastUpdated)}
          </p>
        </article>
      )}
    </PublicPageLayout>
  );
}

function PrivacySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-heading">{title}</h2>
      {children}
    </section>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(
    new Date(`${value}T12:00:00`),
  );
}
