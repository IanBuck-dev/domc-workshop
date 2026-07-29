# Implementierungsplan: direkt bearbeitbarer Prozesssteckbrief

## Status und feste Entscheidungen

- Dieser Plan baut auf dem kanonischen Prozessverständnis v2 und dem
  vereinfachten Prozesssteckbrief auf.
- Der gesamte Prozesssteckbrief besitzt genau einen seitenweiten
  `isEditMode: boolean`.
- Im Bearbeitungsmodus bleibt derselbe Seitenaufbau sichtbar. Diagramm und
  Schrittkomponenten wechseln inline zwischen Lese- und Bearbeitungszustand;
  es gibt keine separate, anders aufgebaute Editoransicht.
- Das Diagramm bleibt ein linearer fachlicher Hauptablauf mit höchstens acht
  Schritten. Die KI-Synthese liefert weiterhin fünf bis acht Hauptschritte;
  fachliche Korrekturen dürfen den Ablauf auf bis zu einen Schritt reduzieren.
  BPMN, freie Verzweigungen und ein frei positionierbares Canvas bleiben
  ausgeschlossen.
- Fehlende strukturierte Werte werden im Bearbeitungsmodus sichtbar und
  zugänglich markiert. Bestehende unbekannte Werte dürfen weiterhin gespeichert
  werden; der Prototyp erzwingt keine erfundenen Angaben.
- Quelle und Art einer Information werden über Auswahlfelder bearbeitet. Beide
  Auswahlfelder besitzen eine Freitextoption.
- Strukturänderungen bleiben Entwürfe, bis der Nutzer die gesamte Korrektur
  speichert. Abbruch verwirft den vollständigen Entwurf.
- Jede Speicherung verwendet weiterhin genau einen atomaren PATCH und erzeugt
  genau einen Audit-Eintrag mit Korrekturgrund.
- Bereits bestätigte Prozessbilder dürfen bearbeitet werden. Eine gespeicherte
  Korrektur hebt die fachliche Bestätigung entsprechend dem bestehenden
  Repository-Verhalten auf und setzt den Prozess auf `review_required`.

## Ziel

Der von der KI erzeugte Prozesssteckbrief soll direkt an seiner sichtbaren
Stelle fachlich korrigierbar sein. Nutzer können:

1. den linearen Hauptablauf ergänzen, umbenennen und neu sortieren;
2. die Inhalte jedes Hauptschritts bearbeiten;
3. fehlende Quellen, Informationsarten und Entscheidungsdetails ergänzen;
4. den vollständigen Entwurf kontrolliert speichern oder verwerfen.

Die Leseansicht bleibt unverändert kompakt. Bearbeitungsaktionen erscheinen
erst nach dem expliziten Wechsel in den Bearbeitungsmodus.

## Nicht-Ziele

- keine Änderung der Prozessaufnahme vor der Synthese;
- keine erneute KI-Synthese während manueller Korrekturen;
- keine automatische Opportunity-Neuberechnung;
- keine parallele Mehrbenutzerbearbeitung;
- keine Autosave- oder Hintergrundspeicherung;
- keine Bearbeitung von Evidenz, Provenienz, Confidence oder technischen IDs;
- keine Bearbeitung der Dateiverarbeitungsergebnisse;
- keine freie Diagrammverzweigung, Schleifenmodellierung oder BPMN-Semantik;
- kein Pi-Deployment als Teil dieses Plans.

## Zielseitenaufbau

Die Reihenfolge der bestehenden Seite bleibt erhalten:

