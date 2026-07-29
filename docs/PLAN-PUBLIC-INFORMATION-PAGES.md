# Implementierungsplan: Öffentliche Informationsseiten und Footer

## Ziel

Der öffentlich erreichbare Workshop-Prototyp erhält einen dauerhaft sichtbaren,
kompakten Footer sowie drei ohne Anmeldung erreichbare Seiten:

1. `Impressum`;
2. `Datenschutz`;
3. `Nutzungshinweise`.

Die Seiten sind für den deutschen Workshop-Prototyp geschrieben. Sie machen
keine Aussage, dass die Anwendung für Produktivdaten, produktive
Versicherungsprozesse oder automatisierte Entscheidungen zugelassen ist.

## Feste Entscheidungen

- Die Seiten sind unter `/impressum`, `/datenschutz` und
  `/nutzungshinweise` öffentlich erreichbar; sie liegen nicht in `AppShell`
  und verlangen keine Anmeldung.
- Der Footer erscheint sowohl auf der Login-Seite als auch in der angemeldeten
  Anwendung. Er enthält exakt die drei Links sowie `Workshop-Prototyp`.
- Es gibt keinen Cookie-Banner, keine Analyse, kein Marketing, keine
  Einbettungen und keine externen Schrift- oder Script-Requests. Notwendige
  Sitzungs- und Browser-Speichermechanismen werden in der Datenschutzerklärung
  benannt.
- Die bestehenden, sichtbaren Testdatenwarnungen bleiben erhalten. Die
  Nutzungshinweise wiederholen den Testdatenrahmen nur als kurze, verbindliche
  Nutzungsregel.
- Persönliche Impressumsangaben werden nicht in den Repository-Quellcode
  geschrieben. Sie kommen aus einer lokalen, nicht versionierten
  Betreiber-Konfigurationsdatei.
- Vor dem öffentlichen Deployment muss der Betreiber die finalen Angaben
  einschließlich Cloudflare-, Server-Log-, Claude-/Anthropic- und
  Aufbewahrungsdaten prüfen. Der Plan erzeugt keine Rechtsberatung und keine
  behauptete Datenschutzkonformität.

## Erforderliche Betreiberangaben vor Release

In `.local/public-site-information.json` werden ausschließlich folgende
Release-Angaben gepflegt; die Datei wird in `.gitignore` aufgenommen:

```json
{
  "operatorName": "",
  "serviceAddress": ["", "", ""],
  "contactEmail": "",
  "vatId": null,
  "register": null,
  "supervisoryAuthority": null,
  "dataProtectionAuthority": "",
  "dataRetention": "",
  "lastUpdated": "YYYY-MM-DD"
}
```

- `operatorName`, vollständige zustellfähige `serviceAddress` und
  `contactEmail` sind für die Seite `Impressum` verpflichtend.
- `vatId`, `register` und `supervisoryAuthority` werden nur gerendert, wenn
  sie tatsächlich anwendbar sind.
- `dataProtectionAuthority`, `dataRetention` und `lastUpdated` sind für die
  Veröffentlichung der Datenschutzerklärung verpflichtend.
- Der Server verweigert den Release-Build mit einer klaren Fehlermeldung, wenn
  ein öffentlicher Release konfiguriert ist und Pflichtwerte fehlen. Der lokale
  Entwicklungsmodus erhält klar gekennzeichnete Platzhalter.

## Seiteninhalt

### `/impressum`

- Überschrift `Impressum`.
- Betreibername und vollständige zustellfähige Anschrift.
- E-Mail-Adresse als Kontaktmöglichkeit.
- Bedingte Blöcke für Umsatzsteuer-ID, Register und Registernummer,
  Aufsichtsbehörde sowie berufsrechtliche Angaben.
- Standdatum.

### `/datenschutz`

Die Seite wird als präzise Darstellung des konkreten Prototyps aufgebaut:

1. Verantwortliche Stelle und Kontakt;
2. Zweck und Testdatenbeschränkung;
3. Datenkategorien: Loginname, Sitzungsdaten, technische Zugriffs-/Serverlogs,
   eingegebene Kontaktangaben, Prozessangaben, Uploads und Auditverlauf;
4. Verarbeitung und Speicherort auf dem Betreiber-Raspberry-Pi;
5. Cloudflare Tunnel als Transport-/Infrastrukturkomponente;
6. Claude-/Anthropic-Verarbeitung nur nach ausdrücklich gestarteter
   KI-Aktion; die dafür übermittelten Eingaben und ausgewählten Dateien;
7. Browser-Speicher: notwendige Sitzungsdaten und lokale
   Konfigurationsüberschreibungen; keine Analytics- oder Marketing-Cookies;
8. tatsächliche Aufbewahrungs- und Löschregel aus `dataRetention`;
9. Empfänger, mögliche Drittlandübermittlungen und deren konkrete
   Rechtsgrundlage nach Betreiberprüfung;
10. Betroffenenrechte und Beschwerdemöglichkeit bei der hinterlegten
    Datenschutzaufsicht.

`docs/PRIVACY_NOTICE.de.md` bleibt als ausführliche interne Sicherheits- und
Workshop-Referenz erhalten. Die öffentliche Seite übernimmt keine Aussagen,
die nicht mit der realen Betriebsumgebung verifiziert wurden.

