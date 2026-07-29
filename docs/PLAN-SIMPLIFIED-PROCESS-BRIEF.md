# Implementierungsplan: vereinfachter Prozesssteckbrief

## Status und feste Entscheidungen

- Arbeitsbranch: `feat/simplified-process-brief`.
- Entwicklung und Abnahme erfolgen ausschließlich lokal.
- Dieser Branch wird ohne ausdrückliche Freigabe weder gepusht noch auf den
  Raspberry Pi deployt.
- Die Prozessaufnahme bleibt ein Zwei-Seiten-Flow mit fünf Themenblöcken,
  höchstens einer Rückfrage je Themenblock und fünf bis acht Hauptschritten.
- Die Ergebnisansicht zeigt keine eigenständigen Übersichtsblöcke mehr für
  Zweck, Auslöser, Ergebnis, Abgrenzung, Beteiligte, Systeme, Entscheidungen,
  Kontrollen, Übergaben, Mengen, Probleme, Verbesserungsziele oder
  Arbeitsmerkmale.
- Der sichtbare und korrigierbare Hauptoutput besteht aus Diagramm und
  Schritten. Jeder Prozessschritt enthält genau die fachlichen Bereiche
  `Input`, `Output`, `Informationen`, `Varianten und Entscheidungen` und
  `Sonstiges`.
- `Unterlagen und offene Punkte`, erkannte Widersprüche und `Noch unbekannt`
  bleiben sichtbar. Wissenslücken werden nicht mit Einschränkungen der
  Dateiverarbeitung vermischt.
- Fehlende Quellen, Arten, Kriterien, Folgen oder Entscheidungsoptionen bleiben
  `null`, `unknown` oder leere Listen. Weder KI noch Legacy-Migration erzeugen
  erfundene Details.
- Der bestehende Provenienz-, Evidenz-, Korrektur- und Auditmechanismus bleibt
  erhalten. Ein Prozessschritt bleibt eine gemeinsam belegte fachliche Einheit;
  verschachtelte Details erhalten in diesem Schritt keine eigene Provenienz.

## Ziel

Der Prozesssteckbrief soll in wenigen Sekunden erfassbar sein und gleichzeitig
genug strukturierte fachliche Substanz für die spätere KI-Potenzialentdeckung
liefern. Die Seite beantwortet zuerst zwei Fragen:

1. Wie läuft der Prozess auf hoher Ebene ab?
2. Welche Inputs, Outputs, Informationen und Entscheidungen prägen jeden
   Hauptschritt?

Der neue Contract trennt dabei ausdrücklich:

- ein- und ausgehende fachliche Objekte;
- die in einem Schritt verwendeten Einzelinformationen;
- Quelle und Art jeder Einzelinformation;
- Entscheidungsfrage, Entscheidungsmodus, Optionen, Feststellung und Folge;
- noch unstrukturierten Restkontext in `Sonstiges`.

## Nicht-Ziele

- keine Änderung der fünf Eingabethemen oder vier Arbeitsmerkmale;
- keine zusätzliche KI-Rückfragerunde;
- keine seltenen Edge Cases oder vollständigen BPMN-Verzweigungsbäume;
- keine Bewertung, Wirtschaftlichkeit, Machbarkeit oder Priorisierung;
- kein manuelles Hinzufügen oder Löschen kompletter Hauptschritte;
- keine Änderung des Opportunity-Szenario-Contracts;
- kein Import- oder Exportformat für BPMN;
- kein Pi-Deployment und kein Live-Test auf
  `claims-ai.ian-buck.dev` in diesem Branch.

## Exakter Seitenaufbau

Die Reihenfolge ist Bestandteil der Abnahme und darf nicht durch responsive
Layouts verändert werden.

```text
Capture-Seitenkopf
├─ Zurücklink: Zum Prozess
├─ Seite 2 von 2 · PROC-XXXX
├─ Prozessname und Fortschrittsanzeige auf einer Titelzeile
├─ Fachbereich · eingereicht von Person
└─ vier Schritte: Beschreiben, Ergänzen, Prüfen, Bestätigt

Ergebnis: Prozesssteckbrief
├─ Kicker: ERGEBNIS
├─ Titel: Prozesssteckbrief
├─ ein kompakter Prüfsatz
└─ Aktion: Prozessbild korrigieren

Diagramm
├─ Überschrift: Diagramm
└─ 5–8 verbundene Knoten
   ├─ Schrittnummer
   └─ Schrittbezeichnung

Schritte
├─ Überschrift: Schritte
└─ 5–8 Accordion-Karten in Prozessreihenfolge
   ├─ geschlossen
   │  ├─ Schrittnummer
   │  ├─ Schrittbezeichnung
   │  ├─ kompakte Aktivitätsbeschreibung
   │  └─ Chevron für geschlossen/geöffnet
   └─ geöffnet
      ├─ Input
      ├─ Output
      ├─ Informationen
      │  └─ Tabelle: Information | Quelle | Art
      ├─ Varianten und Entscheidungen
      │  └─ je Entscheidung
      │     ├─ Entscheidungsfrage
      │     ├─ Modus
      │     └─ Tabelle: Option | Feststellung | Folge
      └─ Sonstiges

Unterlagen und offene Punkte
├─ je ausgewählter Datei
│  ├─ Dateiname
│  ├─ Verarbeitungsstatus
│  ├─ Einschränkung, falls vorhanden
│  └─ Vorschau öffnen; Download bleibt im Vorschaudialog
└─ Erkannte Widersprüche
   └─ Liste oder eindeutiger Leerzustand

Noch unbekannt
└─ Liste fachlicher Wissenslücken oder eindeutiger Leerzustand

Abschluss
├─ vor Bestätigung: Prozessbild fachlich bestätigen
└─ nach Bestätigung: Dieses Prozessbild wurde fachlich bestätigt
```

