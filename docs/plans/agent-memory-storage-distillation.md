# Umsetzung Speicherschicht und Destillationslauf

## Ziel

Ticket „Umsetzung: Speicherschicht und Destillationslauf“ liefert das firmenweite
Dateigedächtnis, den versionierten Destillationsvertrag, genau einen begrenzten
Destillationslauf nach Chat-Bestätigung und die erforderlichen Audit-Einträge.

## Festgelegte Umsetzung

1. `packages/domain/src/memory.ts` definiert die fünf erlaubten Topic-Dateien,
   Topic-/Eintrags-/Operations-Schemas und `applyMemoryOperations`. Operationen tragen
   ausschließlich Fakttext ohne Quellen-Tag. `add` erzeugt den Tag, `confirm` ergänzt
   die aktuelle Prozess-ID, `update` ersetzt den Fakttext und erhält vorhandene Quellen.
   `confirm` und `update` referenzieren den bisherigen Fakttext exakt. Eine unbekannte
   Referenz verwirft die gesamte Operationsliste vor jedem Audit oder Write. Fakttexte
   sind längenbegrenzt und werden zusätzlich gegen E-Mail-Adressen, lange Ziffernfolgen
   und direktive Prompt-Anweisungen geprüft; Referenzvergleiche normalisieren reine
   Markdown-Zeilenumbrüche und Leerraum.
2. `packages/storage/src/memory-repository.ts` verwaltet `workspace/memory/`, erzeugt
   fehlende Topic-Dateien mit festem deutschen Titel, validiert jeden gelesenen Topic-
   Inhalt und jede gelesene History-Zeile, schreibt vor jeder Änderung einen einzelnen
   Batch-Snapshot mit Trigger, ISO-Zeitpunkt und vollständigem Vorher-Inhalt aller
   betroffenen Topic-Dateien in `memory-history.jsonl`, schreibt danach jede Datei atomar
   und regeneriert `MEMORY.md` atomar. Ein repository-interner serieller Write-Lock schützt
   den Read-modify-write-Batch auch für spätere Konsolidierungs-/Reset-Aufrufer. Der Index
   enthält Pfad, feste Kurzbeschreibung und Bullet-Anzahl und wird bei `ensure()` repariert.
   `WorkspaceRepository.ensure()` initialisiert das Gedächtnis; ein normaler
   Workspace-Prozessreset lässt es bestehen.
3. `defaults/prompts/memory-distillation.md` enthält die Schreibkriterien aus Ticket
   „Gedächtnisformat und Schreibkriterien“ wörtlich und verlangt Deduplizierung über
   `add`/`confirm`/`update`. `defaults/ai-schemas/memory-distillation.json` spiegelt das
   strikte Zod-Schema.
4. `packages/claude/src/memory-distillation-*` definiert Request/Adapter. Der Adapter
   komponiert ausschließlich vollständiges Transkript, bestätigtes Prozessverständnis
   und aktuelle Topic-Dateien in den User-Prompt und ruft `SandboxRunner.runStructured`
   einmal mit frischer Session, `tools: "none"`, Zod-Schema, eingefrorenem JSON-Schema
   und `AiStructuredResult`-Trace auf.
5. `apps/server/src/memory-distillation-defaults.ts` validiert Prompt und JSON-Schema.
   `apps/server/src/memory-distillation-service.ts` liest den bestätigten Prozess, das
   vollständige validierte Transkript und das aktuelle Gedächtnis, führt den Adapter aus,
   wendet die Operationen mit Trigger `distillation:PROC-XXXX` an und auditiert
   `memory-distilled`; Fehler werden als `memory-distillation-failed` auditiert und innerhalb
   der Queue-Aktion geschluckt. Damit bleibt der Fehler gemäß Ticket ausschließlich im
   Prozess-Audit und erscheint nicht als fehlgeschlagene, nutzerseitig wiederholbare Aktion.
