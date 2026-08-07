# LifeCorp Versicherung

Dieses Dokument beschreibt das fiktive Unternehmen, vor dessen Hintergrund alle
Demo-Szenarien in `demo-data/szenarien/` spielen. Alle Angaben — Firma, Adresse,
Organisation, Systeme, Personen — sind erfunden. Zweck ist ein realistischer,
aber vollständig unverfänglicher Rahmen für Tuningrunden der Prozessaufnahme
und der Potenzialanalyse.

## Kurzporträt

- **Name**: LifeCorp Versicherung VVaG
- **Sitz**: Wallstraße 14, 44135 Dortmund
- **Größe**: ca. 1.800 Mitarbeitende
- **Sparten**: Kfz, Hausrat/Wohngebäude, Leben, betriebliche Altersvorsorge

LifeCorp ist ein mittelgroßer, regional verwurzelter Versicherer mit
bundesweitem Direkt- und Vermittlergeschäft. Das Haus modernisiert seit
einigen Jahren seine Kernsysteme schrittweise, arbeitet dabei aber weiterhin
mit einem historisch gewachsenen Altsystem im Lebengeschäft.

## Organisationsstruktur

Die Fachbereiche entsprechen den in der App hinterlegten Abteilungen
(`defaults/process-capture-config.json`):

- **Schaden** — Schadenannahme, Regulierung, Betrugsprüfung, alle Sparten.
- **Vertrieb** — Vermittlerbetreuung, Angebotswesen, Provisionsabrechnung.
- **Vertrag** — Vertragsverwaltung, Bestandsänderungen, Beitragsanpassungen.
- **Finanzen** — Buchhaltung, Zahlungsverkehr, Rückversicherung, Reporting.
- **IT** — Betrieb und Weiterentwicklung der Kernsysteme, Support.
- **Personal** — Personalverwaltung, Recruiting, Aus- und Weiterbildung.

## Systemlandschaft

Feste, erfundene Systemnamen. Alle Szenariodokumente und Drehbuch-Antworten
verwenden ausschließlich diese Namen — Konsistenz über die gesamte
Systemlandschaft ist Teil dessen, was beim Tuning geprüft wird.

| System      | Zweck                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------- |
| **VERA**    | Bestandsführungssystem — verwaltet Verträge über alle Sparten außer Alt-Leben.              |
| **KOMPASS** | Schadensystem — Erfassung, Bearbeitung und Regulierung von Schadenfällen.                   |
| **PARTO**   | Partnersystem/CRM — Kunden-, Vermittler- und Kontaktdaten.                                  |
| **AKTE**    | Dokumentenmanagementsystem — zentrale Ablage für Verträge, Schreiben und Nachweise.         |
| **PROVISO** | Provisionssystem — berechnet und verwaltet Vergütungen für Vermittler im Außendienst.       |
| **SAP FI**  | Standard-SAP-Modul für Finanzbuchhaltung und Zahlungsverkehr.                               |
| **Outlook** | Standard-E-Mail- und Kalenderprogramm, unternehmensweit im Einsatz.                         |
| **LEBUS**   | Altsystem-Host für das Lebengeschäft — Bestandsführung für Verträge vor der VERA-Migration. |

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