```text
Capture-Seitenkopf

Prozesssteckbrief
├─ Titel und Prüfsatz
├─ Lesemodus: Aktion „Prozessbild bearbeiten“
└─ Bearbeitungsmodus
   ├─ sichtbarer Status „Bearbeitungsmodus“
   └─ Aktion „Bearbeitung abbrechen“

Diagramm
└─ linearer Struktureditor bei isEditMode=true
   ├─ Schritt umbenennen
   ├─ Schritt nach einem vorhandenen Schritt hinzufügen
   ├─ Schritt nach links oder rechts verschieben
   └─ Schritt löschen

Schritte
└─ dieselben Accordion-Karten in beiden Modi
   ├─ Kopf: Nummer, Name und Aktivität
   └─ geöffnet
      ├─ Schrittbeschreibung: Name und Aktivität
      ├─ Input
      ├─ Output
      ├─ Informationen
      ├─ Varianten und Entscheidungen
      └─ Sonstiges

Unterlagen und offene Punkte
Noch unbekannt

Bearbeitungsmodus: persistente Aktionsleiste
├─ Korrekturgrund
├─ Abbrechen
└─ Änderungen speichern

Lesemodus: fachliche Bestätigung
```

`Unterlagen und offene Punkte` sowie `Noch unbekannt` bleiben auch im
Bearbeitungsmodus sichtbar. Sie werden in diesem Plan nicht editierbar.

## 1. Seitenweiter Bearbeitungszustand

### `ProcessBrief`

In `apps/web/src/components/process-brief.tsx` wird der bestehende Zustand
`editing` in `isEditMode` umbenannt. `ProcessBrief` bleibt Eigentümer von:

- `isEditMode`;
- `draft: ProcessUnderstanding`;
- `correctionNote`;
- `validationError`;
- `openStepIds: Set<string>`;
- der Start-, Abbruch- und Speicheraktionen.

Beim Eintritt in den Bearbeitungsmodus wird `understanding` genau einmal per
`structuredClone` in `draft` kopiert. Änderungen aktualisieren ausschließlich
`draft`. Von außen eintreffende Record-Updates ersetzen den Entwurf nicht,
solange `isEditMode=true` ist.

Beim Abbruch werden Entwurf, Validierungsfehler, geöffnete neue Schritte und
Korrekturgrund verworfen. Danach wird wieder `understanding` gerendert.

Beim Speichern gilt:

1. UI-spezifische Pflichtfelder werden geprüft und das erste ungültige Feld
   fokussiert.
2. Der getrimmte Korrekturgrund enthält mindestens drei Zeichen; andernfalls
   bleibt der Entwurf offen und das Feld wird fokussiert.
3. `processUnderstandingSchema.safeParse(draft)` validiert den vollständigen
   Contract.
4. Genau ein bestehender `onSave(parsed.data, correctionNote)`-Aufruf wird
   ausgeführt.
5. Erst nach erfolgreichem PATCH endet der Bearbeitungsmodus.
6. Bei einem Fehler bleibt der Entwurf sichtbar und editierbar.

Der bisherige `BriefEditor` wird entfernt. Seine Listen- und
Strukturhilfsfunktionen werden in domainnahe, testbare Funktionen und die
jeweiligen sichtbaren Komponenten verschoben.

### Sichtbarer Modus

- Im Lesemodus steht oben rechts `Prozessbild bearbeiten`.
- Im Bearbeitungsmodus steht an derselben Stelle ein sichtbarer Status
  `Bearbeitungsmodus` und die Aktion `Bearbeitung abbrechen`.
- Die bestehende untere Aktionsleiste bleibt der einzige Ort für
  `Änderungen speichern` und den Korrekturgrund.
- Bei einem bereits bestätigten Prozess zeigt die Aktionsleiste den Hinweis:
  `Durch das Speichern wird die fachliche Bestätigung aufgehoben.`
- Die Bestätigungsaktion wird nur im Lesemodus angezeigt.

## 2. Linearer Diagrammeditor

### Component Contract

`ProcessMap` erhält folgende Props:

```ts
interface ProcessMapProps {
  understanding: ProcessUnderstanding;
  isEditMode: boolean;
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  onRenameStep: (stepId: string, name: string) => void;
  onInsertStep: (index: number) => void;
  onMoveStep: (stepId: string, direction: -1 | 1) => void;
  onRequestDeleteStep: (stepId: string) => void;
}
```

