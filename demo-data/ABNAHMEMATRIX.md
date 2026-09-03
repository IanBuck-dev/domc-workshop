# Abnahmematrix der LifeCorp-Demo-Prozesse

Diese Matrix ist der verbindliche Vertrag für die implementierten
Showcase-Fixtures. Sie trennt fachliche Tiefe, sichtbaren UI-Zustand und erwartetes
KI-Potenzial. Die Potenzialstufe ist keine Priorisierung und kein finanzieller
Business-Case.

## Seed-Tiefen

- **End-to-End:** vollständiger Chat, heterogenes Quellenpaket, bestätigtes
  Prozessbild, Potenzialhypothesen, drei Aufsichtsszenarien, agentische
  Bewertung und beide Excel-Exporte.
- **Detailliert:** vollständiges bestätigtes Prozessbild mit belastbarer
  Evidenz, Mengen, Entscheidungen, Kontrollen, Übergaben und mindestens einer
  fachlich sinnvollen Besonderheit oder Revision.
- **Kompakt:** valider, glaubwürdiger Prozess mit fünf bis acht Hauptschritten,
  Owner, Quellen, Systemen, mindestens einem messbaren Betriebsmerkmal und
  einem belegten Schmerzpunkt.

## Zustandsverteilung

| Sichtbarer Fall         | Domänenzustand                                                     | Anzahl | Zweck                                                        |
| ----------------------- | ------------------------------------------------------------------ | ------ | ------------------------------------------------------------ |
| Vollständig bestätigt   | `confirmed`                                                        | 14     | breite, glaubwürdige Prozessbibliothek                       |
| Prozessbild zur Prüfung | `review_required`                                                  | 1      | fertigen Chat und noch offene menschliche Bestätigung zeigen |
| Chat läuft              | `capture_in_progress`, Dokumentenschleuse abgeschlossen            | 1      | Gespräch unmittelbar fortsetzen können                       |
| Unterlagen vorhanden    | `capture_in_progress`, Dokumentenschleuse offen, Uploads vorhanden | 1      | Datei-Upload erledigt, Analyse noch nicht gestartet          |
| Noch nicht begonnen     | `capture_in_progress`, Dokumentenschleuse offen, keine Uploads     | 1      | leeren Gesprächseinstieg zeigen                              |

## Prozessbezogene Abnahme