### Capture-Seitenkopf und Fortschritt

- Auf Desktop stehen Prozessname und Fortschrittsanzeige in derselben
  Titelzeile. Die Mittelpunkte der Nummernkreise sind vertikal am Prozessnamen
  ausgerichtet; die Beschriftungen unter den Kreisen zählen nicht zur
  Ausrichtung.
- Der Fortschritt besteht aus vier gleich breiten Schritten und horizontalen
  Verbindungslinien. Jede Linie ist `1px` hoch und verwendet eine gegenüber
  den Kreisen bewusst zurückhaltende Farbe.
- Nur der aktuelle Schritt besitzt einen gefüllten Kreis. Bereits durchlaufene
  Schritte sind grün umrandet, spätere Schritte neutral und ungefüllt.
- Der Abstand zwischen Nummernkreis und Beschriftung bleibt in allen Zuständen
  identisch.
- Der Desktop-Tracker erhält für die optische Ausrichtung der Nummernkreise
  einen vertikalen Offset von `12px`. Unterhalb von `1024px` steht der Tracker
  unter dem Prozessnamen, nimmt die verfügbare Breite ein und verwendet keinen
  Offset.

### Sichtbare Texte und Leerzustände

- Seitentitel: `Prozesssteckbrief`.
- Einleitung: `Prüfen Sie das Diagramm und die Details der einzelnen
Hauptschritte. Fehlende Angaben bleiben sichtbar.`
- Diagrammtitel: `Diagramm`.
- Schritttitel: `Schritte`.
- Unterhalb des Schritttitels erscheint kein zusätzlicher Bedienhinweis.
- Leere Inputs oder Outputs: `Noch nicht bekannt`.
- Leere Informationstabelle: `Keine Informationen benannt`.
- Fehlende Informationsquelle: `Quelle noch unbekannt`.
- Informationsart `unknown`: `Art noch unbekannt`.
- Keine Entscheidung: `Keine Entscheidung erforderlich oder benannt`.
- Entscheidung ohne Optionen: `Entscheidungsoptionen noch unbekannt`.
- Fehlende Feststellung: `Feststellung noch unbekannt`.
- Fehlende Folge: `Folge noch unbekannt`.
- Leeres Sonstiges: `Keine weiteren Angaben`.
- Keine Dateien: `Keine Unterlagen ausgewählt`.
- Keine Widersprüche: `Keine Widersprüche erkannt`.
- Keine Wissenslücken: `Keine offenen Wissenslücken dokumentiert`.

### Diagramm

- Ein Knoten zeigt ausschließlich `Schritt {order}` und `name`.
- Rollen, Systeme, Aktivität und sonstige Metadaten erscheinen nicht im
  Diagrammknoten.
- Die sichtbare Diagrammreihenfolge und die Accordion-Reihenfolge müssen exakt
  identisch sein.
- Die zugängliche Repräsentation enthält dieselben Schrittnamen genau einmal;
  es gibt keine zusätzlich sichtbare Langtextliste unter dem Diagramm.
- Desktop: eine horizontal verbundene Reihe mit kontrolliertem internem Scroll
  bei fünf bis acht Schritten.
- Tablet: horizontal scrollbar innerhalb des Diagramms; die Seite selbst darf
  keinen horizontalen Overflow haben.

### Accordion-Karte

Der geschlossene Header bleibt bewusst kompakt. `activity` ist auf eine kurze
fachliche Beschreibung begrenzt. Nach dem Öffnen erscheinen die fünf Bereiche
in der festgelegten Reihenfolge.

Die Schrittnummer steht in einem festen kreisförmigen `32px`-Element. Kreis und
Ziffer sind horizontal und vertikal zur gesamten geschlossenen
Schritt-Zusammenfassung zentriert. Da die Nummer bereits im Kreis steht,
beginnt die textliche Bezeichnung direkt mit dem Schrittnamen und enthält kein
zusätzliches Präfix `Schritt N:`.

`Informationen` werden als responsive Tabelle gerendert. Unterhalb von 900 px
werden die drei Spalten pro Information als beschriftete Zeilen in einer Karte
angeordnet; die Semantik der Überschriften bleibt zugänglich.

`Varianten und Entscheidungen` zeigt jede Entscheidung als eigene Teilkarte.
Der Modus erhält fachliche deutsche Bezeichnungen:

- `rule_based` → `Feste Regel`;
- `professional_judgement` → `Fachliche Einschätzung`;
- `mixed` → `Regel und fachliche Einschätzung`;
- `unknown` → `Noch nicht bekannt`.

