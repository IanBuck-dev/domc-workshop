# Implementierungsplan: verpflichtende Arbeitsmerkmale

## Ziel und Produktgrenze

Die fünf offenen Textblöcke der Prozessaufnahme bleiben bestehen. Vier kurze,
verpflichtende Auswahlgruppen ergänzen sie so, dass die vier ursprünglichen
Dimensionen aus der Excel-Abfrage explizit und strukturiert erfasst werden.

Die Oberfläche verwendet ausschließlich den Begriff `Arbeitsmerkmale`. Sie
spricht nicht von KI-Potenzial, unstrukturierten Daten, Adaptivität oder
Mustererkennung. Die Angaben dienen dem besseren Verständnis des heutigen
Prozesses. KI-Use-Case-Erzeugung, Eignungsbewertung, Scoring und Priorisierung
bleiben außerhalb des aktiven Flows.

Neue Prozessaufnahmen verwenden weiterhin das einzige aktive Profil
`compact-v1`, jedoch in Version 2. Bestehende Aufnahmen mit Profilversion 1
bleiben unverändert lesbar und werden nicht mit erfundenen Antworten migriert.

## Verbindliche Auswahlgruppen

### Informationen aus mehreren Quellen

Zuordnung: `information-systems`

Frage:

> Müssen Informationen aus mehreren Quellen erst miteinander verbunden und
> fachlich eingeordnet werden, um den Fall bearbeiten zu können?

Genau eine Antwort ist erforderlich:

- `yes` — Ja
- `no` — Nein
- `unsure` — Nicht sicher

### Arten von Inhalten

Zuordnung: `information-systems`

Frage:

> Welche Arten von Inhalten müssen dabei gelesen, verstanden oder erstellt
> werden?

Mindestens eine Antwort ist erforderlich. Mehrfachauswahl ist zulässig:

- `free-text` — Freitexte, beispielsweise E-Mails, Briefe oder Notizen
- `audio-speech` — Gesprochene Sprache oder Audioaufnahmen
- `images-scans` — Bilder oder eingescannte Unterlagen
- `video` — Videos
- `other-freeform-files` — Andere frei aufgebaute Dokumente oder Dateien
- `none` — Keine davon – ausschließlich feste Felder, Listen oder Tabellen
- `unsure` — Nicht sicher

`none` und `unsure` sind untereinander sowie gegenüber allen positiven
Antworten exklusiv.

### Erkennen und Anpassen im Einzelfall

Zuordnung: `flow-roles`

Frage:

> Was müssen Mitarbeitende im normalen Ablauf selbst erkennen oder an den
> Einzelfall anpassen?

Mindestens eine Antwort ist erforderlich. Mehrfachauswahl ist zulässig:

- `detect-unusual-cases` — Ungewöhnliche Fälle oder Auffälligkeiten erkennen
- `detect-recurring-connections` — Wiederkehrende Zusammenhänge erkennen
- `adapt-case-flow` — Den Ablauf abhängig vom Einzelfall anpassen
- `none` — Nichts davon
- `unsure` — Nicht sicher

`none` und `unsure` sind untereinander sowie gegenüber allen positiven
Antworten exklusiv.

### Entscheidungen und Lösungsfindung

Zuordnung: `decisions-controls-handoffs`

Frage:

> Was ist bei Entscheidungen oder der Lösungsfindung erforderlich?

Mindestens eine Antwort ist erforderlich. Mehrfachauswahl ist zulässig:

- `estimate-future` — Zukünftige Entwicklungen, Ergebnisse oder Risiken
  einschätzen
- `decide-with-incomplete-rules` — Bei unklarer Sachlage eine passende
  Entscheidung oder Lösung finden, obwohl Regeln nicht jeden Fall abdecken
- `none` — Nichts davon
- `unsure` — Nicht sicher

`none` und `unsure` sind untereinander sowie gegenüber allen positiven
Antworten exklusiv.

## Domain- und Konfigurationsvertrag

In `packages/domain/src/process-understanding.ts` werden folgende festen IDs
und Typen ergänzt:

```ts
type WorkCharacteristicId =
  | "combined-information-sources"
  | "content-types"
  | "case-specific-recognition"
  | "uncertain-decisions";

interface WorkCharacteristicAnswer {
  characteristicId: WorkCharacteristicId;
  selectedOptionIds: string[];
  answeredAt: string;
}
```

