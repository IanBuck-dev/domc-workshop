# Drehbuch: Kfz-Glasschaden-Regulierung

Adressiert an Florian. Dieses Drehbuch spielt den sauberen Fall: gut
dokumentiert, klarer Ablauf, drei sich ergänzende Dokumente. Tuningziel ist
die Grundleistung der Prozessaufnahme - nicht das Erkennen von Widersprüchen
(das prüft `beitragsanpassung`) und nicht die Gesprächsführung ohne Textstütze
(das prüft `provisionsabrechnung`).

## Persona in diesem Szenario

**Edda Brandt**, Fachbereichs-Mitarbeiterin Schaden, bearbeitet die
Kfz-Glasschadenfälle, die nicht automatisch über die Clearing-Schnittstelle
mit den Partnerwerkstätten laufen. Sie kennt ihren Ablauf im Detail, spricht
aber wie eine erfahrene Sachbearbeiterin und nicht wie ein Prozesshandbuch:
knapp, mit Systemnamen als Selbstverständlichkeit, ohne Modellierungsvokabular.

## Spielanleitung

1. Prozess seeden: `bun run seed kfz-glasschaden`. Das legt den Prozess mit
   den drei Dokumenten aus `dokumente/` an (als Upload angehängt) und öffnet
   ihn im Chat-Modus.
2. Im Sidecar links ist dieses Szenario vorausgewählt (`cover.processName`
   passt). Die Züge aus `drehbuch.json` erscheinen dort der Reihe nach als
   klickbare Antworten - ein Klick füllt den Composer, abgeschickt wird von
   Hand.
3. Die Züge unten sind durchnummeriert und referenzieren `drehbuch.json` nur
   per Nummer; die Antworten selbst stehen nicht doppelt in diesem Dokument.
4. Nach jedem Zug das laufende Prozessbild gegen die "Erwartung" unten
   halten. Weicht die Antwort des Assistenten deutlich ab, siehe
   "Fehlersignatur" für den wahrscheinlichsten Grund.

## Züge

### Zug 1 - Prozessüberblick

**Erwartung:** Der Assistent hält fest, dass der Prozess nur den manuellen
Anteil der Glasschadenregulierung betrifft (Fälle ohne funktionierendes
Clearing), nicht die automatisierte Direktabrechnung. `purpose`, `trigger`
und `outcome` werden befüllt, `boundaries` grenzt den automatisierten Anteil
explizit aus. Höchstens eine Rückfrage.

**Fehlersignatur:** Der Assistent behandelt den gesamten Glasschadenprozess
inklusive Clearing als einen einzigen manuellen Ablauf, oder fragt mehr als
eine Sache auf einmal.

### Zug 2 - Erste Hauptschritte

**Erwartung:** Zwei Schritte entstehen (Schadenerfassung in KOMPASS,
Deckungsprüfung in VERA) mit korrekter Systemzuordnung. Die
Ablehnungsverzweigung bei fehlender Deckung wird als Decision am
Deckungsprüfungsschritt erfasst, nicht als eigener Hauptschritt.

**Fehlersignatur:** KOMPASS und VERA werden vertauscht oder die Ablehnung
erzeugt einen eigenen, unnötigen Hauptschritt.

### Zug 3 - Restliche Hauptschritte

**Erwartung:** Rechnungsprüfung, Selbstbeteiligungsabzug (150 €), Auszahlung
über SAP FI und Ablage in AKTE entstehen als eigene, klar unterscheidbare
Schritte in dieser Reihenfolge. Die 150-€-Selbstbeteiligung landet als
konkreter Wert in einem Schritt oder dessen `miscellaneous`.

**Fehlersignatur:** Rechnungsprüfung und Selbstbeteiligung werden zu einem
Schritt verschmolzen, oder SAP FI erscheint nicht als System der
Auszahlung.

### Zug 4 - Systeme

**Erwartung:** Alle fünf Systeme (KOMPASS, VERA, SAP FI, AKTE, PARTO) werden
korrekt benannt; PARTO wird als im Hintergrund laufendes, von Edda nicht
aktiv genutztes System erkannt statt als eigener Arbeitsschritt.

**Fehlersignatur:** PARTO fehlt vollständig oder wird fälschlich als Schritt
in Eddas eigenem Ablauf dargestellt.

### Zug 5 - Entscheidungen und Kontrollen

**Erwartung:** Deckungsprüfung und Rechnungsplausibilität werden als zwei
getrennte Decisions erfasst, nicht zusammengefasst. Die abweichende
Auszahlung bei Leasing wird als Sonderfall vermerkt, nicht als reguläre
Übergabe an eine dritte Rolle.

**Fehlersignatur:** Nur eine einzige, grobe "Prüfung" als Decision, ohne die
fachliche Unterscheidung zwischen Deckung und Rechnung.

### Zug 6 - Mengen und Dauer

**Erwartung:** `volumeAndTime` enthält ungefähr 25-30 manuelle Fälle pro
Woche bei insgesamt rund 90 Fällen/Woche (also ca. 70 % Direktabrechnung)
sowie die Bearbeitungsdauer von 15-20 Minuten je Fall.

