# Umsetzung: Gedächtnis in den Chat-Prompt

Karte: [Dateibasiertes Agenten-Gedächtnis](../map-agent-memory.md)
Typ: `wayfinder:task` (AFK, Ausführung)
Blockiert von: [013](013-umsetzung-speicher-und-destillation.md)
Bearbeiter: Claude (Codex-Delegation)
Status: geschlossen

## Question

Entscheidungen aus [011](011-gedaechtnis-im-prompt.md) umsetzen:

1. Gedächtnisblock (alle Themen-Dateien, Cap 25 KB mit proportionaler Kürzung +
   Audit-Hinweis) in den komponierten User-Prompt des **ersten** Zugs und in den
   Recovery-Prompt bei Session-Ersatz (`chat-capture-service.ts`), mit der im Ticket
   festgelegten mitreisenden Rahmung („Hintergrundwissen … im Zweifel nachfragen").
2. Absatz zum Umgang mit dem Block in `defaults/prompts/process-chat.md` (wirkt nur
   auf neue Prozesse — bewusst akzeptiert).
3. Folgezüge bleiben unangetastet; Synthese-/Discovery-Operationen bekommen nichts.
4. Tests: Erste-Zug- vs. Folgezug-Komposition, Kürzung an der Grenze, leeres Brain
   (kein Block). `./scripts/qa all` vor Abschluss.

## Resolution

Umgesetzt am 2026-08-10.

- `ChatCaptureService` komponiert den gekennzeichneten Block aus allen fünf validierten
  Themen-Dateien nur für den ersten Zug und eine Ersatzsitzung. Normale Folgezüge sowie
  Synthese und Discovery bleiben unverändert.
- Der Block bleibt einschließlich Rahmung bei höchstens 25 KiB UTF-8. Bei Kürzung werden
  nur vollständige Bullet-Fakten proportional ausgewählt und der Prozessverlauf erhält
  `memory-prompt-truncated`; ein fehlerhafter Read bleibt mit
  `memory-prompt-skipped` fail-open.
- Der versionierte Chat-Prompt beschreibt Hintergrundcharakter und Vorrang der
  interviewten Person. Tests decken Erstzug, Folgezug, Recovery, leeres Gedächtnis und
  die Größenbegrenzung ab.

### Eigene Entscheidungen

- Die 25-KB-Grenze ist als 25 KiB UTF-8 einschließlich Rahmung und Dateiköpfen umgesetzt.
  Proportionale Kürzung übernimmt nur vollständige validierte Bullet-Zeilen.
- Der Kürzungshinweis liegt im Audit des betroffenen Prozesses; ein ungültiger Memory-Read
  wird dort als `memory-prompt-skipped` erfasst und blockiert den Chat nicht.

### Verifikation

- `./scripts/qa changed` — grün.
- `./scripts/qa all` — Format, Lint, Typecheck, vollständige Tests und Build grün.
- `bun run build:release` — Web-Build und macOS-/Windows-/Linux-Artefakte grün.