6. `POST /:id/chat/confirm` startet weiter zuerst Discovery und reiht danach eine eigene
   Memory-Operation ein. `enqueueProcessOperation` erhält eine eng begrenzte Option, eine
   zweite Operation desselben Prozesses hinter der bereits gestarteten Discovery-
   Operation zuzulassen; der Standard bleibt „höchstens eine aktive Operation je
   Prozess“. Bestätigung und HTTP-Antwort bleiben unabhängig von beiden Startfehlern.
7. `packages/domain/src/process-events.ts` ergänzt `memory-distillation` als bekannten
   Operationstyp. `apps/server/src/index.ts` verdrahtet Repository, Adapter und Service.
   `AGENTS.md` ergänzt den geforderten Satz zur bounded Operation.
8. Das Wayfinder-Ticket erhält nach erfolgreicher Verifikation Status und Resolution mit
   Ergebnisbericht; bestehende unversionierte Wayfinder-/Research-Dateien bleiben
   unangetastet.

## Files To Change

- `AGENTS.md`
- `packages/domain/src/memory.ts`
- `packages/domain/src/schemas.ts`
- `packages/domain/src/process-events.ts`
- `packages/storage/src/memory-repository.ts`
- `packages/storage/src/workspace-repository.ts`
- `scripts/build-release.ts`
- `packages/claude/src/memory-distillation-contracts.ts`
- `packages/claude/src/memory-distillation-adapter.ts`
- `defaults/prompts/memory-distillation.md`
- `defaults/ai-schemas/memory-distillation.json`
- `apps/server/src/memory-distillation-defaults.ts`
- `apps/server/src/memory-distillation-service.ts`
- `apps/server/src/process-operation-manager.ts`
- `apps/server/src/routes/chat-captures.ts`
- `apps/server/src/index.ts`
- `tests/memory-domain.test.ts`
- `tests/memory-storage.test.ts`
- `tests/memory-ai-contract.test.ts`
- `tests/chat-api.test.ts`
- `tests/process-operation-manager.test.ts`
- `docs/wayfinder/tickets/013-umsetzung-speicher-und-destillation.md`

## Tests und Akzeptanz

- `tests/memory-domain.test.ts`: add/confirm/update, Quellen-Deduplizierung,
  unbekannte Referenz verwirft den Batch ohne Teiländerung und verbotene Daten bzw.
  Anweisungen werden abgewiesen.
- `tests/memory-storage.test.ts`: Initialisierung, Round-trip, Vorher-Snapshot,
  atomare Topic-Writes, Index-Neugenerierung und Persistenz über Workspace-Reset.
- `tests/memory-ai-contract.test.ts`: gültige Beispielantwort wird von JSON- und
  Zod-Vertrag akzeptiert; ungültige Action/Felder werden abgewiesen; Adapter übergibt
  `tools: "none"`, die eingefrorene Schema-Instanz und nur erlaubte Eingaben.
- `tests/chat-api.test.ts`: Bestätigung bleibt erfolgreich, Memory wird separat gestartet,
  und Memory-Startfehler erzeugt `memory-distillation-failed` ohne Rollback.
- `tests/process-operation-manager.test.ts`: nur die explizite Folgeoption darf eine
  zweite Same-Process-Operation seriell einreihen.
- Während der Umsetzung `./scripts/qa changed`; vor Übergabe `./scripts/qa all` und
  `bun run build:release`.

## Gesperrte Annahmen

- Der Quellen-Tag führt alle bestätigenden Prozess-IDs einmalig und zeigt als Datum die
  jüngste Bestätigung.
- Der Destillationslauf nutzt Modell, Aufwand und Grenzen der aktuellen
  Prozessaufnahme; für den derzeitigen Vertrag ist das `claude-opus-4-8` mit `medium`.
- Ein leerer Operations-Batch ist gültiger Erfolg und erzeugt weder Topic-Snapshot noch
  neue Topic-Writes; `MEMORY.md` bleibt dennoch aus dem validierten Bestand ableitbar.
- Der separate Memory-Job bleibt Teil der vorhandenen global seriellen Queue. Das ist der
  bestehende Laufzeitvertrag; Ticket 013 führt keine zweite Queue ein.
