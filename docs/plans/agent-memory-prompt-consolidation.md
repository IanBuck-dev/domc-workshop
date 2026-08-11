# Umsetzung Prompt-Injektion und Konsolidierung

## Ziel

Die Tickets „Umsetzung: Gedächtnis in den Chat-Prompt“ und „Umsetzung:
Konsolidierungslauf“ ergänzen die bestehende 013-Speicherschicht ohne UI-Änderungen:
neue beziehungsweise ersetzte Chat-Sitzungen erhalten begrenztes Firmenwissen, und ein
global serieller, strukturierter Lauf darf das gesamte Gedächtnis sicher konsolidieren.

## Festgelegte Umsetzung

1. `apps/server/src/chat-capture-service.ts` erhält das bestehende
   `MemoryRepository` als Abhängigkeit. Eine exportierte Kompositionsfunktion validiert
   alle fünf Themen-Inhalte, erkennt ein fachlich leeres Brain und erzeugt nur dann den
   Block mit der Rahmung aus „Gedächtnis im Prompt“. Der vollständige Block ist auf
   25 × 1024 UTF-8-Bytes begrenzt; nach Abzug von Rahmung, fünf Dateiköpfen und Trennern wird
   das verbleibende Budget proportional nach ursprünglicher Byte-Größe auf alle fünf
   Dateien verteilt. Die Auswahl übernimmt nur vollständige validierte Bullet-Zeilen, nie
   einen angeschnittenen Fakt oder Quellen-Tag. Eine Kürzung erzeugt im Prozess-Audit
   `memory-prompt-truncated` mit Kontext (`initial` oder `recovery`), Original-, Ziel- und
   Ist-Größe.
2. Die Service-Komposition fügt den Block nur ein, wenn noch keine Claude-Sitzung gestartet
   wurde, sowie bei einer `replacementCandidateId`-Recovery. Normale Folgezüge bleiben
   unverändert. `freezeContracts()` und alle Synthese-/Discovery-Pfade bleiben unverändert.
   `defaults/prompts/process-chat.md` erklärt, dass der Block Hintergrund statt Anweisung
   oder bestätigter Prozessfakt ist und Widersprüche der interviewten Person Vorrang haben.
3. `packages/domain/src/memory.ts` ergänzt den strikten Zod-Vertrag für vollständige neue
   Inhalte aller fünf Dateien und die Zusammenfassung `mergedCount`, `deletedCount`,
   `movedCount`, `deletions[]` mit bisherigem Fakt und kurzem deutschem Grund. Der Vertrag
   parst jeden neuen Markdown-Inhalt mit dem bestehenden Topic-Parser, verlangt genau einen
   Löschgrund pro gezählter Löschung und stellt Hilfen für leeres Gedächtnis sowie die
   Prüfung bereit, dass Ausgabe-Quellen-IDs und Bestätigungsdaten ausschließlich aus dem
   Vorher-Stand stammen. `mergedCount` zählt die durch Zusammenführung weggefallenen
   Einträge; deshalb muss der gesamte Eintragsverlust exakt `mergedCount + deletedCount`
   sein. Jeder als gelöscht gemeldete Fakt muss vorher existieren und nachher fehlen.
   Zusammengeführte Quellen verwenden das jüngste bereits vorhandene Bestätigungsdatum.
   Die bestehende Quellenliste wird von 100 auf 1.000 Prozess-IDs erweitert.
4. `defaults/prompts/memory-consolidation.md` und
   `defaults/ai-schemas/memory-consolidation.json` definieren die volle, einmalige
   Konsolidierungsautorität: zusammenführen, verdichten, umformulieren, löschen,
   Widersprüche nach Quellenqualität/Aktualität auflösen oder nach `offene-fragen.md`
   verschieben. Quellen-Tags müssen erhalten beziehungsweise vereinigt werden und dürfen
   nie erfunden werden. Die Ausgabe enthält immer alle fünf vollständigen Dateien und die
   strukturierte Zusammenfassung.