Im Lesemodus rendert `ProcessMap` weiterhin ausschließlich Nummer und Name.
Im Bearbeitungsmodus gilt:

- Der Name wird in einem einzeiligen Eingabefeld bearbeitet.
- Zwischen den Knoten und nach dem letzten Knoten steht jeweils eine kompakte
  Aktion `Schritt hinzufügen`.
- Jeder Knoten besitzt zugängliche Aktionen `Nach links`, `Nach rechts` und
  `Schritt löschen`.
- Die Pfeilaktionen sind am Anfang beziehungsweise Ende deaktiviert.
- Hinzufügen ist bei acht Schritten deaktiviert und erklärt die Obergrenze.
- Löschen ist bei fünf Schritten deaktiviert und erklärt die Untergrenze.
- Die sichtbare Reihenfolge wird nach jeder Strukturänderung sofort neu von
  eins bis zur aktuellen Länge nummeriert.
- Ein Klick auf den nicht interaktiven Knotenbereich wählt den Schritt, scrollt
  zur zugehörigen Accordion-Karte und öffnet sie.

Drag-and-drop wird auf Desktop zusätzlich mit dem nativen HTML-Drag-and-Drop
über `draggable`, `dragstart`, `dragover` und `drop` angeboten. Die
Pfeilaktionen bleiben die vollständig zugängliche und auf Tablets verlässliche
Alternative. Es wird keine neue Drag-and-drop-Abhängigkeit eingeführt.

### Hinzufügen

Ein neuer Schritt wird an der gewählten Position mit einer neuen UUID und
folgenden Entwurfswerten erzeugt:

```ts
{
  id,
  order,
  name: "",
  activity: "",
  inputs: [],
  outputs: [],
  informationItems: [],
  decisions: [],
  miscellaneous: null,
  provenance: "user_confirmed",
  evidenceIds: [],
  confidence: null,
  assumptions: [],
  confirmed: true
}
```

Der neue Knoten und die neue Schrittkarte werden markiert; die Karte wird
geöffnet und das Feld `Bezeichnung` fokussiert. Name und Aktivität müssen vor
dem Speichern ausgefüllt sein.

### Verschieben

Verschieben ändert ausschließlich die Arrayreihenfolge und `order`. IDs und
`nextStepId`-Referenzen bleiben stabil. Diagramm und Accordion-Liste werden aus
demselben sortierten Entwurf gerendert und können deshalb nicht voneinander
abweichen.

### Löschen

Für das Löschen wird
`apps/web/src/components/process-step-delete-dialog.tsx` ergänzt.

- Ein Schritt ohne eingehende `nextStepId`-Referenzen kann nach expliziter
  Bestätigung gelöscht werden.
- Wird der Schritt von einer Entscheidungsoption referenziert, verhindert der
  Dialog das Löschen und listet die betroffenen Schritte und Entscheidungen.
- Der Nutzer muss die Referenzen zuerst ändern oder entfernen.
- Nach dem Löschen werden die verbleibenden Schritte lückenlos neu nummeriert.
- Abbruch verändert den Entwurf nicht.

## 3. Domainlogik für Strukturänderungen

Die lineare Strukturbearbeitung wird React-unabhängig in
`packages/domain/src/process-understanding-editing.ts` implementiert.

Exporte:

```ts
export function insertProcessStep(
  understanding: ProcessUnderstanding,
  index: number,
  id: string,
): ProcessUnderstanding;

export function moveProcessStep(
  understanding: ProcessUnderstanding,
  stepId: string,
  direction: -1 | 1,
): ProcessUnderstanding;

export function referencesToStep(
  understanding: ProcessUnderstanding,
  stepId: string,
): Array<{ stepId: string; decisionId: string; optionId: string }>;

export function removeProcessStep(
  understanding: ProcessUnderstanding,
  stepId: string,
): ProcessUnderstanding;
```

