# Drehbuch: Leitungswasserschaden Wohngebäude regulieren

Dieses Szenario ist der Präsentationsfall für Versicherungsmanagement. Es zeigt keinen exotischen Sonderprozess, sondern eine sofort erkennbare Schadenstrecke: hoher Eingang, unstrukturierte Unterlagen, fachliche Entscheidungen, externe Partner, Medienbrüche, Fristen und Kundenkommunikation. Die Daten sind vollständig erfunden und gehören zur LifeCorp Versicherung VVaG.

## Persona und Präsentationsziel

Edda Brandt arbeitet in der Sach-Schadenregulierung. Sie beschreibt ihren Alltag konkret und ohne Prozesssprache. Das fertige Prozessbild soll zeigen, dass die Anwendung Regeln, professionelles Urteil und kleine Ausnahmen auseinanderhalten kann. Die Potenzialanalyse soll keinen vollautomatischen Schadenentscheid empfehlen, sondern einen agentischen Arbeitsbegleiter: Unterlagen lesen, Vollständigkeit prüfen, den Fall vorbereiten, externe Rückmeldungen nachhalten und die Sachbearbeitung bei einer belegten Entscheidung unterstützen.

## Spielanleitung

1. `bun run seed leitungswasserschaden-wohngebaeude` legt den Chat-Prozess mit drei Unterlagen an.
2. Zuerst werden die Unterlagen über **Unterlagen auswerten** verarbeitet.
3. Danach werden die acht Antworten aus `drehbuch.json` der Reihe nach gesendet. Im Sidecar ist das Szenario anhand des Prozessnamens automatisch ausgewählt.
4. Nach jeder Antwort werden Diagramm, Quellenbezug und offene Punkte geprüft. Bestätigt wird erst, wenn Hauptablauf, Übergaben und Ausnahmen stimmen.
5. Nach der Bestätigung folgen PDD-Export, Potenzialanalyse, drei Aufsichtsszenarien, Potenzialbewertung und deren Excel-Export.

## Erwartetes Prozessverständnis

- Der Hauptablauf enthält Anlage, Deckungsprüfung, Unterlagenvervollständigung, Triage/Gutachtersteuerung, fachliche Positionsprüfung, Reserve, Zahlung und Abschluss.
- Fehlende Deckung endet in einer begründeten Ablehnung. Unklare Deckung geht an Fachsupport Vertrag.
- Die Gutachterentscheidung trennt die feste Wertgrenze von professionellem Urteil unterhalb der Grenze.
- Fehlende Unterlagen und neue Belege nach Widerspruch erzeugen Rückschleifen, keine zusätzlichen linearen Hauptprozesse.
- Unbewohnbarkeit ist eine zeitkritische Ausnahme am Fall, nicht der Normalablauf.
- Betrugsprüfung und Regress sind externe Übergaben. Die Anwendung darf daraus keine automatische Ablehnung ableiten.
- KOMPASS, VERA, PARTO, AKTE, SAP FI und Outlook werden mit ihrer tatsächlichen Rolle erfasst.
- Die Fallübersicht belegt 276 Fälle im Quartal, 168 vollständige Ersteinreichungen, 112 Gutachterbeauftragungen und eine mediane Durchlaufzeit von 19 Tagen. Daraus dürfen keine erfundenen Finanzwerte entstehen.

## Erwartete KI-Potenziale

1. **Agentische Fallvorbereitung:** Eingänge aus Portal, PDF und Bild lesen, dem Fall zuordnen, Vollständigkeit gegen Falltyp prüfen und fehlende Belege als Vorschlag vorbereiten.
2. **Gutachter-Orchestrierung:** Beauftragungsgrund, Frist und Status aus KOMPASS, Outlook und Teamliste zusammenführen; ausstehende Terminbestätigungen sichtbar machen und Nachfassaktionen vorbereiten.
3. **Belegbasierte Prüfassistenz:** Kostenvoranschlag und Gutachten positionsweise gegenüberstellen, Auffälligkeiten und fehlende Deckungsbezüge markieren, aber Kürzung und Leistungsentscheidung beim Menschen lassen.
4. **Ausnahme- und Übergabeerkennung:** Unbewohnbarkeit, Verdachtsmerkmale und Rückgriffshinweise früh erkennen und mit Belegen an den richtigen Prozess übergeben.

## Fehlersignaturen

- Die Anwendung modelliert Hausrat, Betrugsprüfung oder Regress als Teil des normalen Wohngebäude-Regulierungsablaufs.
- Die 5.000-Euro-Grenze wird als einzige Gutachterregel behandelt und das professionelle Urteil verschwindet.
- Die Empfehlung lautet auf vollautomatische Deckungs- oder Leistungsentscheidung ohne menschliche Verantwortung.
- Die Anwendung erfindet Einsparbeträge, regulatorische Zulässigkeit oder einen Gesamtscore.
- Outlook und Teamliste werden übersehen, obwohl genau dort das managementrelevante Steuerungsproblem liegt.