Die Profilversion-2-Konfiguration enthält für jede feste ID:

- die unveränderliche Themenblock-Zuordnung;
- den editierbaren deutschen Fragetext;
- einen editierbaren Hilfetext;
- die unveränderliche Auswahlart;
- die unveränderlichen semantischen Options-IDs und sichtbaren
  Standardbezeichnungen.

Browser-Einstellungen dürfen nur Frage und Hilfetext ändern. IDs,
Themenblock-Zuordnung, Auswahlart und Antwortoptionen sind nicht editierbar.
Import und Backend validieren exakt die vier IDs, ihre feste Zuordnung und ihre
Optionsmengen.

Die Schemas akzeptieren weiterhin Profilversion 1 ohne Arbeitsmerkmale, damit
bestehende Records und ihre unveränderten Konfigurations-Hashes gültig bleiben.
Neue Records werden ausschließlich mit Profilversion 2 angelegt. Für Version 2
gilt vor der Analyse:

- exakt eine Antwort je Arbeitsmerkmal;
- keine unbekannten oder doppelten IDs;
- ausschließlich zur Frage gehörende Options-IDs;
- mindestens eine Auswahl;
- bei `combined-information-sources` genau eine Auswahl;
- `none` und `unsure` jeweils nur allein.

`ProcessCaptureRecord` erhält `workCharacteristicAnswers`. Die Antworten
bleiben direkte Nutzereingaben und werden nicht von der KI umgeschrieben. Die
abschließende Bestätigung bestätigt sie gemeinsam mit dem übrigen Prozessbild.

## Speicherung und API

`answers.json` speichert für Profilversion 2 atomar:

```json
{
  "mainAnswers": [],
  "workCharacteristicAnswers": [],
  "selectedUploadIds": []
}
```

Der Audit-Eintrag `main-answers-saved` enthält die strukturierten Antworten.
Der bestehende Append-only-Vertrag bleibt erhalten.

`PUT /api/processes/:id/answers` erhält für Version 2 den Body:

```ts
{
  answers: TopicAnswer[];
  workCharacteristicAnswers: WorkCharacteristicAnswer[];
  selectedUploadIds: string[];
}
```

Für Version 1 bleibt der bisherige Body gültig. Der Server lehnt fehlende,
widersprüchliche und manipulierte Version-2-Antworten mit `400` ab. Die
Analyse-Route lehnt einen unvollständigen Version-2-Record zusätzlich mit `409`
ab, selbst wenn ein Client die Formularvalidierung umgeht.

In der Review-Phase ermöglicht
`PATCH /api/processes/:id/work-characteristics` eine fachliche Korrektur:

```ts
{
  answers: WorkCharacteristicAnswer[];
  reason: string;
}
```

Die Begründung ist verpflichtend. Die Änderung wird mit vorherigem und neuem
Wert auditiert. Bei einem bereits bestätigten Record wird die Bestätigung wie
bei anderen menschlichen Korrekturen aufgehoben und der Record auf
`review_required` gesetzt.

Bestehende Version-1-Dateien werden weder neu geschrieben noch ergänzt. Ihr
Ergebnis zeigt lediglich, dass diese Angaben damals nicht erhoben wurden.

## KI-Vertrag

Follow-up- und Synthese-Requests erhalten die Arbeitsmerkmale als separaten,
strukturierten Teil der Prozessangaben. Übergeben werden semantische ID,
sichtbarer Fragetext und sichtbare Bezeichnungen der gewählten Antworten.

Der Follow-up-Prompt wird ergänzt:

- `unsure` darf als materielle Lücke berücksichtigt werden;
- Widersprüche zwischen Textantwort und Auswahl dürfen eine Rückfrage auslösen;
- das bestehende Limit von höchstens einer Rückfrage pro Themenblock und einer
  einzigen Rückfragerunde bleibt unverändert;
- bei mehreren Lücken im selben Themenblock wird nur die materiell wichtigste
  adressiert;
- aus den Antworten dürfen keine KI-Eignung, Klassifikation, Bewertung oder
  Lösungsvorschläge abgeleitet werden.

