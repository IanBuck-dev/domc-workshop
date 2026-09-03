# LifeCorp – Annahmen des Demo-Versicherers

LifeCorp Versicherung VVaG ist der vollständig erfundene Beispielversicherer
der Zukunftswerkstatt. Dieses Dokument ist der zentrale Einstieg in alle
fachlichen Annahmen. Es soll Versicherungsfachleuten und Versicherungs-IT eine
vertraute, konsistente Ausgangslage geben, ohne reale Unternehmen oder Daten
abzubilden.

Die verlinkten Detailkataloge gehören zu diesem Annahmenregister. Sie sind für
exakte Team-, System- und Prozessnamen verbindlich; diese Übersichtsdatei hält
die bereichsübergreifenden Annahmen und Grenzen zusammen.

## Unternehmensbild

- mittelgroßer Versicherungsverein mit rund 1.800 Mitarbeitenden
- zentraler operativer Standort in Dortmund
- bundesweites Direkt- und Vermittlergeschäft ohne modellierte Regionalstruktur
- schrittweise Modernisierung bei gleichzeitig historisch gewachsenen
  Fachsystemen und manuellen Schattenbeständen
- fiktive Domain `lifecorp.example`; alle Personen, Vorgänge und Kennzahlen sind
  erfunden

## Versicherungsangebot

LifeCorp bietet Kfz-, Hausrat- und Wohngebäudeversicherung sowie
Lebensversicherung und betriebliche Altersvorsorge an. Kranken-, Haftpflicht-,
Unfall-, Rechtsschutz- und eigenständige Gewerbeversicherung gehören nicht zum
Demo-Unternehmen.

Diese Begrenzung ist bewusst gewählt: Das Prozessportfolio soll einen
glaubwürdigen Ausschnitt eines deutschen Versicherers zeigen, statt jede Sparte
oberflächlich anzudeuten.

## Fachbereiche und Organisation

Das sichtbare Prozessportfolio umfasst fünf Fachbereiche:

- **Schaden:** Erstaufnahme, Kfz- und Sachschadenregulierung,
  Spezialprüfung und Schadenqualität.
- **Vertrag:** Kfz-, Sach-, Leben- und bAV-Bestand, Bestandsservice sowie die
  Migration alter Lebensversicherungsverträge.
- **Vertrieb:** Direktvertrieb, Angebotsservice, Vermittlerservice,
  Provisionsservice und Vertriebsaktionen.
- **Finanzen:** Prämieninkasso, Mahnwesen, Zahlungsverkehr, Hauptbuch und
  Rückversicherungsabrechnung.
- **IT:** Microsoft-365-Plattform, AI Enablement, Copilot Studio,
  Schnittstellen, Fachsystembetreuung, Identität und Data Governance.

Jeder Prozess besitzt genau ein verantwortliches Team. Andere Teams erscheinen
als nachvollziehbare Übergaben. IT verantwortet Plattformen, Schnittstellen und
Berechtigungen, aber keine fachliche Versicherungsentscheidung. Allgemeine
Personal-, Rechts-, Verwaltungs- und First-Level-Support-Prozesse bleiben
außerhalb des Präsentationsportfolios.

Die Teamstruktur, Größenannahmen, Rollen und typischen Übergaben stehen im
[Organisationskatalog](demo-data/ORGANISATION.md).

## Rollen und Beteiligte

Teamleitungen sind normalerweise Prozesseigner operativer Prozesse;
Sachbearbeitende erklären die tatsächliche Arbeit. Fachexperten unterstützen
Sonderfälle. In IT-Prozessen übernimmt ein Service Owner die technische
Verantwortung. Der AI-Enabler moderiert Prozessaufnahme und Potenzialanalyse,
besitzt aber weder Prozess noch Entscheidung.

Edda Brandt ist die interviewte Fachkraft der Demo-Szenarien. Florian Weigel
ist der AI-Enabler. Weitere Personen werden grundsätzlich als Rollen benannt.
Wiederkehrende externe Beteiligte sind Versicherungsnehmer, Arbeitgeber,
Vermittler, Makler, Werkstätten, Handwerksunternehmen, Sachverständige, Banken
und Rückversicherer.

## System- und Datenlandschaft

LifeCorp verbindet moderne Standardplattformen mit spezialisierten und alten
Versicherungssystemen:

| Bereich            | Festgelegte Systeme und Quellen                                                                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vertrag            | VERA für aktuelle Bestände; LEBUS als hostbasiertes Altsystem für noch nicht migrierte Lebensversicherungen                                                                              |
| Schaden            | KOMPASS für Schadenfälle, Entscheidungen, Reserven und Regulierungsstatus                                                                                                                |
| Vertrieb           | PARTO als separates Vermittler-CRM und Portal; PROVISO für Provisionen                                                                                                                   |
| Dokumente          | AKTE als revisionsnahe Fachablage; SharePoint Online für Arbeitswissen, Anweisungen, Vorlagen und Teamlisten                                                                             |
| Finanzen           | SAP S/4HANA für Hauptbuch, Zahlungsverkehr, Inkasso und Mahnwesen                                                                                                                        |
| Kommunikation      | Exchange Online für E-Mails und Termine; Teams für fachlich relevante Abstimmungen                                                                                                       |
| KI und Integration | Microsoft 365 Copilot und Copilot Studio als Zugriffsschichten; Entra ID, Purview, Power Automate, Power BI und Azure API Management als Kontroll-, Automations- und Integrationsdienste |

