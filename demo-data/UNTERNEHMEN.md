# LifeCorp Versicherung

Dieses Dokument beschreibt das fiktive Unternehmen, vor dessen Hintergrund alle
Demo-Szenarien in `demo-data/szenarien/` spielen. Alle Angaben — Firma, Adresse,
Organisation, Systeme, Personen — sind erfunden. Zweck ist ein realistischer,
aber vollständig unverfänglicher Rahmen für Tuningrunden der Prozessaufnahme
und der Potenzialanalyse.

Das zentrale, leserorientierte Annahmenregister steht in
[`../LIFECORP.md`](../LIFECORP.md). Dieses Dokument bleibt der Detailkatalog für
Unternehmensprofil, Systemnamen und Personas.

## Kurzporträt

- **Name**: LifeCorp Versicherung VVaG
- **Sitz**: Wallstraße 14, 44135 Dortmund
- **Größe**: ca. 1.800 Mitarbeitende
- **Sach/Komposit**: Kfz, Hausrat und Wohngebäude
- **Leben und Vorsorge**: Lebensversicherung und betriebliche Altersvorsorge
- **Vertriebskanäle**: bundesweites Direkt- und Vermittlergeschäft

LifeCorp ist ein mittelgroßer, regional verwurzelter Versicherer. Das Haus
modernisiert seit einigen Jahren seine Kernsysteme schrittweise, arbeitet dabei
aber weiterhin mit einem historisch gewachsenen Altsystem im Lebengeschäft.
Kranken-, Haftpflicht-, Unfall-, Rechtsschutz- und eigenständige
Gewerbeversicherungen gehören ausdrücklich nicht zum Angebot.

## Fachbereiche im Demo-Prozessportfolio

Die Präsentationsfälle bleiben auf das angebotene Versicherungsgeschäft und
seine Vertriebskanäle begrenzt. Die Fachbereiche entsprechen den in der App
hinterlegten Abteilungen (`defaults/process-capture-config.json`):

- **Schaden** — Schadenannahme, Regulierung, Betrugsprüfung, alle Sparten.
- **Vertrieb** — Vermittlerbetreuung, Angebotswesen, Provisionsabrechnung.
- **Vertrag** — Vertragsverwaltung, Bestandsänderungen, Beitragsanpassungen.
- **Finanzen** — versicherungsspezifischer Zahlungsverkehr,
  Prämieninkasso, Rückversicherung und Provisionsbuchung.
- **IT** — Einführung und Governance von Microsoft 365 Copilot und Copilot
  Studio sowie kontrollierte API-Anbindung der Versicherungssysteme für
  agentische Fachbereichsanwendungen.

LifeCorp besitzt selbstverständlich weitere interne Funktionen. Allgemeine
IT-Support-, Personal-, Rechts-, Compliance- und Verwaltungsprozesse sind
jedoch kein Teil des Demo-Prozessportfolios.

Die vollständige Auswahl der Präsentationsfälle und ihr geplanter
Potenzial-Mix stehen in [`PROZESSPORTFOLIO.md`](PROZESSPORTFOLIO.md). Der
verbindliche Katalog für Systeme und Datenquellen steht in
[`DATENQUELLEN.md`](DATENQUELLEN.md). Die Angaben, die jeder Demo-Prozess
enthalten muss, stehen in [`MODELLIERUNGSRAHMEN.md`](MODELLIERUNGSRAHMEN.md).
Teams, Rollen und organisatorische Übergaben sind in
[`ORGANISATION.md`](ORGANISATION.md) festgelegt.

## Systemlandschaft

Feste, erfundene Systemnamen. Alle Szenariodokumente und Drehbuch-Antworten
verwenden ausschließlich diese Namen — Konsistenz über die gesamte
Systemlandschaft ist Teil dessen, was beim Tuning geprüft wird.

| System                       | Zweck                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| **VERA**                     | Bestandsführungssystem für alle aktuellen Verträge außer dem Altbestand Leben.               |
| **KOMPASS**                  | Schadensystem für Erfassung, Bearbeitung und Regulierung.                                    |
| **PARTO**                    | separates Vertriebs- und Vermittler-CRM samt Vermittlerportal.                               |
| **AKTE**                     | revisionsnahe Dokumentenablage für Verträge, Schäden, Schreiben und Nachweise.               |
| **PROVISO**                  | Provisionssystem für Außendienst und Makler.                                                 |
| **SAP S/4HANA**              | modernes ERP für Finanzbuchhaltung, Zahlungsverkehr, Prämieninkasso und Mahnwesen.           |
| **LEBUS**                    | hostbasiertes Bestandssystem aus den 1990er-Jahren für nicht migrierte Lebensversicherungen. |
| **Microsoft 365**            | Arbeitsumgebung mit Office-Anwendungen, Exchange Online, Teams und SharePoint Online.        |
| **Microsoft 365 Copilot**    | KI-Zugriffsschicht für berechtigte Microsoft-365-Arbeitsinhalte.                             |
| **Microsoft Copilot Studio** | Plattform für kontrollierte Fachbereichs-Agenten und deren Datenzugriffe.                    |
| **Microsoft Entra ID**       | Identitäten, Gruppen und Zugriffsrechte.                                                     |
| **Microsoft Purview**        | Klassifizierung, Schutz und Governance von Daten.                                            |
| **Power Automate**           | regelbasierte Workflows zwischen Anwendungen und Diensten.                                   |
| **Power BI**                 | Berichte und Management-Dashboards auf kuratierten Daten.                                    |
| **Azure API Management**     | kontrollierter API-Zugang auf SAP S/4HANA und die Versicherungssysteme.                      |

## Personas

### Edda Brandt

Fachbereichs-Mitarbeiterin, Mitte 50, seit über 20 Jahren im Haus. Edda ist in
allen Drehbüchern die Interviewte — je Szenario wechselt nur ihr
Aufgabengebiet, sie steht stellvertretend für den jeweiligen Fachbereich.
Sie kennt ihre Arbeit im Detail, aber nicht das Vokabular der
Prozessmodellierung: Ihre Antworten sind knapp, praktisch und manchmal
lückenhaft.

E-Mail: `edda.brandt@lifecorp.example`

### Florian Weigel

AI-Enabler im Stab. Treibt die Einführung der KI-gestützten Prozessaufnahme
voran, legt Demo-Prozesse an, führt Tuningrunden durch und bewertet die
Ergebnisse.

E-Mail: `florian.weigel@lifecorp.example`

---

Alle Angaben in diesem Dokument sind erfunden. Die Domain `lifecorp.example`
ist gemäß RFC 2606 für Beispielzwecke reserviert und trifft kein reales
Unternehmen und keine reale Person.
