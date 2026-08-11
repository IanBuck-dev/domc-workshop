# Umsetzung: Speicherschicht und Destillationslauf

Karte: [Dateibasiertes Agenten-Gedächtnis](../map-agent-memory.md)
Typ: `wayfinder:task` (AFK, Ausführung)
Blockiert von: —
Bearbeiter: Claude (Codex-Delegation)
Status: geschlossen

## Question

Kern der Karte in Code, nach den Entscheidungen aus
[008](008-gedaechtnisformat-und-schreibkriterien.md) und
[009](009-destillationslauf-nach-dem-gespraech.md):

1. **Memory-Repository** (Storage-Paket): `workspace/memory/` mit den fünf
   Themen-Dateien, atomare Writes, append-only `memory-history.jsonl` mit
   Vorher-Ständen, Generierung von `MEMORY.md` aus den Themen-Dateien,
   Laufzeitvalidierung beim Lesen.
2. **Destillations-Contract:** versionierter Prompt (`defaults/prompts/`) mit den
   Schreibkriterien aus 008 + JSON-Schema/Zod für die Eintragsliste
   (neu/bestätigen/aktualisieren je Themen-Datei).
3. **Destillations-Adapter** (`packages/claude/`) nach dem Bounded-Op-Muster
   (`runStructured`, `tools: "none"`).
4. **Anbindung an `POST /:id/chat/confirm`:** eigene `enqueueProcessOperation` nach dem
   Discovery-Vorbild — nicht blockierend, Fehlschlag nur auditiert
   (`memory-distillation-failed`), Erfolg auditiert (`memory-distilled`).
5. **`AGENTS.md`-Ergänzung:** die Destillation als zusätzliche, durch die Bestätigung
   ausgelöste begrenzte Einzeloperation in die Ausnahmenliste aufnehmen.
6. Tests gemäß Repo-Regel (Domänenregeln, Datei-/Reset-Sicherheit, Claude-Contract);
   `./scripts/qa all` vor Abschluss.

## Resolution

Umgesetzt und verifiziert am 2026-08-10.

### Ergebnis je Arbeitspunkt

1. **Speicher:** `packages/domain/src/memory.ts` und
   `packages/storage/src/memory-repository.ts` verwalten und validieren fünf
   Themen-Dateien, erzeugen `MEMORY.md`, schreiben Vorher-Snapshots append-only nach
   `memory-history.jsonl` und schützen atomare Read-modify-write-Batches seriell.
2. **Vertrag:** `defaults/prompts/memory-distillation.md` enthält die Schreibkriterien
   aus „Gedächtnisformat und Schreibkriterien“ wörtlich;
   `defaults/ai-schemas/memory-distillation.json` und das Zod-Schema definieren
   `add`, `confirm` und `update` je Themen-Datei.
3. **Adapter:** `packages/claude/src/memory-distillation-adapter.ts` und
   `memory-distillation-contracts.ts` führen genau einen strukturierten Lauf mit frischer
   Session, `tools: "none"`, eingefrorenem JSON-Schema und Trace aus. Eingabe sind nur
   Transkript, bestätigtes Prozessverständnis und aktuelle Themen-Dateien.
4. **Bestätigungshook:** `apps/server/src/memory-distillation-service.ts`,
   `memory-distillation-defaults.ts`, `routes/chat-captures.ts`, `index.ts` und
   `process-operation-manager.ts` reihen nach Discovery eine separate begrenzte
   Destillation ein. Erfolg wird als `memory-distilled`, jeder Start-/Lauffehler als
   `memory-distillation-failed` auditiert; die Bestätigung bleibt erfolgreich und der
   Fehler bleibt aus der UI-Fehlerliste.
5. **Regelwerk:** `AGENTS.md` nennt die zusätzliche bounded Memory-Destillation nach
   Prozessbestätigung ausdrücklich.
6. **Tests:** `tests/memory-domain.test.ts`, `memory-storage.test.ts` und
   `memory-ai-contract.test.ts` prüfen Operationen einschließlich unbekannter Referenzen,
   Round-trip/Snapshot/Index/Reset sowie Schema und tool-freien Adapter. Bestehende
   Chat-API- und Queue-Tests decken Hook, Audit und serielle Folgeoperation ab.

### Eigene Entscheidungen und Abweichungen

- `update` erhält vorhandene Quellen und ergänzt die aktuelle Prozess-ID; der Quellen-Tag
  zeigt das Datum der jüngsten Bestätigung. Referenzen werden leerraumnormalisiert,
  unbekannte Referenzen verwerfen den ganzen Batch vor dem ersten Write.
- Der Anwendungscode verwirft E-Mail-Adressen, lange Ziffernfolgen und direktive
  Prompt-Anweisungen zusätzlich zur Modellanweisung.
- `scripts/build-release.ts` nutzt Vites nativen Config-Loader. Der bisherige Bundle-
  Loader schrieb sein Tempfile außerhalb des beschreibbaren Worktrees und verhinderte
  sonst die geforderte QA; das Build-Ergebnis bleibt unverändert.
- Prettier formatierte außerdem die bereits vorhandenen Dateien
  `docs/research/AGENT-MEMORY-FILE-BASED.md` und
  `docs/wayfinder/tickets/011-gedaechtnis-im-prompt.md` ohne Inhaltsänderung, damit die
  vollständige Formatprüfung grün ist.

### Verifikation

- `./scripts/qa test tests/memory-domain.test.ts tests/memory-storage.test.ts tests/memory-ai-contract.test.ts tests/chat-api.test.ts tests/process-operation-manager.test.ts` — grün.
- `./scripts/qa changed` — Lint, Typecheck, Tests und Build grün.
- `./scripts/qa all` — Format, Lint, Typecheck, vollständige Tests und Build grün.
- `bun run build:release` — Web-Build, Betreiberangaben-Prüfung und macOS-/Windows-/Linux-Artefakte grün; verwendet ausschließlich eine lokale fiktive, ignorierte Betreiberdatei.