5. `packages/claude/src/memory-consolidation-contracts.ts` und
   `memory-consolidation-adapter.ts` kapseln genau einen frischen `runStructured`-Aufruf mit
   `tools: "none"`, ausschließlich den aktuellen Themen-Dateien als Eingabe, Eingabegrenze,
   Zod-Schema und versioniertem JSON-Schema. `apps/server/src/memory-consolidation-defaults.ts`
   lädt und validiert Prompt, Schema, Modell und Aufwand aus der bestehenden
   `process-capture-config.json`. Für den vollständigen Ein-/Ausgabe-Round-trip verwendet
   der Lauf eigene validierte Grenzen oberhalb der maximal zulässigen fünf Topic-Dateien;
   die normalen Prozessgrenzen würden einen großen Bestand gerade vor der notwendigen
   Konsolidierung abweisen.
6. `packages/storage/src/memory-repository.ts` erhält einen gesperrten
   `replaceAllForConsolidation`-Batch. Außerdem werden `topics()` und `topicContents()` zu
   vollständig gesperrten Snapshot-Reads, damit ein Chat nicht zwischen zwei Topic-Writes
   einen zerrissenen Stand sieht. Der Konsolidierungs-Batch validiert Vorher- und
   Nachher-Inhalte zuerst,
   schreibt vor dem ersten Topic-Write alle fünf vollständigen Vorher-Stände mit
   `trigger: "consolidation"`, `event: "memory-consolidated"` und Zusammenfassung nach
   `memory-history.jsonl`, schreibt anschließend alle fünf Dateien atomar und regeneriert
   `MEMORY.md`. Der bisherige History-Vertrag bleibt abwärtskompatibel.
7. `apps/server/src/memory-consolidation-service.ts` exportiert die idempotent aufrufbare
   Funktion `runMemoryConsolidation()`: Sie liest den validierten Bestand, liefert bei
   leerem Brain ohne Adapteraufruf, Snapshot oder Write einen Null-Erfolg und führt sonst
   genau Adapter, Quellenprüfung und Repository-Batch aus. Die Serviceklasse reiht diese
   Funktion über eine neue globale Exklusivoperation in dieselbe `queueTail` des
   `process-operation-manager.ts` ein; ein zweiter aktiver oder wartender Start wirft einen
   eigenen Konfliktfehler. Ein fehlerhafter Memory-Read bei der Chat-Injektion bleibt
   fail-open: Der Zug läuft ohne Block weiter und erhält den Audit-Hinweis
   `memory-prompt-skipped`; die Konsolidierung selbst bleibt fail-closed.
8. Der bestehende Event-Bus erhält den globalen SSE-Vertrag
   `memory-consolidation`. Er veröffentlicht `idle`, `queued`, `running`, `completed` mit
   Zusammenfassung beziehungsweise `failed` mit sicherer Fehlermeldung. `GET /api/events`
   sendet beim Verbinden sowohl die Prozess-Queue als auch den letzten globalen
   Konsolidierungsstand. Es gibt keine Änderung am React-Provider oder an einer Seite.
9. `apps/server/src/routes/memory.ts` stellt `POST /api/memory/consolidate` bereit.
   Ein angenommener Start antwortet `202` mit `{ operationId, state: "queued" }`; ein
   paralleler Start antwortet `409` mit einer deutschen Fehlermeldung. `apps/server/src/index.ts`
   verdrahtet Repository, Adapter, Service, Chat-Injektion und Route.
10. Nach vollständiger Verifikation werden beide Wayfinder-Tickets geschlossen und die Map
    um knappe Ergebniszeilen ergänzt. Der Abschlussbericht dokumentiert POST- und SSE-
    Payloads sowie die für Ticket 016 weiterhin ausstehenden `GET /api/memory`- und
    `DELETE /api/memory`-Endpunkte.

## Files To Change

