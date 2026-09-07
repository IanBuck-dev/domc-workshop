# Drehbuch: Kündigung eines Sachversicherungsvertrags bearbeiten

Dieses Szenario ist der reale Codex-Tuningfall für die Prozessaufnahme. Die
wörtlichen Antworten stehen in `drehbuch.json`. Im Test werden sie nicht blind
nach Nummer abgesendet, sondern passend zur jeweils gestellten Frage genutzt.

## Persona und fachlicher Rahmen

Edda Brandt arbeitet im Serviceteam Bestand der LifeCorp Versicherung. Sie
bearbeitet den heutigen Kündigungsprozess für Kfz, Hausrat und Wohngebäude.
Edda kennt die praktische Arbeit, beschreibt sie aber nicht in
Prozessmodellierungsbegriffen. Sie soll frei und ausführlich antworten können,
während der Agent die Angaben in die feste Prozessstruktur überführt.

Der Fall ist absichtlich vertraut und relevant für Versicherungsmanager: rund
1.600 Vorgänge im Monat, viele Freitexteingänge, produktabhängige Regeln,
fehlende Nachweise, Rückfrageschleifen und mehrere Systemübergaben.

## Die zwei Eingaben

1. `Arbeitsanweisung_Vertragskuendigung_Sach.pdf` beschreibt einen plausiblen
   achtstufigen Hauptablauf. Sie lässt Nachweisarten, genaue Fristregeln,
   Kontrollgrenzen und finanzielle Übergaben bewusst offen.
2. `Beispiel_Kuendigungsanfrage.txt` ist eine konkrete Kunden-E-Mail. Sie nennt
   gleichzeitig "zum nächstmöglichen Zeitpunkt" und einen Hausverkauf, enthält
   aber keinen Nachweis und kein eindeutig belegtes Übergangsdatum.

Beide Dateien sind vollständig erfunden. Die zweite Datei ist kein Beweis für
eine allgemeine Prozessregel, sondern nur ein Beispielfall, an dem der Agent
die Arbeitsweise erfragen soll.

## Durchführung

1. `bun run seed vertragskuendigung-sach` legt einen frischen Chat-Prozess an
   und friert die aktuellen Prompt- und Schemafassungen ein.
2. In der App beide Dokumente gemeinsam auswählen und analysieren lassen.
3. Der Agent soll daraus ein erstes Prozessbild mit ungefähr acht Schritten
   ableiten und anschließend immer nur einen Schritt gleichzeitig prüfen.
4. Antworten aus `drehbuch.json` passend zur Agentenfrage einfügen. Bei einer
   unerwarteten, sinnvollen Frage im Stil von Edda frei ergänzen.
5. Erst nach der ausdrücklichen Abschlussantwort aus Zug 11 zur Prüfung des
   gesamten Prozessbilds übergehen.

## Erwartete Gesprächsführung

- Nach der Dokumentenanalyse nennt der Agent kurz, was er bereits verstanden
  hat, und zeigt den aktuellen Schritt sowie die noch fehlenden Angaben.
- Pro Nachricht bleibt genau ein Prozessschritt aktiv. Eine kurze
  Sammelübersicht am Anfang ist erlaubt, danach kein Sprung zwischen mehreren
  Detailthemen.
- Jede Frage lädt zu einer freien Beschreibung ein. Reine Ja-Nein-Fragen oder
  ein endloser Katalog einzelner Mikrofragen sind Fehlersignaturen.
- Nach einer Antwort fasst der Agent die neuen Informationen korrekt zusammen
  und fragt nach der Bestätigung des Schritts, bevor er weitergeht.
- Der Agent trennt den dokumentierten Hauptablauf, Eddas gelebte Praxis und den
  konkreten Beispielfall anhand ihrer Provenienz.

## Fachliche Prüfpunkte

- Der fertige Ist-Ablauf enthält acht nachvollziehbare Schritte: Eingang,
  Zuordnung, Kündigungsart, formale Prüfung, Beendigungsdatum, Rückfrage,
  Erfassung und Abschluss.
- Systeme bleiben konsistent: Exchange Online für E-Mail und Rückfragen, VERA
  für Vertrag und Beendigung, AKTE für Vorgang und Dokumente, SAP S/4HANA nur
  als nachgelagerte Übergabe eines Guthabens.
- Der Hausverkauf aus der Beispielmail führt nicht automatisch zum 31. August
  als Beendigungsdatum. Fehlender Nachweis und Eigentumsübergang müssen sichtbar
  offen bleiben.
- Produktabhängige Fristen werden nicht erfunden. VERA und verlinkte
  Vertragsunterlagen sind die aktuellen Quellen; uneindeutige Fälle gehen an
  das Bestandsfachteam.
- Die Rückfrageschleife aus AKTE über Exchange und zurück in die Bearbeitung
  muss im Prozessbild erkennbar sein, ohne den Hauptfluss mit jeder kleinen
  Ausnahme aufzublähen.
- Kontrollumfang ist differenziert: zweite Person bei rückwirkenden oder
  unklaren besonderen Kündigungen, Stichprobe im normalen fristgerechten Fall.
- Die offenen Verkaufsnachweise und die möglicherweise uneinheitliche
  Kontrollpraxis bleiben als Wissenslücken stehen.

## Erwartete Ausgangslage für KI-Potenziale

Die spätere Analyse sollte Potenziale zur Klassifikation und Extraktion von
Kündigungseingängen, zum belegten Abgleich produktabhängiger Regeln, zur
Vorbereitung gezielter Rückfragen und zum Nachhalten offener Fälle erkennen.
Sie darf weder die fachliche Zulässigkeit einer besonderen Kündigung noch das
Beendigungsdatum ohne menschliche Kontrolle autonom festlegen. Ein agentisches
Zielbild kann die Fallbearbeitung innerhalb dieser Leitplanken orchestrieren,
braucht aber klare Eskalation bei fehlenden Nachweisen und uneindeutigen Regeln.

## Fehlersignaturen

- Der Agent übernimmt die Arbeitsanweisung nur als fertige Wahrheit und fragt
  die bewusst ausgelassenen Details nicht nach.
- Die Beispielmail wird als allgemeine Prozessbeschreibung behandelt.
- Der Agent setzt Verkaufstag, Vertragsende oder Sonderkündigungsrecht ohne
  bestätigte Grundlage fest.
- Mehrere Schritte werden gleichzeitig in einer langen Fragenliste behandelt.
- Nach Zug 11 beginnt eine neue allgemeine Fragerunde, obwohl die verbleibenden
  Unsicherheiten bereits als offene Punkte benannt sind.