Die Konsequenz kann auf einen späteren Prozessschritt verweisen. Die UI zeigt
dann zusätzlich `Weiter mit Schritt N: {name}`. Ein fehlender Verweis wird nicht
als Fehler dargestellt, solange die textliche Folge vorhanden oder unbekannt
ist.

`Sonstiges` ist im Lesemodus normaler kompakter Text. Im Korrekturmodus ist es
ein mehrzeiliges Freitextfeld. Es wird nicht als Sammelfeld verwendet, wenn die
Information in einen der vier strukturierten Bereiche gehört.

## Kanonischer Domain-Contract v2

`ProcessUnderstanding` erhält `schemaVersion: 2`. Die bestehenden globalen
Fakten bleiben vorerst im kanonischen Objekt, damit gespeicherter Kontext,
Provenienz und der bestehende Opportunity-Snapshot kompatibel bleiben. Sie
werden in der vereinfachten Ergebnisansicht weder gerendert noch korrigiert.

Der Prozessschritt wird auf folgenden aktuellen Contract umgestellt:

```ts
type ProcessInformationType =
  | "system_field"
  | "email"
  | "spreadsheet"
  | "document"
  | "image_or_scan"
  | "free_text"
  | "database_or_report"
  | "other"
  | "unknown";

type ProcessDecisionMode =
  "rule_based" | "professional_judgement" | "mixed" | "unknown";

interface ProcessInformationItem {
  id: string;
  name: string;
  source: string | null;
  type: ProcessInformationType;
}

interface ProcessDecisionOption {
  id: string;
  label: string;
  determination: string | null;
  consequence: string | null;
  nextStepId: string | null;
}

interface ProcessDecision {
  id: string;
  question: string;
  mode: ProcessDecisionMode;
  options: ProcessDecisionOption[];
}

interface ProcessStepV2 {
  id: string;
  order: number;
  name: string;
  activity: string;
  inputs: string[];
  outputs: string[];
  informationItems: ProcessInformationItem[];
  decisions: ProcessDecision[];
  miscellaneous: string | null;
  provenance: ProcessProvenance;
  evidenceIds: string[];
  confidence: number | null;
  assumptions: string[];
  confirmed: boolean;
}
```

### Domain-Invarianten

- Es bleiben genau fünf bis acht fortlaufend sortierte Prozessschritte.
- Schritt-IDs sind eindeutig.
- `activity` ist verpflichtend und maximal 1.000 Zeichen lang.
- `inputs` und `outputs` enthalten jeweils höchstens 30 eindeutige, nicht leere
  Einträge mit maximal 1.000 Zeichen.
- Ein Schritt enthält höchstens 40 Informationsobjekte.
- Informations-IDs sind innerhalb des gesamten Prozessverständnisses
  eindeutig.
- `name` ist verpflichtend; `source` ist `null`, wenn sie nicht belegt ist.
- `type` ist immer einer der festgelegten Werte; Unsicherheit wird als
  `unknown` gespeichert und nicht als Freitexttyp erfunden.
- Ein Schritt enthält höchstens 20 Entscheidungen.
- Entscheidungs-IDs sind innerhalb des gesamten Prozessverständnisses
  eindeutig.
- Jede Entscheidung hat eine fachliche Frage und höchstens 20 Optionen.
- Options-IDs sind innerhalb ihrer Entscheidung eindeutig.
- `determination`, `consequence` und `nextStepId` dürfen `null` sein.
- Ein gesetztes `nextStepId` muss auf einen vorhandenen Prozessschritt zeigen.
- Ein Rücksprung auf denselben Schritt ist zulässig, wenn er fachlich explizit
  belegt ist; unbekannte Schleifen werden nicht inferiert.
- `miscellaneous` ist `null` oder maximal 4.000 Zeichen lang.
- Evidenzreferenzen eines Schritts müssen weiterhin auf vorhandene
  Evidenzeinträge zeigen.
- Änderungen eines verschachtelten Schrittwertes markieren den gesamten
  Schritt über den bestehenden Korrekturmechanismus als `user_confirmed` und
  erzeugen genau einen neuen `human_correction`-Evidenzeintrag.

## Legacy-Kompatibilität

Bestehende `process-understanding.json`-Dateien besitzen keine
`schemaVersion` und enthalten den bisherigen Schrittcontract. Sie dürfen nach
dem Merge weiterhin gelesen, angezeigt, korrigiert und für Opportunity-Records
verwendet werden.

### Leseweg

- `processUnderstandingV2Schema` validiert ausschließlich den neuen Contract.
- `legacyProcessUnderstandingSchema` validiert ausschließlich den bisherigen
  Contract und bleibt intern.
- `processUnderstandingStorageSchema` akzeptiert v2 oder Legacy und gibt immer
  ein validiertes v2-Objekt zurück.
- Neue KI-Antworten und Korrektur-API-Aufrufe verwenden ausschließlich
  `processUnderstandingV2Schema`; sie dürfen nicht still als Legacy migriert
  werden.
- Der Repository-Leseweg verwendet `processUnderstandingStorageSchema`, bevor
  das Ergebnis in `processCaptureRecordSchema` eingesetzt wird.
- Gespeicherte Opportunity-Snapshots werden beim Lesen mit demselben
  Understanding-Migrationsschritt normalisiert. Erfolgreiche historische
  Opportunity-Ergebnisse werden nicht neu berechnet.