| Nr. | Fachbereich | Prozess                                                                  | Owning Team                         | Tiefe       | Zielzustand                                      | Schritte | Quellenpaket                                                                                                 | Potenzial |
| --: | ----------- | ------------------------------------------------------------------------ | ----------------------------------- | ----------- | ------------------------------------------------ | -------: | ------------------------------------------------------------------------------------------------------------ | --------- |
|   1 | Schaden     | SCH-01 · Leitungswasserschaden Wohngebäude regulieren                    | Sachschaden Hausrat und Wohngebäude | End-to-End  | bestätigt, gesamte Downstream-Strecke            |        8 | Arbeitsanweisung, Gutachternotiz, Fallübersicht; KOMPASS, VERA, AKTE, SAP S/4HANA, Exchange Online           | Hoch      |
|   2 | Schaden     | SCH-02 · Betrugsprüfung auffälliger Schadenmeldungen                     | Spezialprüfung Schaden              | Detailliert | bestätigt mit Revision                           |        6 | Fachinterview; KOMPASS, VERA, PARTO, AKTE, Exchange Online                                                   | Mittel    |
|   3 | Schaden     | SCH-03 · Kfz-Glasschaden regulieren                                      | Kfz-Schaden                         | Kompakt     | Unterlagen vorhanden, Chat nicht gestartet       |        7 | Arbeitsanweisung, Fallliste, Clearing-Hinweise; KOMPASS, VERA, PARTO, AKTE, SAP S/4HANA                      | Hoch      |
|   4 | Schaden     | SCH-04 · Einbruchdiebstahl in der Hausratversicherung regulieren         | Sachschaden Hausrat und Wohngebäude | Kompakt     | Chat läuft                                       |        7 | Schadenmeldung, Polizeinachweis, Inventarliste; KOMPASS, VERA, AKTE                                          | Mittel    |
|   5 | Vertrag     | VER-01 · Turnusmäßige Beitragsanpassung Wohngebäude                      | Sach-Bestand                        | Detailliert | bestätigt mit zurückgenommener Revision          |        6 | Verfahrensanweisung und widersprechendes Fachrundenprotokoll; VERA, PARTO, AKTE                              | Hoch      |
|   6 | Vertrag     | VER-02 · Bestandsübertragung Leben von LEBUS nach VERA                   | Bestandsmigration Leben             | Detailliert | bestätigt mit offenem dokumentierten Widerspruch |        5 | Fachinterview; LEBUS, VERA, AKTE, PARTO, Exchange Online                                                     | Mittel    |
|   7 | Vertrag     | VER-03 · Bezugsrechtsänderung einer Lebensversicherung bearbeiten        | Leben und bAV-Bestand               | Kompakt     | Prozessbild zur Prüfung                          |        6 | Kundenauftrag, Identitätsnachweis, Vertragsauszug; VERA, AKTE, Exchange Online                               | Mittel    |
|   8 | Vertrag     | VER-04 · Arbeitgeberwechsel in der betrieblichen Altersvorsorge verarbeiten | Leben und bAV-Bestand             | Kompakt     | bestätigt                                        |        7 | Arbeitgebermeldung, Vertragsdaten, Übertragungsunterlagen; VERA, AKTE, Exchange Online                       | Hoch      |
|   9 | Vertrieb    | VTR-01 · Onboarding neuer Vermittler im Außendienst                      | Vermittlerservice                   | Detailliert | bestätigt mit Revision                           |        6 | Fachinterview; PARTO, PROVISO, AKTE, Exchange Online                                                         | Mittel    |
|  10 | Vertrieb    | VTR-02 · Provisionsabrechnung Außendienst                                | Provisionsservice                   | Kompakt     | noch nicht begonnen, keine Unterlagen            |        6 | zunächst nur Fachinterview; PROVISO, PARTO, SAP S/4HANA, Exchange Online                                     | Hoch      |
|  11 | Vertrieb    | VTR-03 · Angebotsanfrage für Wohngebäude vorprüfen                       | Direktvertrieb und Angebotsservice  | Kompakt     | bestätigt                                        |        7 | Angebotsanfrage, Risikofragen, Objektunterlagen; PARTO, VERA, AKTE                                           | Hoch      |
|  12 | Vertrieb    | VTR-04 · Bestandsaktion zur betrieblichen Altersvorsorge koordinieren    | Vertriebssteuerung und bAV-Aktionen | Kompakt     | bestätigt                                        |        6 | Zielgruppenliste, Kampagnenbriefing, Vermittlerrückmeldungen; SharePoint Online, PARTO, VERA                 | Mittel    |
|  13 | Finanzen    | FIN-01 · Quartalsabrechnung Rückversicherung                             | Rückversicherungsabrechnung         | Detailliert | bestätigt                                        |        6 | Fachinterview und Abrechnungslisten; VERA, KOMPASS, SAP S/4HANA, AKTE, Exchange Online                       | Mittel    |
|  14 | Finanzen    | FIN-02 · Mahnverfahren im Direktinkasso Leben durchführen                | Prämieninkasso und Mahnwesen        | Kompakt     | bestätigt                                        |        5 | Mahnliste und Rückläufer; SAP S/4HANA, VERA, AKTE                                                            | Gering    |
|  15 | Finanzen    | FIN-03 · Nicht zuordenbare Zahlungseingänge klären                       | Zahlungsverkehr und Hauptbuch       | Kompakt     | bestätigt                                        |        7 | Kontoauszug, offener Posten, Verwendungszweck; SAP S/4HANA, VERA, PARTO                                      | Hoch      |
|  16 | IT          | IT-01 · Copilot-Studio-Agent für Schadenwissen prüfen und bereitstellen  | AI Enablement und Copilot Studio    | Kompakt     | bestätigt                                        |        8 | Anforderung, Quellenliste, Testfälle, Freigaben; SharePoint Online, Copilot Studio, Entra ID, Purview        | Hoch      |
|  17 | IT          | IT-02 · SAP S/4HANA per API für agentischen Zahlungsabgleich in KOMPASS anbinden | Integration und API         | Kompakt     | bestätigt                                        |        7 | Schnittstellenanforderung, Datenvertrag, Testprotokoll; SAP S/4HANA, KOMPASS, Azure API Management, Entra ID | Mittel    |
|  18 | IT          | IT-03 · Microsoft-365-Copilot-Lizenzen und Zugriffe bereitstellen       | Microsoft-365-Plattform             | Kompakt     | bestätigt                                        |        5 | Bedarfsanmeldung, Gruppenregel, Freigabeliste; Microsoft 365 Copilot, Entra ID, Purview                      | Gering    |

## Abnahme jedes bestätigten Prozesses

- Prozessname einschließlich Fachbereichskürzel, Fachbereich und Owning Team
  entsprechen exakt dieser Matrix.
- Das Prozessbild enthält die angegebene Zahl fachlicher Hauptschritte; Klicks
  und rein technische Unteraufgaben werden nicht als eigene Schritte gezählt.
- Jeder Schritt nennt Rolle, Ein- und Ausgabe sowie die tatsächlich genutzte
  Quelle oder Anwendung.
- Mindestens ein Mengen-, Zeit-, Frist- oder Häufigkeitswert ist belegt.
- Entscheidungen, Kontrollen, Übergaben, Medienbrüche und kleinere Ausnahmen
  bleiben sichtbar, ohne den normalen Ablauf zu überladen.
- Jede Potenzialaussage verweist auf konkrete Prozessschritte und Evidenz.
- Nicht belegte Informationen bleiben offen; für die Ziel-Potenzialstufe werden
  keine Annahmen oder Finanzwerte erfunden.

`bun run seed:showcase` erzeugt diese Zustände deterministisch in einem leeren
Workspace. `demo-data/showcase.json` hält dieselbe Liste maschinenlesbar; der
Showcase-Test verhindert abweichende Namen, Fachbereiche, Teams, Schrittzahlen
und Zustände.