Invarianten:

- Eingaben werden nicht mutiert.
- Hinzufügen oberhalb von acht und Löschen unterhalb von fünf werfen einen
  fachlich lesbaren Fehler.
- Ein unbekannter Schritt oder ein nicht möglicher Move wirft einen Fehler.
- `removeProcessStep` verweigert referenzierte Schritte.
- Jede erfolgreiche Operation erzeugt lückenlose `order`-Werte ab eins.
- Schritt-, Informations-, Entscheidungs- und Options-IDs bleiben ansonsten
  unverändert.

## 4. Inline editierbare Schrittkomponenten

### `ProcessStepCard`

`ProcessStepCard` erhält:

```ts
interface ProcessStepCardProps {
  step: ProcessUnderstanding["steps"][number];
  steps: ProcessUnderstanding["steps"];
  isEditMode: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (step: ProcessUnderstanding["steps"][number]) => void;
}
```

- Im Lesemodus bleibt die heutige Darstellung unverändert.
- Im Bearbeitungsmodus bleiben Name und Aktivität im Kartenkopf lesbar und
  werden im geöffneten Bereich „Schrittbeschreibung“ bearbeitbar.
- Interaktionen mit Eingabefeldern toggeln das `<details>`-Element nicht.
- Die fünf fachlichen Bereiche bleiben in derselben Reihenfolge.
- Neu hinzugefügte Schritte bleiben bis zur ersten Speicherung geöffnet.

### Input und Output

Die bisherige reine `StepValueList` wird um `isEditMode` erweitert.

- Im Lesemodus bleibt die Liste unverändert.
- Im Bearbeitungsmodus besitzt jeder Eintrag ein Textfeld und eine
  Entfernen-Aktion.
- `Eintrag hinzufügen` ergänzt ein leeres fokussiertes Textfeld.
- Leere neu angelegte Einträge blockieren das Speichern und werden entweder
  ausgefüllt oder entfernt.
- Eine vollständig leere Input- oder Outputliste wird als fehlende Angabe
  markiert, blockiert das Speichern aber nicht.

### Informationen

`ProcessStepInformation` und `ProcessStepInformationEditor` werden zu einer
Komponente mit `isEditMode`, `sourceOptions` und `onChange` zusammengeführt.

```ts
interface ProcessStepInformationProps {
  stepId: string;
  items: ProcessInformationItem[];
  sourceOptions: string[];
  isEditMode: boolean;
  onChange: (items: ProcessInformationItem[]) => void;
}
```

Im Bearbeitungsmodus enthält jede Zeile:

1. `Information` als Textfeld;
2. `Quelle` als Auswahlfeld;
3. `Art` als Auswahlfeld;
4. eine Entfernen-Aktion.

#### Quellen-Auswahl

Die Quellenliste wird bei jeder Entwurfsänderung in `ProcessBrief`
deterministisch und ohne Duplikate aus folgenden Werten aufgebaut:

1. `understanding.informationSources.value`;
2. `understanding.systems.value`;
3. Dateinamen aus `documentCoverage`;
4. bereits gespeicherten `informationItems[].source`.

Die Reihenfolge dieser Gruppen und die erste Nennung innerhalb einer Gruppe
bleiben erhalten. Leere Werte werden entfernt.

Das Auswahlfeld enthält zusätzlich:

- `Quelle noch unbekannt` → persistiert `source: null`;
- `Andere Quelle eingeben …` → zeigt direkt darunter ein Pflicht-Textfeld.

Das Freitextfeld persistiert seinen Text direkt in `source`. Die Werte der
Auswahlliste sind UI-Daten und werden nicht als neuer Domain-Enum gespeichert.

#### Arten-Auswahl

Das Auswahlfeld enthält alle fachlich übersetzten Werte aus
`processInformationTypes`:

- Systemfeld;
- E-Mail;
- Tabelle;
- Dokument;
- Bild oder Scan;
- Freitext;
- Datenbank oder Bericht;
- Art noch unbekannt;
- Andere Art eingeben ….