**Fehlersignatur:** Die genannten Zahlen werden verändert oder zusätzliche,
nicht genannte Zahlen erfunden.

### Zug 7 - Probleme

**Erwartung:** Zwei Pain Points erscheinen getrennt: Nachfragen bei
Werkstätten (ca. jeder zehnte Fall) und Fälle, die eigentlich automatisch
hätten laufen sollen, aber wegen fehlender Clearing-Zuordnung manuell
landen.

**Fehlersignatur:** Nur ein vager, zusammengefasster Pain Point ohne die
Clearing-Fehlläufer als eigenständiges, wiederkehrendes Problem.

### Zug 8 - Sonderfälle

**Erwartung:** Oldtimer (Gutachten vor Auszahlung) und Leasing (Auszahlung an
Leasinggesellschaft, Kontoprüfung in VERA) werden als Varianten innerhalb
bestehender Schritte (Rechnungsprüfung bzw. Auszahlung) erfasst, nicht als
zusätzliche Hauptschritte im linearen Ablauf.

**Fehlersignatur:** Die Sonderfälle erzeugen eigene Hauptschritte und
sprengen damit unnötig die Acht-Schritte-Grenze bzw. verzerren den
Normalablauf.

### Zug 9 - Rückfrage zu Freigaben

**Erwartung:** Dieser Zug beantwortet eine erwartbare Rückfrage zum
Vier-Augen-Prinzip. Der Assistent aktualisiert `controls` entsprechend
(Eddas Eigenverantwortung, informelle Eskalation bei ungewöhnlich hohen
Summen) und wiederholt keine bereits beantwortete Frage.

**Fehlersignatur:** Der Assistent fragt erneut nach Freigaben, obwohl die
Antwort bereits vorliegt, oder erfindet eine formale Freigabepflicht.

### Zug 10 - Rückfrage zur Fallliste

**Erwartung:** `documentCoverage` für die Fallliste (CSV) wird auf
`complete` gesetzt, die Spalte "Direktabrechnung" korrekt als Unterscheidung
zwischen Clearing- und manuellen Fällen interpretiert.

**Fehlersignatur:** `documentCoverage` bleibt `partial` ohne nachvollziehbare
`limitation`, oder die CSV-Spalten werden falsch gedeutet.

## Erwartungen an das fertige Prozessverständnis

- **Schrittzahl:** 6-8 Hauptschritte, deckungsgleich mit den sechs
  nummerierten Abschnitten aus `dokumente/arbeitsanweisung-glasschaden.md`
  (Sonderfälle fließen als Varianten in bestehende Schritte ein, nicht als
  eigene Schritte).
- **Systeme:** KOMPASS, VERA, SAP FI, AKTE und PARTO müssen alle vorkommen,
  korrekt der jeweiligen Rolle zugeordnet (PARTO passiv/im Hintergrund).
- **documentCoverage:** alle drei Dokumente auf `complete`, keine
  `knowledgeGaps` zu Inhalten, die tatsächlich in den Dokumenten stehen
  (z. B. Selbstbeteiligungshöhe, Oldtimer- und Leasingregel).
- **Werte:** Selbstbeteiligung 150 €, ca. 90 Fälle/Woche mit ca. 70 %
  Direktabrechnung, Bearbeitungsdauer 15-20 Minuten je manuellem Fall.

## Erwartungen an die Potenzialanalyse

Plausible, evidenzbasierte Hypothesen, die aus diesem Prozess entstehen
sollten:

- **Automatisierung der Rechnungsprüfung bei kleinen, plausiblen Beträgen**
  ("Dunkelverarbeitung"): Ein Großteil der manuellen Fälle liegt unter dem
  1.200-€-Schwellenwert des Clearings und folgt erkennbaren Mustern
  (Fallliste zeigt wiederkehrende Werkstätten und Beträge im dreistelligen
  Bereich) - ein plausibler Kandidat für automatisierte Vorprüfung mit
  menschlicher Stichprobe statt Vollprüfung jedes Falls.
- **Bessere Erkennung fehlerhaft geclearter Fälle:** Die wiederkehrende
  Ursache "eigentlich Partnerwerkstatt, aber Clearing-Kennzeichen fehlt"
  (siehe `systemhinweise-clearing.txt`) ist eine konkrete, benannte
  Fehlerquelle - Kandidat für eine automatisierte Vorprüfung oder ein
  Frühwarnsystem beim Werkstatt-Onboarding, nicht für die Regulierung
  selbst.
- **Vorausgefüllte Deckungsprüfung:** Da Deckung (VERA) und Schadenerfassung
  (KOMPASS) beide strukturierte Systemfelder sind, ist ein automatischer
  Abgleich bei Schadenanlage plausibel, statt dass Edda ihn manuell
  nachschlägt.

Nicht plausibel bzw. nicht durch die Evidenz gedeckt: vollautomatische
Auszahlung ohne jede menschliche Prüfung (die Rechnungsprüfung bleibt
fachliches Urteilsvermögen bei Abweichungen, siehe Zug 3 und
`arbeitsanweisung-glasschaden.md` Abschnitt 3.4), sowie jede Aussage zu
Kosteneinsparungen oder konkreten Einsparsummen (außerhalb des
Produktrahmens dieser App).