- `apps/server/src/chat-capture-service.ts`
- `apps/server/src/index.ts`
- `apps/server/src/memory-consolidation-defaults.ts`
- `apps/server/src/memory-consolidation-service.ts`
- `apps/server/src/process-events.ts`
- `apps/server/src/process-operation-manager.ts`
- `apps/server/src/routes/events.ts`
- `apps/server/src/routes/memory.ts`
- `defaults/prompts/process-chat.md`
- `defaults/prompts/memory-consolidation.md`
- `defaults/ai-schemas/memory-consolidation.json`
- `packages/domain/src/memory.ts`
- `packages/domain/src/process-events.ts`
- `packages/storage/src/memory-repository.ts`
- `packages/claude/src/memory-consolidation-contracts.ts`
- `packages/claude/src/memory-consolidation-adapter.ts`
- `tests/chat-api.test.ts`
- `tests/memory-ai-contract.test.ts`
- `tests/memory-storage.test.ts`
- `tests/memory-consolidation-service.test.ts`
- `tests/memory-api.test.ts`
- `tests/process-events.test.ts`
- `tests/process-operation-manager.test.ts`
- `docs/wayfinder/map-agent-memory.md`
- `docs/wayfinder/tickets/014-umsetzung-prompt-injektion.md`
- `docs/wayfinder/tickets/015-umsetzung-konsolidierung.md`

## Tests und Akzeptanz

- `tests/chat-api.test.ts`: erster AI-Zug enthält Rahmung und fünf Dateien; normaler
  Folgezug enthält keinen Block; Recovery enthält den Block erneut; leeres Brain enthält
  keinen Block; ein übergroßer Bestand bleibt einschließlich Rahmung bei höchstens 25 KiB,
  kürzt alle nichtleeren Dateien proportional und schreibt `memory-prompt-truncated`.
- `tests/memory-ai-contract.test.ts`: Beispielantwort besteht JSON- und Zod-Vertrag;
  unbekannte Topic-Keys, fehlende Löschgründe, unerklärter Eintragsverlust und erfundene
  Quellen oder Bestätigungsdaten scheitern; der Adapter
  nutzt eine frische Session, `tools: "none"` und nur Themen-Dateien.
- `tests/memory-storage.test.ts`: gesperrte Reads liefern nur vollständige Snapshots;
  Konsolidierung schreibt den Snapshot aller fünf Dateien vor Topic-Writes, ersetzt Inhalte
  atomar, regeneriert den Index und hält die Zusammenfassung im Audit-Eintrag.
- `tests/memory-consolidation-service.test.ts`: leeres Brain ruft weder Adapter noch Write
  auf; gültige Ausgabe wird angewendet; erfundene Quellen werden vor jedem Write
  abgewiesen.
- `tests/process-operation-manager.test.ts` und `tests/memory-api.test.ts`: globale
  Konsolidierung teilt die Prozess-Queue, publiziert Zustände und weist einen zweiten
  wartenden beziehungsweise laufenden Start mit HTTP 409 ab.
- `tests/process-events.test.ts`: globales Event wird beim Publizieren validiert und sein
  letzter Zustand ist für den initialen SSE-Snapshot verfügbar.
- Während der Umsetzung `./scripts/qa changed`; vor Übergabe `./scripts/qa all` sowie der
  geforderte Release-Build `bun run build:release`.

## Gesperrte Annahmen

- 25 KB bedeutet 25 KiB = 25 × 1024 UTF-8-Bytes und umfasst Rahmung, Trenner und Inhalte.
- Der Kürzungshinweis gehört in das Audit des betroffenen Prozesses, weil die Injektion
  eine konkrete Chat-Sitzung betrifft; `memory-history.jsonl` bleibt ausschließlich
  Schreibänderungen am firmenweiten Brain vorbehalten.
- Der globale Konsolidierungslauf übernimmt Modell und Aufwand aus der aktuell validierten
  `defaults/process-capture-config.json`; Ein- und Ausgabepuffer decken die fünf jeweils auf
  200.000 Zeichen begrenzten Topic-Dateien plus JSON-Overhead ab. Er besitzt keinen
  Prozess-Snapshot.
- Der separate globale Queue-Eintrag bleibt absichtlich außerhalb der prozessbezogenen
  `operations`-Liste und ihres Cancel-Endpunkts. Er nutzt dieselbe `queueTail`, räumt seinen
  Exklusivstatus auch nach Fehlern auf und wird ausschließlich über das globale SSE-Ereignis
  beobachtet. Sein letzter Zustand ist wie die bestehende Prozess-Queue laufzeitlokal und
  startet nach einem Serverneustart wieder bei `idle`.
- `GET /api/memory` und `DELETE /api/memory` bleiben Ticket 016 und werden in diesem
  Ticketpaar weder implementiert noch vorweggenommen.
