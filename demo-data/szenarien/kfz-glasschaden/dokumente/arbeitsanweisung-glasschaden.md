# Arbeitsanweisung: Regulierung von Kfz-Glasschäden

**Dokumentnummer:** AA-SCH-042
**Version:** 3.1
**Stand:** Frühjahr 2026
**Freigabe:** Leitung Fachbereich Schaden
**Geltungsbereich:** Fachbereich Schaden, Team Kfz-Sachschaden

## 1. Zweck

Diese Arbeitsanweisung regelt die einheitliche Bearbeitung von Glasschäden an
kaskoversicherten Kraftfahrzeugen (Windschutzscheibe, Seiten- und Heckscheiben,
Schiebedächer aus Glas). Sie gilt für alle Schadenmeldungen, die im
Schadensystem **KOMPASS** unter der Schadenart „Glasschaden Kfz" erfasst
werden.

## 2. Geltungsbereich und Abgrenzung

Nicht Gegenstand dieser Anweisung sind Glasschäden in Verbindung mit einem
größeren Unfallschaden (dort gilt die reguläre Unfallschadenregulierung) sowie
Glasschäden an gewerblich genutzten Flotten, die über gesonderte
Rahmenverträge laufen.

## 3. Prozessschritte

### 3.1 Schadenmeldung erfassen

Jede eingehende Meldung (per Partnerportal, Telefon oder E-Mail) wird von der
zuständigen Sachbearbeitung im Schadensystem **KOMPASS** unter einer neuen
Schadennummer erfasst. Pflichtangaben sind Kennzeichen, Schadendatum, Art des
Glasschadens und – sofern bekannt – die reparierende Werkstatt.

### 3.2 Weg der Regulierung bestimmen

Es wird geprüft, ob die Werkstatt an das Direktabrechnungsverfahren
(„Clearing") angeschlossen ist. Bei angeschlossenen Partnerwerkstätten läuft
die Rechnungsstellung automatisiert über die Clearing-Schnittstelle; diese
Fälle durchlaufen die folgenden Schritte 3.3 bis 3.6 nicht manuell, sondern
werden über die Schnittstelle direktabgerechnet und laufen automatisiert in
SAP FI zur Zahlung. Ist keine Partnerwerkstatt beteiligt oder liegt eine
Werkstattrechnung ohne Clearing-Kennzeichen vor, erfolgt die Bearbeitung
manuell gemäß 3.3 bis 3.6.

### 3.3 Deckung prüfen

Die Sachbearbeitung prüft anhand der Vertragsdaten im Bestandsführungssystem
**VERA**, ob eine Kaskoversicherung mit Einschluss von Glasschäden besteht und
ob der Vertrag zum Schadendatum aktiv war. Fehlt der Einschluss oder ist der
Vertrag zum Schadenzeitpunkt nicht aktiv, wird der Vorgang abgelehnt und die
Ablehnung im KOMPASS-Vorgang dokumentiert.

### 3.4 Rechnung prüfen

Die eingereichte Werkstattrechnung oder der Kostenvoranschlag wird auf
Plausibilität geprüft: Leistungsumfang, Materialkosten und Stundensätze
werden mit den hinterlegten Referenzwerten abgeglichen. Bei deutlichen
Abweichungen wird bei der Werkstatt nachgefragt, bevor die Rechnung
freigegeben wird.

### 3.5 Selbstbeteiligung berechnen und auszahlen

Von der geprüften Rechnungssumme wird die vertraglich vereinbarte
Selbstbeteiligung für Glasschäden in Höhe von 150 Euro abgezogen. Der
verbleibende Betrag wird über **SAP FI** zur Auszahlung angewiesen. Bei
Leasingfahrzeugen erfolgt die Auszahlung abweichend an die im Vertrag
hinterlegte Leasinggesellschaft, nicht an die versicherte Person.

### 3.6 Vorgang ablegen und abschließen

Rechnung, Prüfvermerk und Zahlungsbestätigung werden im
Dokumentenmanagementsystem **AKTE** unter der Schadennummer abgelegt. Der
Vorgang wird im KOMPASS-Vorgang auf den Status „Reguliert" gesetzt.

## 4. Zuständigkeiten

Die Bearbeitung obliegt der Sachbearbeitung Kfz-Sachschaden im Fachbereich
Schaden. Bei Rückfragen zur Clearing-Schnittstelle ist die IT-Betriebsgruppe
Schadensysteme zuständig. Deckungsfragen mit Vertragsbezug, die nicht
eindeutig aus VERA hervorgehen, werden an die Vertragsabteilung eskaliert.

## 5. Systembezüge

| System  | Verwendung in diesem Prozess                                   |
| ------- | -------------------------------------------------------------- |
| KOMPASS | Schadenerfassung, Bearbeitungsstatus, Vorgangsablage           |
| VERA    | Prüfung von Vertrags- und Deckungsdaten                        |
| PARTO   | Stammdaten der Partnerwerkstätten, Ansprechpartner             |
| AKTE    | Ablage von Rechnungen, Prüfvermerken und Zahlungsbestätigungen |
| SAP FI  | Auszahlung des regulierten Betrags                             |

## 6. Sonderfälle

**Oldtimer (Erstzulassung vor mehr als 30 Jahren):** Vor der Auszahlung ist
grundsätzlich ein kurzes Gutachten zum Zeitwert bzw. zur fachgerechten
Verglasung einzuholen, da Standardersatzteile häufig nicht passen. Die
Bearbeitungszeit verlängert sich entsprechend.

**Leasingfahrzeuge:** Die Auszahlung erfolgt an die Leasinggesellschaft; die
versicherte Person erhält lediglich eine Bestätigung der Regulierung. Die
Bankverbindung der Leasinggesellschaft ist vor Zahlungsanweisung in VERA zu
verifizieren.

**Wiederholte Glasschäden am selben Fahrzeug innerhalb eines Jahres:** Ab dem
dritten Glasschaden im Kalenderjahr ist ein Hinweis an die Betrugsprävention
zu erfassen; die Regulierung selbst wird dadurch nicht verzögert.

---

Rückfragen zu dieser Arbeitsanweisung richten Sie an die Teamleitung
Kfz-Sachschaden.