### `/nutzungshinweise`

- Workshop-Prototyp, kein Produktionssystem.
- Ausschließlich fiktive, anonymisierte oder ausdrücklich freigegebene
  Testdaten.
- Verbot realer Kunden-, Vertrags-, Schaden-, Gesundheits-, Beschäftigten- und
  anderer vertraulicher Daten.
- KI-Ausgaben sind Unterstützung und müssen fachlich geprüft werden.
- Keine automatisierte Leistungs-, Ablehnungs-, Auszahlungs-, Betrugs-,
  Kunden- oder Personalentscheidung.
- Hinweis, dass der gemeinsame Testzugang keine personenbezogene
  Berechtigungsverwaltung ist.

## Umsetzung

### 1. Öffentlichen Content und Release-Validierung hinzufügen

**Neue Dateien**

- `apps/web/src/lib/public-site-information.ts`
- `apps/server/src/public-site-information.ts`
- `.local/public-site-information.example.json`

**Änderungen**

- `.gitignore`
- `apps/server/src/index.ts` oder bestehender Konfigurations-Startpunkt
- `scripts/build-release.ts`

Der Server validiert die lokale Konfiguration mit einem strikten Zod-Schema
und stellt ausschließlich den für die öffentlichen Seiten benötigten,
nicht-sensiblen Inhalt über `GET /api/public-site-information` bereit.
Der Release-Build validiert die Pflichtfelder im Release-Modus. Keine Adresse,
E-Mail-Adresse oder Zugangsdaten werden in Tests, Fixtures oder Git
gespeichert.

### 2. Routen und Seiten bauen

**Neue Dateien**

- `apps/web/src/pages/imprint-page.tsx`
- `apps/web/src/pages/privacy-page.tsx`
- `apps/web/src/pages/usage-notice-page.tsx`
- `apps/web/src/components/public-page-layout.tsx`

**Änderungen**

- `apps/web/src/app.tsx`
- `apps/web/src/lib/api-client.ts`

`App` entscheidet vor der Authentifizierungsprüfung anhand des Pfads: Die drei
öffentlichen Seiten rendern immer `PublicPageLayout`; alle anderen Routen
behalten den bestehenden Authentifizierungsfluss. Die Seiten verwenden einen
maximal 3xl breiten, gut lesbaren Tailwind-Textcontainer mit Marke, Rücklink
zur Anmeldung und semantischen `h1`/`h2`-Abschnitten.

### 3. Footer zentralisieren

**Neue Datei**

- `apps/web/src/components/public-footer.tsx`

**Änderungen**

- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/pages/login-page.tsx`

`PublicFooter` enthält genau die Links `Impressum`, `Datenschutz` und
`Nutzungshinweise` sowie den statischen Text `Workshop-Prototyp`. Er ist auf
kleinen Bildschirmen umbruchfähig, tastaturbedienbar und ohne Anmeldung
erreichbar. `AppShell` ersetzt seinen bisherigen reinen Textfooter damit;
`LoginPage` platziert denselben Footer außerhalb der Login-Karte.

### 4. Datenschutz- und Betriebshinweise abgleichen

**Änderungen**

- `docs/PRIVACY_NOTICE.de.md`
- `docs/PI-DEPLOYMENT.md`
- `docs/OPERATOR_GUIDE.de.md`

Dokumentiert werden die überprüften Datenflüsse, der Speicherort, die reale
Löschroutine, die Cloudflare-Konfiguration sowie die konkrete Claude-/Anthropic
Verarbeitung. Widersprüche zwischen öffentlicher Erklärung, Deployment und
realer Konfiguration sind vor Deployment zu beseitigen.

## Tests und Verifikation

**Neue Tests**

- `tests/public-site-information.test.ts`
- `tests/public-pages-ui.test.tsx`

**Testfälle**

1. unvollständige Betreiberangaben schlagen im Release-Modus mit eindeutiger
   Fehlermeldung fehl;
2. vollständige Angaben werden serverseitig validiert und über den öffentlichen
   Endpunkt ausgeliefert;
3. keine persönliche Beispieladresse landet im Git-Track;
4. `/impressum`, `/datenschutz` und `/nutzungshinweise` sind ohne Session mit
   HTTP 200 erreichbar;
5. die drei Footerlinks existieren auf Login-Seite, App-Shell und öffentlichen
   Seiten und sind per Tastatur erreichbar;
6. die Datenschutzseite enthält die festgelegten Abschnitte zu Browser-Speicher,
   Pi, Cloudflare und Claude/Anthropic;
7. der Footer bleibt bei 1440 px und 768 px lesbar; die öffentlichen Seiten
   haben keine Console-Fehler und keine fehlgeschlagenen Netzwerkrequests.

**Abschlussbefehle**

```sh
./scripts/qa test tests/public-site-information.test.ts
./scripts/qa test tests/public-pages-ui.test.tsx
./scripts/qa all
bun run build
```

Vor einem öffentlichen Deployment prüft der Betreiber die dargestellten
Inhalte rechtlich und fachlich anhand der tatsächlichen Infrastruktur.