- Eine Migration beim Lesen schreibt keine Datei. Erst eine echte fachliche
  Korrektur speichert die kanonische v2-Struktur atomar und dokumentiert das
  vollständige Vorher/Nachher im bestehenden Auditverlauf.

### Deterministische Legacy-Abbildung

Für jeden alten Schritt gilt:

- `id`, `order`, `name`, `activity` und Fact-Metadaten bleiben unverändert.
- `trigger` wird, falls vorhanden, zum ersten `input`.
- das alte `output` wird als einziger `outputs`-Eintrag übernommen.
- jeder alte `information`-Eintrag erzeugt zusätzlich ein
  `informationItem` mit stabilem migrationsbasiertem ID-Präfix,
  `source: null` und `type: "unknown"`.
- alte `systems` werden nicht pauschal einzelnen Informationen zugeordnet.
- ein vorhandener alter `decision`-Text erzeugt eine Entscheidung mit
  `mode: "unknown"` und leerer Optionsliste.
- `miscellaneous` erhält nur bisherige Angaben, die andernfalls verloren
  gingen: verantwortliche Rollen, Systeme, Regel oder fachliche Einschätzung,
  Übergabe, Kontrollen und Probleme. Jeder Bereich erhält eine kurze
  Bezeichnung und nur tatsächlich vorhandene Werte.
- Kein Legacy-Wert wird zur Informationsquelle, Informationsart,
  Entscheidungsoption oder Prozessverzweigung hochgestuft, wenn diese Zuordnung
  nicht eindeutig im alten Contract enthalten war.

## KI-Synthesecontract

`defaults/ai-schemas/process-understanding.json` wird auf
`schemaVersion: 2` und den neuen Schrittcontract umgestellt. Alle verschachtelten
Objekte bleiben `additionalProperties: false`.

Der AI-Response-Contract enthält weiterhin die fachlichen Schritt-IDs, aber
keine IDs für Informationen, Entscheidungen oder Optionen. Nach erfolgreicher
AI-Validierung vergibt eine reine Domain-Normalisierung deterministische IDs aus
Schritt-ID und Listenposition. Dadurch stammen kanonische Referenz-IDs nicht aus
freiem Modelltext. Im Korrekturmodus neu angelegte verschachtelte Einträge
erhalten UUIDs im Browser und werden anschließend vollständig serverseitig
validiert.

`defaults/prompts/process-synthesis.md` erhält folgende verbindliche Regeln:

- Input und Output sind konkrete fachliche Objekte, Zustände oder Ergebnisse,
  keine Aktivitätswiederholungen.
- Jede Information wird einzeln benannt.
- Quelle bezeichnet die konkrete sichtbare Herkunft, zum Beispiel
  `SAP FSCD / ZDECD_LI_UI / Spalte MS`, `Gruppenpostkorb` oder
  `Arbeitsanweisung FSCD Mahnung`.
- Art beschreibt die Form der Information und verwendet ausschließlich den
  Enumwert des Contracts.
- Eine Anwendung oder Datei darf nur als Quelle genannt werden, wenn sie durch
  Nutzereingabe oder Datei-Evidenz belegt ist.
- Entscheidungen werden als Frage formuliert.
- Bekannte Optionen werden getrennt ausgegeben. `determination` beschreibt,
  anhand welcher Merkmale die Option festgestellt wird; `consequence`
  beschreibt die fachliche Folge.
- `mode` trennt feste Regeln von fachlichem Ermessen. Eine dokumentierte
  Pflichtregel ist `rule_based`; eine einzelfallabhängige Einordnung ist
  `professional_judgement`; eine belegte Kombination ist `mixed`.
- Fehlende Optionen, Quellen oder Kriterien bleiben leer beziehungsweise
  unbekannt. Die KI erfindet keinen plausiblen Entscheidungsbaum.
- `miscellaneous` enthält nur belegte Angaben, die nicht sinnvoll in die vier
  strukturierten Bereiche passen, und bleibt kompakt.
- Pro Schritt bleiben `name` und `activity` zusammen auf eine schnell scanbare
  fachliche Zusammenfassung begrenzt.

Der Claude-Adapter bleibt bei einem frischen, begrenzten Opus-4.8-Aufruf mit
`medium`, bestehendem Sandboxvertrag und bestehenden Dateiwerkzeugen.

## Korrekturmodus

Der Button `Prozessbild korrigieren` schaltet Diagramm und Hauptlauf gemeinsam
auf den Draft um. Das Diagramm bleibt sichtbar und aktualisiert Namen und
Reihenfolge sofort aus dem Draft.

Je Schritt stehen zur Verfügung:

- Bezeichnung und Aktivität als Textfelder;
- Input und Output als zeilenbasierte Listen;
- Informationszeilen mit `Information`, `Quelle` und Auswahl `Art`;
- Aktionen zum Hinzufügen und Entfernen von Informationszeilen;
- Entscheidungskarten mit `Frage`, `Modus` und Optionszeilen;
- Aktionen zum Hinzufügen und Entfernen von Entscheidungen und Optionen;
- je Option `Bezeichnung`, `Feststellung`, `Folge` und optionales Ziel aus den
  vorhandenen Prozessschritten;