`Andere Art eingeben …` persistiert `type: "other"` und öffnet ein
Pflicht-Textfeld für `typeDetail`. `Art noch unbekannt` persistiert
`type: "unknown"` und `typeDetail: null`.

### Varianten und Entscheidungen

`ProcessStepDecisions` und `ProcessStepDecisionsEditor` werden ebenfalls über
`isEditMode` in einer sichtbaren Komponente zusammengeführt. Im
Bearbeitungsmodus bleiben folgende Felder editierbar:

- Entscheidungsfrage;
- Modus;
- Optionen;
- Feststellung;
- Folge;
- optionaler Folgeschritt.

Neue Entscheidungen und Optionen erhalten UUIDs. Leere neu angelegte Fragen
und Optionsbezeichnungen blockieren das Speichern. Ein durch Löschen ungültig
gewordener Folgeschritt blockiert sowohl den Löschvorgang als auch den finalen
Schema-Check.

### Sonstiges

`Sonstiges` bleibt im Lesemodus Text und wird im Bearbeitungsmodus als
mehrzeiliges Textfeld gerendert. Ein leerer Wert persistiert `null` und wird
nicht als fehlende Pflichtangabe markiert.

## 5. Fehlende Werte markieren

Fehlende Werte werden nur bei `isEditMode=true` hervorgehoben. Die Darstellung
verwendet nicht ausschließlich Farbe, sondern zusätzlich den sichtbaren Text
`Angabe fehlt` und eine zugängliche Beschreibung über `aria-describedby`.

Als fehlend gelten:

- leere Inputliste;
- leere Outputliste;
- keine benannte Information;
- `information.source === null`;
- `information.type === "unknown"`;
- `information.type === "other"` ohne `typeDetail`;
- `option.determination === null`;
- `option.consequence === null`.

Nicht als fehlend markiert werden:

- `miscellaneous === null`;
- ein nicht gesetzter optionaler `nextStepId`;
- eine leere Entscheidungsliste, weil ein Schritt fachlich ohne Entscheidung
  möglich ist.

Bestehende fehlende Werte sind Hinweise und blockieren das Speichern nicht.
Blockierend bleiben ausschließlich leere Pflichtwerte, die durch eine
Bearbeitung oder einen neu angelegten Eintrag entstanden sind, ungültige
Freitextoptionen, die Grenze von einem bis acht Schritten und ungültige
Referenzen.

CSS-Klassen:

- `.edit-mode` am Wurzelelement des Steckbriefs;
- `.missing-field` am betroffenen Feld oder Bereich;
- `.missing-field-label` für `Angabe fehlt`;
- `.process-map-edit-actions` für Strukturaktionen;
- `.process-step-edit-control` für Inline-Editoren.

Warnfarben verwenden die bestehenden Warning-Tokens. Fokus, Text und Border
müssen die bestehenden Kontrastvorgaben erfüllen.

## 6. Additive Erweiterung des Informationscontracts

`ProcessInformationItem` erhält:

```ts
typeDetail: string | null;
```

Regeln:

- Für alle bestehenden Standardarten ist `typeDetail` immer `null`; ein
  nicht-leerer Wert wird vom Domain-Schema abgewiesen.
- Für `type: "other"` darf `typeDetail` einen fachlichen Freitext mit maximal
  200 Zeichen enthalten.
- Bestehende v2-Dateien ohne Feld werden beim Lesen deterministisch zu
  `typeDetail: null` normalisiert.
- Die Schema-Version bleibt `2`, weil die Änderung additiv gelesen und
  deterministisch normalisiert wird.
- Die Legacy-Migration und die KI-Normalisierung setzen `typeDetail: null`,
  wenn keine belegte Beschreibung vorhanden ist.
