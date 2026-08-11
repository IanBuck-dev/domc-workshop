# Umsetzung: Konsolidierungslauf

Karte: [Dateibasiertes Agenten-Gedächtnis](../map-agent-memory.md)
Typ: `wayfinder:task` (AFK, Ausführung)
Blockiert von: [013](013-umsetzung-speicher-und-destillation.md)
Bearbeiter: Claude (Codex-Delegation)
Status: geschlossen

## Question

Entscheidungen aus [010](010-konsolidierungslauf-einstellungen.md) umsetzen:

1. Versionierter Konsolidierungs-Prompt + Schema (vollständige neue Dateiinhalte plus
   strukturierte Änderungszusammenfassung mit Begründung je Löschung) und Adapter nach
   dem Bounded-Op-Muster.
2. Idempotente Servicefunktion `runMemoryConsolidation()` hinter
   `POST /api/memory/consolidate`; Lauf über die serielle Queue des
   Operation-Managers, zweiter Start während eines Laufs wird abgewiesen; Fortschritt
   über das bestehende SSE-Muster.
3. Anwendung: Vorher-Snapshots ins Audit, atomare Writes, Index-Regeneration,
   Audit-Eintrag `memory-consolidated` samt Zusammenfassung.
4. Tests: Snapshot-vor-Write, Abweisung paralleler Starts, Schema-Validierung,
   Idempotenz bei leerem Brain. `./scripts/qa all` vor Abschluss.

## Resolution

Umgesetzt am 2026-08-10.

- Vollständiger versionierter Prompt-, JSON-Schema- und Zod-Vertrag für alle fünf
  Themen-Dateien plus Änderungszusammenfassung. Neue Quellen-IDs oder
  Bestätigungsdaten, fehlende Löschgründe und unerklärter Eintragsverlust werden vor
  jedem Write abgewiesen.
- `runMemoryConsolidation()` ist idempotent für ein leeres Brain und wird über
  `POST /api/memory/consolidate` in dieselbe globale serielle Queue eingereiht. Ein
  zweiter wartender oder laufender Start erhält HTTP 409.
- Der Batch auditiert alle fünf Vorher-Dateien mit `memory-consolidated`, ersetzt sie
  atomar, erzeugt den Index neu und veröffentlicht `idle`, `queued`, `running`,
  `completed` oder `failed` als globales SSE-Ereignis.

`GET /api/memory` und `DELETE /api/memory` bleiben ausdrücklich Ticket 016.

### Vertrag für Ticket 016

- `POST /api/memory/consolidate` antwortet bei Annahme mit HTTP 202 und
  `{ "operationId": "<UUID>", "state": "queued" }`; während `queued` oder `running`
  folgt HTTP 409 mit `{ "error": "<deutscher Text>" }`.
- `GET /api/events` sendet beim Verbinden neben `operations` den letzten globalen
  SSE-Event `memory-consolidation`. Payloads sind `{ type, state: "idle" }`,
  `{ type, operationId, state: "queued" | "running" }`, bei Erfolg zusätzlich
  `state: "completed"` und `summary`, bei Fehler `state: "failed"` und `error`.
- `summary` enthält `mergedCount`, `deletedCount`, `movedCount` und `deletions[]` mit
  jeweils `{ fact, reason }`. Der SSE-Stand ist laufzeitlokal und beginnt nach einem
  Serverneustart wieder mit `idle`.

### Eigene Entscheidungen

- Der globale Status ist eine minimale nicht-prozessbezogene Event-Variante. Der Lauf
  nutzt dieselbe serielle `queueTail`, erscheint aber nicht in der Prozess-Operationsliste
  und besitzt in diesem Ticket keinen Cancel-Endpunkt.
- Alle Chat-, Destillations- und Konsolidierungszugriffe teilen dieselbe
  `MemoryRepository`-Instanz; Snapshot-Reads sind vollständig gesperrt.
- Ein-/Ausgabepuffer decken fünf Dateien mit jeweils bis zu 200.000 Zeichen plus
  JSON-Overhead ab. Quellenlisten erlauben bis zu 1.000 Prozess-IDs.

### Verifikation

- `./scripts/qa changed` — grün.
- `./scripts/qa all` — Format, Lint, Typecheck, vollständige Tests und Build grün.
- `bun run build:release` — Web-Build und macOS-/Windows-/Linux-Artefakte grün.