- `Sonstiges` als Textarea;
- bestehende Pfeilaktionen zum Umordnen der fünf bis acht Schritte.

Leere neu angelegte Informations- oder Optionszeilen dürfen nicht gespeichert
werden. Beim Speichern fokussiert die UI das erste ungültige Feld und zeigt eine
fachliche Fehlermeldung. Die bestehende Korrekturbegründung und die Aktionen
`Abbrechen` und `Korrektur speichern` bleiben erhalten.

Die bisherige Korrekturansicht für allgemeine Steckbrieffelder und
Arbeitsmerkmale wird aus dieser Seite entfernt. Server- und Storage-Verträge
für bereits gespeicherte Arbeitsmerkmale bleiben unverändert.

## Auswirkung auf Opportunity Discovery

- `createOpportunityProcessSnapshot` übernimmt das v2-Prozessverständnis.
- Der Snapshot enthält weiterhin keine Teilnehmernamen oder E-Mail-Adressen.
- Die Hypothesenanweisung wird ergänzt: strukturierte Entscheidungsmodi und
  Feststellungskriterien sind bei der Abgrenzung von deterministischer
  Automation und materiellem KI-Beitrag zu beachten.
- `rule_based` allein begründet kein KI-Potenzial.
- `professional_judgement` oder `mixed` begründet nur dann ein Potenzial, wenn
  die benötigte KI-Fähigkeit und der heutige Bedarf durch Schritt und Evidenz
  belegt sind.
- Fehlende Quellen, unbekannte Arten, leere Optionen oder fehlende
  Feststellungskriterien bleiben materielle offene Fachfragen, wenn die
  Hypothese davon abhängt.
- Die bestehende Auswahlregel für hohe Konfidenz und den Fallback mit zwei bis
  drei mittleren Hypothesen bleibt unverändert.

## Implementierungsphasen

### Phase 1 — v2-Domain und Legacy-Migration

Änderungen:

- neue Enums und verschachtelte Schemas in
  `packages/domain/src/process-understanding.ts`;
- striktes `processUnderstandingV2Schema`;
- internes Legacy-Schema und `processUnderstandingStorageSchema`;
- neue Referenz- und Eindeutigkeitsprüfungen;
- Export des kanonischen v2-Typs als bestehender Name
  `ProcessUnderstanding`;
- Repository-Leseweg und Opportunity-Snapshot-Leseweg auf die Migration
  umstellen.

Erwartete Outputs:

- neue Records werden ausschließlich als v2 gespeichert;
- bestehende Records werden verlustarm als v2 gelesen;
- ungültige Nested-IDs, unbekannte Enumwerte und fremde `nextStepId` werden
  abgewiesen;
- Legacy-Migration erzeugt keine unbelegten Quellen, Arten oder Optionen.

Harte Verifikation:

```zsh
./scripts/qa test tests/process-domain.test.ts
./scripts/qa test tests/process-storage.test.ts
./scripts/qa test tests/opportunity-storage.test.ts
```

### Phase 2 — KI-Schema, Prompt und Adaptergrenzen

Änderungen:

- JSON-Schema auf v2 umstellen;
- Syntheseanweisung um strukturierte Regeln ergänzen;
- `processSynthesisAiResultSchema` als strikt validierten v2-AI-Contract ohne
  verschachtelte IDs definieren und danach mit
  `normalizeProcessSynthesisResult` in den kanonischen v2-Contract überführen;
- Prozess- und Opportunity-Fixtures auf v2 umstellen;
- Opportunity-Hypothesenprompt um Entscheidungsmodus-Regeln ergänzen.

Erwartete Outputs:

- AI-Ausgaben ohne `inputs`, `outputs`, `informationItems`, `decisions` oder
  `miscellaneous` scheitern vor Speicherung;
- die Domain-Normalisierung vergibt eindeutige stabile IDs für sämtliche
  verschachtelten AI-Einträge;
- unbekannte Details bleiben kanonisch unbekannt;
- personenbezogene Cover-Daten gelangen weiterhin nicht in den
  Opportunity-Snapshot;
- feste Regeln werden downstream nicht als KI-Beitrag behandelt.

Harte Verifikation:

```zsh
./scripts/qa test tests/process-ai-contract.test.ts
./scripts/qa test tests/opportunity-ai-contract.test.ts
./scripts/qa test tests/opportunity-domain.test.ts
```

### Phase 3 — vereinfachte Leseansicht

Änderungen:

- `ProcessBrief` in die festgelegten Seitenabschnitte zerlegen;
- `ProcessMap` oberhalb des Hauptlaufs platzieren und vereinfachen;
- `ProcessStepCard` auf die fünf neuen Bereiche umstellen;
- Informations- und Entscheidungstabellen als kleine fokussierte Komponenten
  implementieren;
- `DocumentCoverage` von `Noch unbekannt` trennen;
- globale Steckbrief- und Arbeitsmerkmalansicht entfernen;
- Desktop- und Tablet-CSS anpassen.

Erwartete Outputs:

- die Seite folgt exakt der dokumentierten Reihenfolge;
- vor dem ersten Prozessschritt erscheinen keine langen KI-Textblöcke;
- ein geschlossener Schritt zeigt nur Nummer, Name und Aktivität;
- ein geöffneter Schritt zeigt genau Input, Output, Informationen,
  Varianten/Entscheidungen und Sonstiges;