- Das KI-JSON-Schema enthält `typeDetail` als verpflichtende, nullable
  Eigenschaft. Der Syntheseprompt erlaubt Freitext nur zusammen mit
  `type: "other"`.

Betroffene Schemas und Fixtures werden gemeinsam aktualisiert, damit
kanonische neue Schreibvorgänge das Feld immer enthalten.

## 7. Korrektur, Provenienz und Audit

Die heutige indexbasierte Zuordnung in
`ProcessCaptureRepository.correctUnderstanding` reicht für Einfügen, Löschen
und Sortieren nicht aus. Sie wird auf stabile fachliche Schlüssel umgestellt:

- globale Fakten werden weiterhin über ihren festen Feldnamen verglichen;
- Schritte werden über `step.id` verglichen;
- ein bestehender geänderter Schritt wird `user_confirmed`;
- ein neuer Schritt wird `user_confirmed`;
- unveränderte, lediglich durch eine andere Arrayposition gelesene Schritte
  behalten ihre bisherige Provenienz, sofern sich `order` nicht geändert hat;
- bei einer Reihenfolgeänderung gelten alle Schritte mit geändertem `order` als
  fachlich geändert und erhalten die Korrektur-Evidenz;
- gelöschte Schritte werden im `previous`/`next`-Audit sichtbar, erhalten aber
  naturgemäß keine Evidenz im neuen Objekt;
- genau ein neuer `human_correction`-Evidenzeintrag wird an sämtliche neuen
  oder geänderten Schritte referenziert.

Der Server validiert weiterhin den vollständigen kanonischen Contract und alle
Evidenz- und Dateireferenzen. Die UI darf diese Regeln nicht ersetzen.

## 8. Dokumentation

`docs/PRODUCT-FLOW-KI-POTENTIAL.md` wird ergänzt um:

- seitenweiten Bearbeitungsmodus;
- lineare Diagrammoperationen;
- strukturierte Quellen- und Artenauswahl;
- Markierung fehlender Angaben;
- Speichern als atomare, auditierte Fachkorrektur.

`docs/OPERATOR_GUIDE.de.md` beschreibt:

- Bearbeitungsmodus starten und abbrechen;
- Schritte ergänzen, verschieben und löschen;
- Quellen und Arten auswählen oder frei benennen;
- Bedeutung von `Angabe fehlt`;
- Aufhebung einer bestehenden fachlichen Bestätigung nach Korrektur.

## Files To Change

| Datei                                                    | Änderung                                                                               |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `packages/domain/src/process-understanding.ts`           | `typeDetail`, additive v2-Normalisierung und Invarianten                               |
| `packages/domain/src/process-understanding-editing.ts`   | Neue pure Strukturhilfen für Einfügen, Verschieben, Referenzprüfung und Löschen        |
| `packages/storage/src/process-capture-repository.ts`     | ID-basierter Korrekturvergleich und Audit für neue, verschobene und gelöschte Schritte |
| `packages/claude/src/process-synthesis-adapter.ts`       | `typeDetail` bei der KI-Normalisierung setzen                                          |
| `defaults/ai-schemas/process-understanding.json`         | Nullable `typeDetail` im strikten KI-Contract                                          |
| `defaults/prompts/process-synthesis.md`                  | Regel für Standardart und frei benannte sonstige Art                                   |
| `apps/web/src/components/process-brief.tsx`              | Seitenweites `isEditMode`, Draft, Save/Cancel und Entfernung von `BriefEditor`         |
| `apps/web/src/components/process-map.tsx`                | Linearer Inline-Struktureditor                                                         |
| `apps/web/src/components/process-step-delete-dialog.tsx` | Bestätigung und Referenzblockade beim Löschen                                          |
| `apps/web/src/components/process-step-card.tsx`          | Gemeinsame Lese-/Editdarstellung über `isEditMode`                                     |
| `apps/web/src/components/process-step-information.tsx`   | Dropdowns, Freitextoptionen und Missing-State                                          |
| `apps/web/src/components/process-step-decisions.tsx`     | Gemeinsame Lese-/Editdarstellung und Missing-State                                     |
| `apps/web/src/styles/capture.css`                        | Edit-, Diagramm-, Missing- und Dialogdarstellung                                       |
| `apps/web/src/styles/responsive.css`                     | Tabletdarstellung und zugängliche Strukturaktionen                                     |
| `docs/PRODUCT-FLOW-KI-POTENTIAL.md`                      | Produktentscheidungen dokumentieren                                                    |
| `docs/OPERATOR_GUIDE.de.md`                              | Bedienablauf dokumentieren                                                             |
| `tests/process-fixtures.ts`                              | Kanonische `typeDetail`-Werte ergänzen                                                 |
| `tests/process-domain.test.ts`                           | Informationsart und pure Strukturregeln testen                                         |
| `tests/process-storage.test.ts`                          | ID-basiertes Audit für Einfügen, Sortieren und Löschen testen                          |
| `tests/process-ai-contract.test.ts`                      | Strikten KI-Contract und Normalisierung prüfen                                         |
| `tests/process-api.test.ts`                              | Atomare Strukturkorrekturen und Referenzfehler prüfen                                  |