Der Synthese-Prompt darf die Arbeitsmerkmale zum Verständnis des heutigen
Ablaufs nutzen. Er darf sie nicht umdeuten oder bewerten. Die strukturierten
Originalantworten werden serverseitig beibehalten und nicht aus der
KI-Antwort rekonstruiert.

## Frontend-Verhalten

`ProcessTopicCard` rendert nach dem freien Textfeld die dem Themenblock
zugeordneten Arbeitsmerkmale:

- `combined-information-sources` als Radiogruppe;
- die übrigen Merkmale als Checkboxgruppen;
- jede Gruppe als semantisches `fieldset` mit `legend` und Hilfetext;
- keine vorausgewählte Antwort;
- sichtbare Auswahl- und Fehlerzustände;
- Tastaturbedienung und verständliche Screenreader-Beschriftung.

Der Button `Angaben prüfen lassen` bleibt deaktiviert, bis alle fünf Texte und
alle vier Auswahlgruppen valide sind. Bei einem ungültigen Submit wird die
erste fehlerhafte Gruppe fokussiert und eine deutsche Fehlermeldung angezeigt.

Die Einstellungen zeigen die Arbeitsmerkmale innerhalb ihrer zugehörigen
Themenblöcke. Frage und Hilfetext sind editierbar; Auswahlart und Antwortwerte
werden als feste Vorschau angezeigt. Export, Import und Reset verwenden einen
neuen Browser-Storage-Key für Profilversion 2. Ein alter Version-1-Override
wird nicht auf neue Prozesse angewendet.

Der fertige Prozessbrief enthält einen eigenen Abschnitt `Arbeitsmerkmale`:

- vier Fragen in fachlicher Sprache;
- die gewählten Antwortbezeichnungen;
- Kennzeichnung `Direkte Angabe`;
- Editieraktion mit verpflichtender Korrekturbegründung;
- für Version 1 stattdessen `In dieser älteren Prozessaufnahme nicht erhoben.`

Der Abschnitt zeigt keine Punktzahl, KI-Eignung, Ampel oder Interpretation.

## Files To Change

### Domain, Defaults und Dokumentation

- `packages/domain/src/process-understanding.ts`
- `defaults/process-capture-config.json`
- `docs/PRODUCT-FLOW-KI-POTENTIAL.md`
- `docs/OPERATOR_GUIDE.de.md`

### Storage, API und KI

- `packages/storage/src/process-capture-repository.ts`
- `apps/server/src/routes/process-captures.ts`
- `packages/claude/src/process-ai-contracts.ts`
- `packages/claude/src/process-follow-up-adapter.ts`
- `packages/claude/src/process-synthesis-adapter.ts`
- `defaults/prompts/process-follow-ups.md`
- `defaults/prompts/process-synthesis.md`

### Web