- Unterlagen, Widersprüche und Wissenslücken bleiben vollständig erreichbar.

Harte Verifikation:

- Accessibility-Snapshot enthält die Abschnittsüberschriften in der
  festgelegten Reihenfolge.
- Zwischen `Prozesssteckbrief` und `Diagramm` gibt es keine Überschriften
  `Zweck`, `Auslöser`, `Ergebnis` oder `Abgrenzung`.
- Zwischen `Schritte` und `Unterlagen und offene Punkte` stehen genau fünf
  bis acht Accordion-Karten.
- Das Öffnen jeder Karte setzt `aria-expanded=true`; der Chevron zeigt nach
  oben. Im geschlossenen Zustand zeigt er nach unten.
- Jede geöffnete Karte enthält die fünf Bereichsüberschriften genau einmal.

### Phase 4 — strukturierter Korrekturmodus

Änderungen:

- `BriefEditor` auf v2-Schritte reduzieren;
- Editor-Komponenten für Informationen, Entscheidungen und Optionen anlegen;
- Listen-, Nested-ID- und Zielschrittvalidierung vor dem API-Aufruf;
- `ProcessCapturePage` von den nicht mehr benötigten Brief-Props für
  Arbeitsmerkmalkorrekturen bereinigen;
- PATCH-API bleibt atomar und zeichnet einen Korrekturgrund auf.

Erwartete Outputs:

- sämtliche sichtbaren Schrittwerte können korrigiert werden;
- `Sonstiges` ist frei editierbar;
- Änderungen erscheinen sofort im Diagramm-Draft;
- Abbruch verändert den kanonischen Stand nicht;
- Speichern markiert nur tatsächlich veränderte Schritte als
  `user_confirmed`;
- Audit enthält vorherigen und neuen v2-Stand sowie den Korrekturgrund.

Harte Verifikation:

```zsh
./scripts/qa test tests/process-api.test.ts
./scripts/qa test tests/process-storage.test.ts
```

Zusätzliche Browserfälle:

1. Informationszeile hinzufügen, Quelle und Art setzen, speichern und Seite
   neu laden.
2. Entscheidung mit zwei Optionen, Feststellung, Folge und Zielschritt
   hinzufügen, speichern und neu laden.
3. `Sonstiges` ergänzen und kontrollieren, dass genau der geänderte Schritt
   `user_confirmed` ist.
4. Ungültigen Zielschritt provozieren; kein PATCH darf gespeichert werden.
5. Editor abbrechen; Snapshot und Audit bleiben unverändert.

### Phase 5 — lokale End-to-End-Abnahme

Der vollständige Flow wird auf `http://127.0.0.1:5173` ausgeführt. Es erfolgt
kein Request an die Live-Anwendung und keine Pi-Verbindung.

Testprozess:

- Fachbereich `Finanzen`;
- Prozess `Mahnverfahren Direktinkasso Leben (FSCD) – Steckbrief-v2-Smoke`;
- ausschließlich freigegebene Demo-/Testkontaktdaten;
- die bereits lokal vorhandenen DOCX- und PPTX-Unterlagen dürfen für genau
  einen begrenzten Syntheseaufruf verwendet werden; sie werden nicht kopiert,
  committed oder in Testfixtures aufgenommen;
- die fünf bereits dokumentierten Mahnverfahren-Antworten und höchstens fünf
  Rückfragen werden verwendet;
- Opportunity Discovery wird in diesem UI-Smoke nicht gestartet.

Erwarteter fachlicher Output:

- fünf bis acht Hauptschritte;
- pro Schritt strukturierte Inputs und Outputs;
- Informationen aus SAP, Gruppenpostkorb und Unterlagen sind einzeln mit
  belegbarer Quelle und Art erfasst;
- feste Mahnregeln sind `rule_based`;
- fachliche Ausnahmeentscheidungen sind `professional_judgement` oder `mixed`;
- unbekannte Häufigkeiten, Freigaben und Entscheidungskriterien erscheinen in
  `Noch unbekannt` statt als erfundene Werte;
- fehlende Bilder bleiben unter `Unterlagen und offene Punkte` sichtbar.

## Browser-Verifikation: exakter Seitencheck

### Desktop — 1440 × 900

1. Lokalen Prozess im Zustand `review_required` öffnen.
2. Prüfen, dass die sichtbare Reihenfolge exakt ist:
   `Prozesssteckbrief` → `Diagramm` → `Schritte` →
   `Unterlagen und offene Punkte` → `Noch unbekannt` → Bestätigung.
3. Prüfen, dass das Diagramm nur Nummer und Namen zeigt.
4. Ersten, mittleren und letzten Prozessschritt öffnen.
5. Für jeden geöffneten Schritt die fünf Bereiche und Tabellenüberschriften
   prüfen.
6. Eine Datei in der Vorschau öffnen und Download-Link prüfen.
7. Korrekturmodus öffnen, verschachtelte Daten ändern, speichern und neu
   laden.