Es werden keine weiteren Produktionsdateien geändert. Insbesondere bleiben
Opportunity-Contract, Prozessaufnahme vor der Synthese und Settings unverändert.

## Automatisierte Tests

### `tests/process-domain.test.ts`

- Bestehendes v2-Objekt ohne `typeDetail` liest sich als `null`.
- Standardart mit nicht-leerem `typeDetail` wird abgewiesen.
- `other` akzeptiert einen Freitext bis 200 Zeichen.
- Einfügen erzeugt sechs lückenlos sortierte Schritte und mutiert das Original
  nicht.
- Einfügen bei acht Schritten wird abgewiesen.
- Löschen erzeugt fünf lückenlos sortierte Schritte.
- Löschen bei fünf Schritten wird abgewiesen.
- Löschen eines referenzierten Schritts wird abgewiesen.
- Verschieben bewahrt sämtliche IDs und `nextStepId`-Referenzen.

### `tests/process-storage.test.ts`

- Umbenennen markiert ausschließlich den betroffenen Schritt als
  `user_confirmed`.
- Sortieren ordnet über IDs zu und verwechselt keine Schrittinhalte.
- Ein neuer Schritt erhält Korrektur-Evidenz.
- Ein gelöschter Schritt erscheint im Audit-`previous`, aber nicht in `next`.
- Eine gemeinsame Speicherung erzeugt genau einen Korrektur-Evidenzeintrag und
  genau einen `understanding-corrected`-Audit-Eintrag.

### `tests/process-ai-contract.test.ts`

- KI-Ausgabe ohne `typeDetail` scheitert am neuen strikten Response-Schema.
- Standardarten verlangen `typeDetail: null`.
- `other` mit belegtem Freitext wird kanonisch übernommen.
- Normalisierung bestehender beziehungsweise migrierter Werte setzt `null`.

### `tests/process-api.test.ts`

- PATCH akzeptiert Einfügen, Umbenennen und Sortieren in einem Request.
- PATCH akzeptiert das Löschen eines unreferenzierten sechsten Schrittes.
- PATCH lehnt weniger als fünf und mehr als acht Schritte ab.
- PATCH lehnt eine verbliebene `nextStepId`-Referenz auf einen gelöschten
  Schritt atomar ab.
- Eine Korrektur eines bestätigten Prozesses setzt ihn auf `review_required`
  und `confirmedAt` auf `null`.

## Browser-Verifikation

### Desktop — 1440 × 900

1. `Prozessbild bearbeiten` aktiviert sichtbar den Bearbeitungsmodus.
2. Diagramm und Accordion-Karten behalten ihre Position und Reihenfolge.
3. Ein Diagrammknoten wird umbenannt; Diagramm und Karte zeigen denselben
   Entwurf.
