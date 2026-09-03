# LifeCorp Demo-Prozessportfolio

Dieses Dokument hält den fachlich vereinbarten Umfang der Präsentationsdaten
fest. Das Portfolio zeigt Prozesse aus den angebotenen Sparten Kfz, Hausrat,
Wohngebäude, Leben und betriebliche Altersvorsorge, aus dem Direkt- und
Vermittlergeschäft sowie aus der unmittelbar unterstützenden Versicherungs-IT.

## Bedeutung der Potenzialstufe

Die Potenzialstufe ist das höchste fachlich belegte KI-Potenzial, das die
deterministische Demo-Analyse für einen Prozess zeigen soll. Sie ist kein
Business-Case, keine finanzielle Bewertung und keine Priorisierung des
Prozesses. Ein wichtiger Prozess kann deshalb bewusst eine geringe
KI-Potenzialstufe besitzen.

- **Hoch** — wiederkehrende Interpretation unstrukturierter Informationen oder
  Koordination über mehrere Systeme mit klarer menschlicher Aufsicht.
- **Mittel** — nützliche KI-Unterstützung, deren Wirkung durch Einzelfälle,
  offene Voraussetzungen oder intensive menschliche Entscheidungen begrenzt ist.
- **Gering** — hoher fachlicher Nutzen des Prozesses, aber überwiegend
  regelbasierte, einmalige oder besonders kontrollbedürftige Arbeit.

## Zielportfolio

Das Fachbereichskürzel ist für die Demo Teil des Prozessnamens
(`SCH`, `VER`, `VTR`, `FIN`, `IT`). Es ist bewusst kein eigenes Domänenfeld;
`PROC-xxxx` bleibt die technische, unveränderliche Prozess-ID.

| Fachbereich | Prozess                                                                          | Bezug                          | Potenzial | Fixture   |
| ----------- | -------------------------------------------------------------------------------- | ------------------------------ | --------- | --------- |
| Schaden     | SCH-01 · Leitungswasserschaden Wohngebäude regulieren                            | Wohngebäude                    | Hoch      | vorhanden |
| Schaden     | SCH-02 · Betrugsprüfung auffälliger Schadenmeldungen                             | Sach/Komposit                  | Mittel    | vorhanden |
| Schaden     | SCH-03 · Kfz-Glasschaden regulieren                                              | Kfz                            | Hoch      | vorhanden |
| Schaden     | SCH-04 · Einbruchdiebstahl in der Hausratversicherung regulieren                 | Hausrat                        | Mittel    | vorhanden |
| Vertrag     | VER-01 · Turnusmäßige Beitragsanpassung Wohngebäude                              | Wohngebäude                    | Hoch      | vorhanden |
| Vertrag     | VER-02 · Bestandsübertragung Leben von LEBUS nach VERA                           | Leben                          | Mittel    | vorhanden |
| Vertrag     | VER-03 · Bezugsrechtsänderung einer Lebensversicherung bearbeiten                | Leben                          | Mittel    | vorhanden |
| Vertrag     | VER-04 · Arbeitgeberwechsel in der betrieblichen Altersvorsorge verarbeiten      | bAV                            | Hoch      | vorhanden |
| Vertrieb    | VTR-01 · Onboarding neuer Vermittler im Außendienst                              | Vermittlergeschäft             | Mittel    | vorhanden |
| Vertrieb    | VTR-02 · Provisionsabrechnung Außendienst                                        | Vermittlergeschäft             | Hoch      | vorhanden |
| Vertrieb    | VTR-03 · Angebotsanfrage für Wohngebäude vorprüfen                               | Direkt- und Vermittlergeschäft | Hoch      | vorhanden |
| Vertrieb    | VTR-04 · Bestandsaktion zur betrieblichen Altersvorsorge koordinieren            | bAV und Vermittlergeschäft     | Mittel    | vorhanden |
| Finanzen    | FIN-01 · Quartalsabrechnung Rückversicherung                                     | Sach/Komposit                  | Mittel    | vorhanden |
| Finanzen    | FIN-02 · Mahnverfahren im Direktinkasso Leben durchführen                        | Leben und Direktgeschäft       | Gering    | vorhanden |
| Finanzen    | FIN-03 · Nicht zuordenbare Zahlungseingänge klären                               | alle angebotenen Sparten       | Hoch      | vorhanden |
| IT          | IT-01 · Copilot-Studio-Agent für Schadenwissen prüfen und bereitstellen          | Schaden und Versicherungs-IT   | Hoch      | vorhanden |
| IT          | IT-02 · SAP S/4HANA per API für agentischen Zahlungsabgleich in KOMPASS anbinden | Finanzen, Schaden und IT       | Mittel    | vorhanden |
| IT          | IT-03 · Microsoft-365-Copilot-Lizenzen und Zugriffe bereitstellen                | Versicherungs-IT               | Gering    | vorhanden |

Damit umfasst der Zielzustand 18 Prozesse aus fünf Fachbereichen: acht mit
hohem, acht mit mittlerem und zwei mit geringem KI-Potenzial.

Sechs Prozesse sind als vollständige, chatbasierte Journeys bis zur agentischen
Bewertung ausgearbeitet. Ihre kriteriumsbasierten Vergleichswerte sind FIN-03 = 85,
VER-01 = 79, SCH-01 = 72, VTR-01 = 58, IT-02 = 46 und FIN-02 = 28. Alle übrigen
Prozesse bleiben bewusst ohne Score.

Die verbindliche Tiefe, der gewünschte Seed-Zustand und die Abnahmekriterien
jedes Prozesses stehen in der [`ABNAHMEMATRIX.md`](ABNAHMEMATRIX.md).

## Ausgeschlossene Präsentationsfälle

- Allgemeiner Anwendersupport, Passwort-, Geräte- und Arbeitsplatzthemen
- Recruiting, Bewerbermanagement und sonstige Personalprozesse
- Eigenständige Gewerbe-, Kranken-, Haftpflicht-, Unfall- und
  Rechtsschutzversicherung
- Allgemeine Rechts-, Compliance- und Verwaltungsprozesse ohne direkten Bezug
  zu einem angebotenen Versicherungsprodukt oder Vertriebskanal