8. Prozessbild bestätigen und Status prüfen.
9. `document.documentElement.scrollWidth === window.innerWidth` prüfen.
10. Konsole auf `error` und `warn` filtern; Ergebnis muss leer sein.
11. Netzwerk auf fehlgeschlagene Requests prüfen; alle erwarteten Dokument-,
    API- und Asset-Requests müssen 2xx liefern.

### Tablet — 768 × 1024

1. Dieselbe Seite ohne neuen KI-Aufruf öffnen.
2. Diagramm horizontal innerhalb seiner Sektion scrollen.
3. Sicherstellen, dass die Seite selbst keinen horizontalen Overflow hat.
4. Informations- und Entscheidungstabellen müssen als beschriftete
   Kartenzeilen lesbar sein, ohne abgeschnittene Inhalte.
5. Accordion vollständig per Tastatur öffnen und schließen.
6. Korrekturfelder, Selects, Add-/Remove-Aktionen und Speicheraktionen müssen
   ohne Überlagerung erreichbar sein.
7. Dokumentvorschau öffnen und schließen.
8. Erneut gefilterte Konsole und fehlgeschlagene Netzwerkrequests prüfen.

### Accessibility-Snapshot

Der finale Snapshot muss folgende Reihenfolge und Semantik zeigen:

- genau eine `h1` `Prozesssteckbrief` innerhalb des Ergebnisbereichs;
- `h2` `Diagramm`;
- `h2` `Schritte`;
- Accordion-Schaltflächen mit eindeutigem Namen aus Nummer und Schrittname;
- geöffnete Inhalte mit den Überschriften `Input`, `Output`, `Informationen`,
  `Varianten und Entscheidungen`, `Sonstiges`;
- `h2` `Unterlagen und offene Punkte`;
- `h3` `Erkannte Widersprüche` innerhalb dieser Sektion;
- `h2` `Noch unbekannt` als eigene folgende Sektion;
- genau eine fachliche Bestätigungsaktion vor Bestätigung;
- keine sichtbaren Rohwerte für Provenienz-Enums, Informations-Enums,
  JSON-Felder oder Modellterminologie.

## Automatisierte Tests

### `tests/process-domain.test.ts`

- akzeptiert v2 mit fünf und acht Schritten;
- lehnt fehlende v2-Schrittbereiche ab;
- lehnt doppelte Informations-, Entscheidungs- und Options-IDs ab;
- lehnt unbekannte Informationstypen und Entscheidungsmodi ab;
- lehnt fremde `nextStepId` ab;
- akzeptiert echte `null`-/Leerzustände;
- migriert einen vollständigen Legacy-Schritt deterministisch;
- beweist, dass die Migration keine Quelle, Art oder Option erfindet.

### `tests/process-storage.test.ts`

- lädt eine unveränderte Legacy-Datei als v2;
- überschreibt Legacy-Datei nicht beim Lesen;
- speichert v2 atomar nach einer Korrektur;
- protokolliert Nested-Korrekturen mit Grund und `human_correction`;
- Reset/Delete-Sicherheitsregeln bleiben unverändert.

### `tests/process-ai-contract.test.ts`

- JSON-Schema verlangt v2 und alle neuen Schrittbereiche;
- Prompt enthält die Regeln für Quelle, Art, Modus und unbekannte Details;
- gültige strukturierte Synthese wird akzeptiert;
- alte oder frei erfundene Feldformen werden abgewiesen;
- Tool-, Sandbox-, Modell- und Fresh-Session-Vertrag bleiben unverändert.

### `tests/process-api.test.ts`

- GET liefert migriertes v2 für Legacy-Daten;
- PATCH akzeptiert gültige verschachtelte Korrektur;
- PATCH lehnt ungültige Nested-Referenzen mit `400` ab;
- Bestätigung bleibt nur aus `review_required` möglich.

### Opportunity-Tests

- Fixtures verwenden v2-Schritte;
- Snapshot enthält Inputs, Outputs, Informationen und Entscheidungen;
- Snapshot enthält weiterhin keine Teilnehmer-E-Mail;
- `rule_based` wird im Prompt nicht als KI-Potenzial interpretiert;
- gespeicherte historische Opportunity-Snapshots bleiben lesbar.

## Files To Change