4. Ein Schritt wird zwischen zwei Knoten eingefügt, ausgefüllt und automatisch
   geöffnet.
5. Der Schritt wird per Pfeil und anschließend per Drag-and-drop verschoben.
6. Ein unreferenzierter Schritt wird erst nach Bestätigung gelöscht.
7. Ein referenzierter Schritt kann nicht gelöscht werden; der Dialog nennt die
   betroffenen Entscheidungen.
8. Eine unbekannte Quelle ist als `Angabe fehlt` markiert, wird aus einer
   bestehenden Quelle gewählt und verliert die Markierung.
9. `Andere Quelle eingeben …` öffnet das Freitextfeld und persistiert den Wert.
10. `Andere Art eingeben …` öffnet `typeDetail` und persistiert `type: other`.
11. Input, Output, Entscheidung und Sonstiges werden in ihren bestehenden
    Karten geändert.
12. Abbruch stellt den kanonischen Ausgangsstand vollständig wieder her.
13. Speichern persistiert alle Änderungen nach Reload und beendet den Modus.

### Tablet — 768 × 1024

- Die Seite besitzt keinen horizontalen Overflow.
- Das Diagramm scrollt weiterhin ausschließlich intern horizontal.
- Strukturaktionen sind ohne Drag-and-drop vollständig bedienbar.
- Quellen- und Artenauswahl sowie Freitextfelder bleiben vollständig sichtbar.
- Accordion-Karten und persistente Aktionsleiste überdecken sich nicht.

### Accessibility und Fehlerprüfung

- Modus, fehlende Angaben und deaktivierte 1–8-Grenzen sind nicht nur über
  Farbe erkennbar.
- Alle Icon-Aktionen besitzen eindeutige deutsche Accessible Names.
- Löschen verwendet einen fokussierten Dialog und stellt Fokus nach Abbruch
  wieder her.
- Keyboard-Navigation kann Schritte öffnen, verschieben, ergänzen und löschen.
- Console enthält keine Errors oder Warnings.
- Es gibt keine fehlgeschlagenen XHR-/Fetch-Requests.

## Validierungsbefehle

Während der Implementierung:

```zsh
./scripts/qa test tests/process-domain.test.ts
./scripts/qa test tests/process-storage.test.ts
./scripts/qa test tests/process-ai-contract.test.ts
./scripts/qa test tests/process-api.test.ts
./scripts/qa changed
```

Vor Handoff:

```zsh
./scripts/qa all
./scripts/qa release
git diff --check
git status --short --branch
```

## Abnahmekriterien

Die Umsetzung ist abgeschlossen, wenn:

- genau ein `isEditMode` die gesamte Prozesssteckbriefseite steuert;
- die sichtbaren Komponenten selbst zwischen Lesen und Bearbeiten wechseln;
- das lineare Diagramm einen bis acht Schritte hinzufügen, umbenennen,
  verschieben und sicher löschen kann; die Synthese bleibt auf fünf bis acht
  initiale Schritte begrenzt;
- Diagramm und Accordion-Karten jederzeit dieselben IDs, Namen und Reihenfolge
  zeigen;
- Input, Output, Informationen, Entscheidungen und Sonstiges inline bearbeitbar
  sind;
- fehlende strukturierte Werte im Bearbeitungsmodus sichtbar und zugänglich
  markiert werden;
- Quelle und Art Auswahlfelder mit funktionierender Freitextoption besitzen;
- neue, geänderte, verschobene und gelöschte Schritte ID-basiert und atomar
  auditiert werden;
- Abbruch keine kanonischen Daten verändert;
- Speicherung nach Reload vollständig erhalten bleibt;
- alle fokussierten Tests, `./scripts/qa all` und `./scripts/qa release`
  erfolgreich sind;
- Desktop- und Tablet-Verifikation ohne Consolefehler, fehlgeschlagene Requests
  oder horizontalen Seitenoverflow abgeschlossen ist.