Eine Datenquelle enthält die fachliche Information. Anwendung, Connector und
KI-Zugriffsschicht werden davon getrennt beschrieben. Copilot ist deshalb keine
Datenquelle. OneDrive wird in der LifeCorp-Demo nicht als Unternehmensquelle
modelliert.

Der vollständige Namens-, Kanal- und Formatkatalog steht unter
[Systeme und Datenquellen](demo-data/DATENQUELLEN.md).

## Kanäle und Dokumentformate

Wiederkehrende Kanäle sind Kundenportal, Vermittlerportal in PARTO, Exchange
Online, Telefon, Post und Druckstraße, APIs, Batch-Dateien und der Bankkanal.
Ein Prozessschritt benennt fachlichen Inhalt, führende Quelle, Format,
Lese- oder Schreibzugriff und Ziel.

Der Prototyp akzeptiert PDF, DOCX, PPTX, XLSX, CSV, TXT, Markdown sowie PNG,
JPG und JPEG. Bilder und Scans werden eingeschränkt multimodal durch Codex oder
Claude interpretiert. Es existiert keine deterministische OCR-Pipeline;
materielle Angaben aus Bildern, Handschrift, Tabellen oder schlechter
Scanqualität müssen Menschen bestätigen.

## Annahmen über die heutige Arbeitsweise

- SharePoint Online enthält den initialen Prozesskatalog, Arbeitsanweisungen,
  Checklisten und Vorlagen, kann aber veraltet sein.
- Fachinterviews erklären gelebte Entscheidungen, Ausnahmen, Rückfragen und
  informelle Arbeit.
- Fachsysteme zeigen Status, Felder und Übergaben, aber nicht automatisch die
  fachliche Begründung.
- Exchange Online, Teams, Excel- und Teamlisten bilden realistische
  Koordinations- und Schattenbestände.
- AKTE enthält die fallbezogenen Nachweise; im Repository liegen ausschließlich
  erfundene Beispieldokumente.
- Dokumente, Systemanzeige und Interview dürfen sich widersprechen. Erst die
  menschliche Bestätigung macht das Prozessverständnis verbindlich.

## Prozessmodell und Auswahl

Die Demo betrachtet Prozesse aus der Sicht eines verantwortlichen Teams. Ein
Prozess hat einen eigenen Auslöser und ein eigenes fachliches Ergebnis, enthält
fünf bis acht Hauptschritte und zeigt relevante Entscheidungen, Kontrollen,
Übergaben und kleinere Ausnahmen. Ein weiterer Prozess entsteht nur bei
eigenem Owner, Auslöser oder Ergebnis.

Das Zielportfolio umfasst 18 Prozesse aus den fünf Fachbereichen: acht mit
hohem, acht mit mittlerem und zwei mit geringem belegtem KI-Potenzial. Diese
Stufe zeigt das gewünschte Spektrum der Demo; sie ist weder Business-Case noch
Priorisierung. Die vollständige Liste steht im
[Demo-Prozessportfolio](demo-data/PROZESSPORTFOLIO.md), die Pflichtangaben je
Prozess im [Modellierungsrahmen](demo-data/MODELLIERUNGSRAHMEN.md).
Seed-Tiefe, gewünschte UI-Zustände und Abnahmekriterien je Prozess stehen in
der [Abnahmematrix](demo-data/ABNAHMEMATRIX.md).

## Aktueller Prototyp und Vision

Heute legen Fachmitarbeitende den Prozess an und wählen vorhandene Unterlagen
über einen lokalen Filepicker aus. Jede KI-Aktion wird ausdrücklich gestartet.
Es gibt keine direkte SharePoint-Anbindung, kein Hintergrund-Crawling und keine
autonome Prozessbestätigung.

Die Vision ist eine kontrollierte, agentische Prozesserschließung: Ein Agent
erhält eng begrenzten Zugriff auf freigegebene Quellen, sammelt belegte
Prozesskandidaten, bewahrt Herkunft und Annahmen und bereitet das Fachinterview
vor. Versionierte Instruktionen und Schemas, minimale Berechtigungen,
begrenzte Laufzeit und Kosten, Auditierbarkeit sowie Schutz vor Anweisungen in
Quelldokumenten sind Voraussetzungen. Bestätigung und materielle
Versicherungsentscheidungen bleiben bei Menschen.

## Verbindliche Grenzen

- ausschließlich erfundene deutsche Demo-Daten
- nur aktueller Ist-Prozess in der Prozessaufnahme
- KI-Ausgaben bleiben beratend und evidenzgebunden
- keine finanziellen Business Cases oder automatische Priorisierung
- keine autonome Freigabe von Prozessen, Lösungen oder Fachentscheidungen
- kein Anspruch, die vollständige Organisation eines Versicherers abzubilden

Änderungen an bereichsübergreifenden LifeCorp-Annahmen werden zuerst hier
festgehalten und anschließend in den betroffenen Detailkatalogen und Fixtures
nachgezogen.