| Datei                                                      | Änderung                                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `packages/domain/src/process-understanding.ts`             | v2-Schemas, AI-Normalisierung, Enums, Nested-Invarianten, Legacy-Migration, Typen |
| `packages/domain/src/opportunity-discovery.ts`             | v2-Snapshot und Migration historischer Source-Snapshots                           |
| `packages/storage/src/process-capture-repository.ts`       | Storage-Leseschema, v2-Korrektur und Nested-Vergleich                             |
| `packages/storage/src/opportunity-discovery-repository.ts` | historische Snapshot-Migration beim Lesen                                         |
| `packages/claude/src/process-response-schemas.ts`          | Export des strikten v2-AI-Response-Schemas                                        |
| `defaults/ai-schemas/process-understanding.json`           | JSON-Schema für v2-Prozessschritte                                                |
| `defaults/prompts/process-synthesis.md`                    | strukturierte Synthese- und Unknown-Regeln                                        |
| `defaults/prompts/opportunity-hypotheses.md`               | Entscheidungsmodus bei KI-/Automation-Abgrenzung berücksichtigen                  |
| `apps/server/src/routes/process-captures.ts`               | Korrekturroute strikt an v2 binden                                                |
| `apps/web/src/pages/process-capture-page.tsx`              | vereinfachte `ProcessBrief`-Props und Korrekturverdrahtung                        |
| `apps/web/src/components/process-brief.tsx`                | neuer Seitenaufbau und reduzierter Editor                                         |
| `apps/web/src/components/process-map.tsx`                  | kompakte Knoten und zugängliche Reihenfolge                                       |
| `apps/web/src/components/process-step-card.tsx`            | fünf neue Detailbereiche und Leerzustände                                         |
| `apps/web/src/components/process-step-information.tsx`     | neue Informationsanzeige und Editorzeilen                                         |
| `apps/web/src/components/process-step-decisions.tsx`       | neue Entscheidungsanzeige und Editorstruktur                                      |
| `apps/web/src/components/document-coverage.tsx`            | nur Unterlagen, Einschränkungen und Widersprüche                                  |
| `apps/web/src/components/process-unknowns.tsx`             | neue eigenständige Sektion `Noch unbekannt`                                       |
| `apps/web/src/styles/capture.css`                          | neuer Brief-, Diagramm-, Accordion-, Tabellen- und Editoraufbau                   |
| `apps/web/src/styles/documents.css`                        | getrennte Unterlagen-/Widerspruchssektion                                         |
| `apps/web/src/styles/responsive.css`                       | Desktop-/Tablet-Verhalten ohne Seitenoverflow                                     |
| `tests/process-fixtures.ts`                                | kanonische v2-Fixtures und Legacy-Fixture                                         |
| `tests/process-domain.test.ts`                             | v2-Invarianten und Migration                                                      |
| `tests/process-storage.test.ts`                            | Legacy-Read und Nested-Korrekturaudit                                             |
| `tests/process-ai-contract.test.ts`                        | v2-Schema-/Promptvertrag                                                          |
| `tests/process-api.test.ts`                                | v2-GET/PATCH/Confirm-Vertrag                                                      |
| `tests/opportunity-fixtures.ts`                            | v2-Source-Prozess                                                                 |
| `tests/opportunity-domain.test.ts`                         | v2-Snapshot- und Entscheidungsmodusregeln                                         |
| `tests/opportunity-ai-contract.test.ts`                    | minimierter v2-Input ohne PII                                                     |
| `tests/opportunity-storage.test.ts`                        | historische Snapshot-Kompatibilität                                               |
| `docs/PRODUCT-FLOW-KI-POTENTIAL.md`                        | kanonischen v2-Contract und Ergebnisflow ersetzen                                 |
| `docs/OPERATOR_GUIDE.de.md`                                | vereinfachte Prüfung und Korrektur beschreiben                                    |

Dateien werden nur dann neu angelegt, wenn sie in der Tabelle ausdrücklich als
neue Komponente bezeichnet sind. Bestehende Primitive bleiben unverändert,
solange die neuen Tabellen- und Editorbausteine mit den vorhandenen
`Card`-, `Button`-, `IconButton`- und `Badge`-Primitives umgesetzt werden
können.

## Validierungsbefehle

Während der Implementierung:

```zsh
./scripts/qa test tests/process-domain.test.ts
./scripts/qa test tests/process-storage.test.ts
./scripts/qa test tests/process-ai-contract.test.ts
./scripts/qa test tests/process-api.test.ts
./scripts/qa changed
```

Vor lokaler Browserabnahme:

```zsh
./scripts/qa all
./scripts/qa release
bun run dev
```

Vor Handoff erneut:

```zsh
./scripts/qa all
./scripts/qa release
git diff --check
git status --short --branch
```

## Abnahmekriterien

Die Umsetzung ist erst abgeschlossen, wenn alle folgenden Punkte gleichzeitig
erfüllt sind:

- neuer und migrierter Prozess verwenden intern denselben v2-Contract;
- neue KI-Synthese liefert ausschließlich den v2-Contract;
- Quellen und Informationsarten sind je Information strukturiert;
- Entscheidungen enthalten Frage, Modus und bekannte Optionen mit Feststellung
  und Folge;
- unbekannte Details bleiben sichtbar unbekannt;
- jeder Schritt besitzt `Sonstiges` im Lese- und Korrekturmodus;
- die Ergebnisansicht folgt exakt dem dokumentierten Seitenaufbau;
- Diagramm und Hauptlauf enthalten dieselben fünf bis acht Schritte in derselben
  Reihenfolge;
- die alten Übersichts- und Arbeitsmerkmalblöcke erscheinen nicht mehr;
- Unterlagen, Dateieinschränkungen, Widersprüche und Wissenslücken bleiben
  sichtbar und Dateien bleiben preview-/downloadbar;
- verschachtelte Korrekturen sind atomar, validiert und auditierbar;
- Opportunity Discovery erhält den v2-Prozess ohne Teilnehmerdaten;
- alle fokussierten Tests, `./scripts/qa all` und `./scripts/qa release` sind
  erfolgreich;
- Chrome-Verifikation ist bei 1440 × 900 und 768 × 1024 ohne Konsolenfehler,
  fehlgeschlagene Requests oder horizontalen Seitenoverflow erfolgreich;
- es wurde nichts gepusht und kein Pi- oder Live-Deployment ausgeführt.