- `apps/web/src/components/process-topic-card.tsx`
- `apps/web/src/pages/process-capture-page.tsx`
- `apps/web/src/pages/settings-page.tsx`
- `apps/web/src/components/process-brief.tsx`
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/lib/local-config.ts`
- `apps/web/src/lib/process-types.ts`
- `apps/web/src/styles.css`

### Tests

- `tests/process-domain.test.ts`
- `tests/process-storage.test.ts`
- `tests/process-api.test.ts`
- `tests/process-ai-contract.test.ts`
- `tests/process-fixtures.ts`

## Implementierungsreihenfolge und harte Gates

### 1. Domain und Rückwärtskompatibilität

Implementiere Profilversion 2, Definitions- und Antwortschemas,
Optionsvalidierung sowie die Version-1-Kompatibilität.

Erwartete Outputs:

- neue Defaults validieren ausschließlich als aktive Profilversion 2;
- jeder gültige Version-2-Record enthält exakt vier Arbeitsmerkmale;
- jede Exklusivitätsverletzung wird abgelehnt;
- unveränderte Version-1-Fixtures und gespeicherte Records bleiben gültig;
- bestehende Konfigurations-Hashes bleiben prüfbar.

Hard Gate:

```zsh
./scripts/qa test tests/process-domain.test.ts
```

### 2. Storage und API

Erweitere atomare Speicherung, Audit-Historie, Save- und Correction-Routen und
die serverseitige Analyse-Sperre.

Erwartete Outputs:

- `answers.json` enthält alle vier Antworten;
- ein Neustart liest sie unverändert zurück;
- fehlende oder manipulierte Antworten verändern keine Datei;
- Korrekturen protokollieren Grund, vorherigen und neuen Wert;
- Version-1-Verzeichnisse bleiben bytegleich.

Hard Gate:

```zsh
./scripts/qa test tests/process-storage.test.ts
./scripts/qa test tests/process-api.test.ts
```

### 3. KI-Vertrag

Übergib die strukturierten Antworten an beide bounded Claude-Operationen und
ergänze die versionierten Prompts.

Erwartete Outputs:

- alle vier Fragen und gewählten Bezeichnungen erscheinen im KI-Input;
- `unsure` und Widersprüche können Rückfragen begründen;
- maximal eine Rückfrage je Themenblock bleibt schema- und promptseitig
  erzwungen;
- Prompts verbieten weiterhin KI-Use-Cases, Bewertung und Klassifikation.

Hard Gate:

```zsh
./scripts/qa test tests/process-ai-contract.test.ts
```

### 4. UI, Einstellungen und Review

Implementiere Auswahlgruppen, Pflichtvalidierung, konfigurierbare Wortlaute und
den prüfbaren Ergebnisabschnitt.

Erwartete Outputs:

- vier sichtbare Auswahlgruppen innerhalb der bestehenden fünf Karten;
- Submit erst nach vier gültigen Antworten;
- exklusive Optionen verhalten sich deterministisch;
- Einstellungen ändern nur Frage und Hilfetext;
- Review zeigt exakt die gespeicherten Antworten und erlaubt auditierte
  Korrekturen;
- alte Aufnahmen zeigen einen klaren Nicht-erhoben-Hinweis.

Hard Gate:

```zsh
./scripts/qa changed
bun run build
```

Chrome-Verifikation bei `1440x900` und `1024x768`:

1. alle Gruppen sind per Tastatur erreichbar;
2. ohne Auswahl ist Submit gesperrt;
3. positive Mehrfachauswahl funktioniert;
4. `none` und `unsure` entfernen andere Auswahlen und umgekehrt;
5. Browser-Reload erhält gespeicherte Antworten;
6. Einstellungen-Export und -Import erhalten die editierbaren Wortlaute;
7. Prozessbrief und Korrekturdialog zeigen verständliche deutsche Texte;
8. keine horizontale Überläufe, Konsolenfehler oder fehlgeschlagenen Requests.

### 5. Release und Live-Abnahme

```zsh
./scripts/qa all
bun run build:release
git diff --check
```

Danach als neue Pi-Releaseversion deployen. Vorher und nachher Anzahl und
Prüfsumme der bestehenden Legacy-Assessment-Dateien sowie der vorhandenen
Version-1-Prozessaufnahmen vergleichen.

Live-Abnahme:

- eine neue fiktive Version-2-Aufnahme mit allen vier Gruppen abschließen;
- mindestens einmal positive Mehrfachauswahl, `none` und `unsure` testen;
- prüfen, dass höchstens eine Rückfrage pro Themenblock entsteht;
- Arbeitsmerkmale im fertigen Prozessbrief kontrollieren und einmal mit Grund
  korrigieren;
- bestätigen, dass keine KI-Bewertung oder Lösungsempfehlung erscheint;
- Dienst aktiv, Health `200`, private API ohne Sitzung `401`;
- Desktop- und Tablet-Konsole sowie fehlgeschlagene Netzwerkanfragen sauber;
- bestehende Datenprüfsummen unverändert.

## Definition of Done

Die Erweiterung ist abgeschlossen, wenn:

1. jede neue Prozessaufnahme die vier ursprünglichen Dimensionen explizit und
   strukturiert beantwortet;
2. kein Nutzer technische KI-Begriffe verstehen muss;
3. offene Texte und Auswahlgruppen gemeinsam an Claude übergeben werden;
4. der fertige Prozessbrief die Angaben unverändert und korrigierbar zeigt;
5. keine KI-Eignung, Bewertung oder Use-Case-Generierung in den Flow gelangt;
6. Version-1-Aufnahmen unverändert lesbar bleiben;
7. Domain-, Storage-, API-, KI-, Release- und Browser-Gates vollständig grün
   sind;
8. die Live-Version auf dem Pi läuft und bestehende Daten bytegleich erhalten
   bleiben.
