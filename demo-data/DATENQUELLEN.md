# LifeCorp Systeme und Datenquellen

Dieses Dokument ist der verbindliche Namens- und Bedeutungskatalog für alle
Demo-Prozesse. Prozessschritte verwenden die hier festgelegten Namen. Alle
Systeme, Inhalte und technischen Rahmenbedingungen sind erfunden; reale
Produktnamen beschreiben nur die plausible Unternehmensumgebung.

## Modellierungsregel

Eine **Datenquelle** enthält die fachliche Information. Eine Anwendung zeigt
oder bearbeitet diese Information. Eine **KI-Zugriffsschicht** liest eine
freigegebene Quelle oder führt eine begrenzte Aktion aus, ist aber nicht selbst
die Herkunft der Information.

Beispiele:

- `KOMPASS — Schadenstatus` ist eine Datenquelle; der lesende API-Zugriff ist
  nur der Zugangsweg.
- `SharePoint Online — Arbeitsanweisung Schaden` ist eine Datenquelle;
  Microsoft 365 Copilot ist die KI-Zugriffsschicht.
- `Exchange Online — Kunden-E-Mail` ist eine Datenquelle; ein E-Mail-Client ist
  nur die sichtbare Anwendung.
- Eine Excel-Datei ist nur dann eine Datenquelle, wenn der Prozess ihre Inhalte
  tatsächlich als Arbeitsbestand verwendet.

## Versicherungsspezifische Fachsysteme

| Kanonischer Name | Rolle und enthaltene Informationen                                                                                                                                                             | Einordnung                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **VERA**         | Aktiver Vertragsbestand, Deckungen, Beiträge, Vertragsstatus und aktuelle Bankverbindungen für Kfz, Hausrat, Wohngebäude, Leben und bAV. Altverträge Leben bleiben bis zur Migration in LEBUS. | führendes System für aktuelle Verträge      |
| **KOMPASS**      | Schadenmeldung, Schadenstatus, Reserven, Prüfvermerke, Entscheidungen und Regulierungsstand.                                                                                                   | führendes Schadensystem                     |
| **LEBUS**        | Hostbasiertes Bestandssystem aus den 1990er-Jahren für noch nicht migrierte Lebensversicherungen. Austausch erfolgt über Batch-Dateien und Exporte; eine moderne Fach-API fehlt.               | Altsystem und führende Quelle für Alt-Leben |
| **PARTO**        | Kunden-, Vermittler- und Kontaktdaten, Betreuungszuordnung, Partnerwerkstätten und Vermittlerstatus. Das zugehörige Vermittlerportal gehört zum Vertriebssilo.                                 | separates Vertriebs-CRM                     |
| **PROVISO**      | Courtagesätze, Provisionsläufe, Stornohaftung, Korrekturen und Abrechnungsstatus für Außendienst und Makler.                                                                                   | führendes Provisionssystem                  |
| **AKTE**         | Freigegebene Verträge, Schreiben, Schadenunterlagen, Gutachten, Nachweise und Prüfvermerke.                                                                                                    | revisionsnahe Dokumentenablage              |
| **SAP S/4HANA**  | Hauptbuch, Debitoren, Zahlungsstatus, Auszahlungen, Prämieninkasso, Mahnstatus und Rückversicherungsbuchungen.                                                                                 | führendes ERP für Finanzdaten               |

`SAP S/4HANA` ist das ERP-System. `SAP HANA` bezeichnet die zugrunde liegende
Datenbanktechnologie und wird deshalb in Prozessschritten nicht als Anwendung
oder Datenquelle genannt. SAP beschreibt S/4HANA als modernes ERP und HANA
Cloud als Datenbankplattform: [SAP S/4HANA](https://www.sap.com/products/erp/s4hana.html),
[SAP HANA Cloud](https://www.sap.com/products/data-cloud/hana.html).

## Microsoft-365-Arbeitsinhalte

| Kanonischer Name       | Rolle und enthaltene Informationen                                                                   | Verwendung im Prozessbild                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Exchange Online**    | E-Mails, Anhänge, Kalendertermine und externe Korrespondenz.                                         | konkrete Nachricht oder Termin als Quelle nennen              |
| **Microsoft Teams**    | Kanalbeiträge, Chats, Besprechungen und gemeinsam festgehaltene Abstimmungen.                        | nur nennen, wenn die Unterhaltung fachliche Information trägt |
| **SharePoint Online**  | gemeinsam gepflegte Arbeitsanweisungen, Wissensseiten, Teamlisten und freigegebene Arbeitsdokumente. | bevorzugte Quelle für gemeinsames Arbeitswissen               |
| **Microsoft 365 Apps** | Word, Excel und PowerPoint zum Erstellen und Bearbeiten von Dokumenten, Tabellen und Präsentationen. | konkrete Datei und Ablage nennen, nicht nur „Office“          |

Für die LifeCorp-Demo werden gemeinsam genutzte Dateien ausschließlich
SharePoint Online zugeordnet.

## Datenformate und Upload-Grenze

Das **Datenformat im Prozess** und das **vom Prototyp unterstützte
Upload-Format** sind zwei verschiedene Angaben. Jeder Prozess nennt sein reales
Format auch dann, wenn es nicht hochgeladen werden kann.

| Unterstützter Upload | Erwarteter Inhalt                                         |
| -------------------- | --------------------------------------------------------- |
| PDF                  | textbasierte PDF oder eingeschränkt ein Bildscan          |
| DOCX                 | Word-Dokument                                             |
| PPTX                 | PowerPoint-Präsentation                                   |
| XLSX                 | Excel-Arbeitsmappe ohne vorausgesetzte Makroausführung    |
| CSV                  | strukturierte, textbasierte Tabelle                       |
| TXT                  | Klartext                                                  |
| MD                   | Markdown                                                  |
| PNG, JPG, JPEG       | eingeschränkt multimodal interpretierbares Bild oder Scan |

Für Bilder und Scans gibt es keine separate, deterministische OCR-Pipeline.
Claude oder Codex interpretieren sie multimodal. Kleine Schrift, Handschrift,
Tabellen, schlechte Scanqualität und exakte Zahlen können dabei unvollständig
oder falsch erkannt werden. Materielle Angaben müssen deshalb im Gespräch oder
in der menschlichen Prüfung bestätigt werden.

Nicht unterstützt werden TIFF und andere Bildformate, Audio, Video,
passwortgeschützte Dateien, Makroausführung und alte Binärformate wie DOC, XLS
oder PPT.

## KI, Zugriff, Governance und Automation

| Kanonischer Name             | Rolle                                                                                                           | Keine Datenquelle, weil …                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Microsoft 365 Copilot**    | KI-Zugriffsschicht auf berechtigte E-Mails, Chats und Dokumente über Microsoft Graph.                           | die fachlichen Inhalte aus Exchange Online, Teams oder SharePoint stammen |
| **Microsoft Copilot Studio** | Erstellung, Test, Freigabe und Betrieb kontrollierter Fachbereichs-Agenten.                                     | die Agenten auf SharePoint, Dataverse, Connectoren oder APIs zugreifen    |
| **Microsoft Entra ID**       | Identitäten, Gruppen, Authentifizierung und Autorisierung für Benutzer und Agenten.                             | es Zugriffe steuert, aber keine Versicherungsdaten führt                  |
| **Microsoft Purview**        | Datenklassifizierung, Schutz-, Aufbewahrungs- und Governance-Regeln.                                            | es Datenbestände kontrolliert und katalogisiert                           |
| **Power Automate**           | deterministische Workflows, Benachrichtigungen und Übergaben zwischen Anwendungen.                              | es Informationen transportiert oder Aktionen ausführt                     |
| **Azure API Management**     | veröffentlichte, abgesicherte und nachvollziehbare APIs für SAP S/4HANA, VERA, KOMPASS und weitere Fachsysteme. | es den kontrollierten Zugangsweg bereitstellt                             |
| **Power BI**                 | Berichte und Dashboards aus kuratierten Datenmodellen.                                                          | der zugrunde liegende Datensatz die eigentliche Quelle bleibt             |

Microsoft dokumentiert, dass Copilot mit Microsoft-365-Anwendungen und
Microsoft Graph arbeitet und nur berechtigte Arbeitsdaten verwendet:
[Microsoft-365-Copilot-Überblick](https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-overview).
Copilot Studio kann SharePoint und Dataverse direkt sowie externe Systeme über
Connectoren oder eigene APIs anbinden:
[Wissensquellen](https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/custom-knowledge-sources),
[Connectoren](https://learn.microsoft.com/en-us/microsoft-copilot-studio/copilot-ai-plugins).

Für die Kontrollschicht gelten
[Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/),
[Microsoft Purview](https://learn.microsoft.com/en-us/purview/data-governance-overview)
und die
[Copilot-Studio-Governance](https://learn.microsoft.com/en-us/microsoft-copilot-studio/security-and-governance).
Power Automate bildet wiederholbare Workflows ab, Power BI die Analyse:
[Power Automate](https://learn.microsoft.com/en-us/power-automate/flow-types),
[Power BI](https://learn.microsoft.com/en-us/power-bi/fundamentals/power-bi-overview).

## Bewusste Begrenzungen

- **Microsoft Fabric** wird nicht vorausgesetzt. Power BI genügt für die
  sichtbaren Berichte; eine zusätzliche unternehmensweite Datenplattform würde
  die Demo ohne fachlichen Mehrwert vergrößern.
- **Dataverse** kann technisch zu einer Copilot-Studio-Umgebung gehören, wird
  aber erst als Datenquelle genannt, wenn ein konkreter Agent dort eigene
  strukturierte Fachdaten hält.
- **Microsoft 365 Copilot** und **Copilot Studio** ersetzen keine
  Berechtigungsprüfung. Zugriffe bleiben auf die Rechte in Quelle, Entra ID,
  Connector und API begrenzt.
- **Excel- und Teamlisten** bleiben als realistische Schattenbestände erlaubt,
  müssen im Prozessbild aber mit Speicherort, Pflegeverantwortung und
  Medienbruch benannt werden.

## Externe Informationsquellen

Je nach Prozess kommen zusätzlich Kundenmeldungen, Vermittlerunterlagen,
Werkstattrechnungen, Gutachten, Bankrückmeldungen und Schreiben von
Rückversicherern hinzu. Sie werden mit Eingangskanal und Zielsystem erfasst,
beispielsweise `Kunden-E-Mail über Exchange Online → Schadenakte in KOMPASS und AKTE`.

## Kanonische Ein- und Ausgangskanäle

| Kanal                     | Typische Inhalte                                            | Modellierungsregel                                                              |
| ------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Kundenportal              | Schadenmeldungen, Dokumente, Anträge und digitale Schreiben | Portalinhalt und übernehmendes Fachsystem nennen                                |
| Vermittlerportal in PARTO | Vermittlerdaten, Anträge, Status und Unterlagen             | nicht mit dem Kundenportal zusammenfassen                                       |
| Exchange Online           | E-Mails, Anhänge, Termine und externe Abstimmungen          | Absenderrolle und Zielsystem nennen                                             |
| Telefon                   | Meldungen und Rückfragen                                    | relevante Angaben werden erst durch die dokumentierte Gesprächsnotiz zur Quelle |
| Post und Druckstraße      | eingehende Schreiben und ausgehende Massendokumente         | Scan beziehungsweise Ablage in AKTE als Medienbruch erfassen                    |
| API                       | strukturierter Systemaustausch                              | Quell- und Zielsystem sowie Lese- oder Schreibzugriff nennen                    |
| Batch-Datei               | zeitversetzter Austausch mit LEBUS oder externen Stellen    | Format, Turnus und Fehlerbehandlung nennen                                      |
| Bankkanal                 | Kontoauszüge, Zahlungsstatus und Rückläufer                 | SAP S/4HANA bleibt führendes System für die Buchung                             |

## Wiederkehrende externe Beteiligte

- Versicherungsnehmer und bezugsberechtigte Personen
- Interessenten und Arbeitgeber im bAV-Geschäft
- Außendienstvermittler und Makler
- Werkstätten, Handwerksunternehmen und Sachverständige
- Banken und Zahlungsempfänger
- Rückversicherer

Externe Beteiligte werden als Rollen bezeichnet. Erfundenen Organisationen
oder Personen werden nur dann Namen gegeben, wenn ein konkretes Testdokument
sie benötigt.
