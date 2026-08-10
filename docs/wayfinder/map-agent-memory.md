# Map: Dateibasiertes Agenten-Gedächtnis

`wayfinder:map` — Tickets liegen als Kindtickets in `docs/wayfinder/tickets/` (fortlaufende
Nummerierung ab 007).

Dieser Tracker ist lokales Markdown (kein Tracker konfiguriert, also der Standard).
Blockierung per Konvention `Blockiert von:` im Ticketkopf. Die Frontier sind alle offenen,
unblockierten Tickets ohne `Bearbeiter:`.

## Destination

Der Chat-Capture-Agent liest und erweitert über Sitzungen hinweg ein einziges
firmenweites Markdown-Gedächtnis („ein Brain"): Begriffe, Systeme, Zuständigkeiten,
wiederkehrende Muster. Nach jedem abgeschlossenen Gespräch destilliert ein Lauf neue
Einträge und schreibt sie sofort; ein aus den Einstellungen manuell startbarer
Konsolidierungslauf räumt auf und verdichtet (Cron-vorbereitet, aber ohne Cron). Die
Anwendung wird tatsächlich geändert, nicht nur spezifiziert.

## Notes

- **Diese Karte führt Ausführung mit** — Ziel ist der geänderte Zustand der Anwendung.
- Vorentschieden (Grilling 2026-08-08): dateibasiert, kein Vektorindex, kein externer
  Memory-Dienst. **Ein** Gedächtnis, firmenweit — keine Prozess-, Abteilungs- oder
  Nutzer-Scopes. Vertraute Nutzer hinter Login: Provenienz + Git-Historie als leichte
  Absicherung; keine Read-only-Schichten, Statusleitern oder Retrieval-Screens.
- Grundlage: [Recherche-Report dateibasiertes Agenten-Gedächtnis](../research/AGENT-MEMORY-FILE-BASED.md)
  (Sol, 2026-08-07) — dient als Referenz, sein volles Pipeline-Design ist bewusst
  **nicht** übernommen.
- Externer Stack-Kontrakt: [Chat Capture V1 current stack](../research/CHAT-CAPTURE-CURRENT-STACK.md)
  (Session-Lifecycle, Provider-Pinning).
- Repo-Regeln, die jedes Ticket binden (`AGENTS.md`): keine autonomen Schleifen — jeder
  Lauf ist eine explizit ausgelöste, begrenzte Operation; frische Claude-Session je
  Operation; atomare Writes + append-only Audit; Prompts/Schemas als versionierte
  Repo-Dateien; Laufzeitvalidierung jeder Datei und jeder AI-Antwort; deutsche UI-Texte;
  keine echten Personendaten.
- HITL-Tickets über `/grilling` und `/domain-modeling`; vor Abschluss von
  Ausführungs-Tickets `./scripts/qa all`.

## Decisions so far

<!-- Index: eine Zeile je geschlossenem Ticket, Detail liegt im Ticket selbst -->

- [Bestandsaufnahme der Integrationspunkte](tickets/007-bestandsaufnahme-integrationspunkte.md) — explizites Gesprächsende existiert: `POST /:id/chat/confirm` setzt `state: "confirmed"` und startet heute schon automatisch den Discovery-Job (Aufhänger für den Destillationslauf); Jobs laufen über `enqueueProcessOperation` + SSE, Workspace unter `<appBase>/workspace` ohne Git, `memory/` würde als Geschwister von `process-captures/` liegen; Einstellungsseite ist bisher rein browserlokal.
- [Gedächtnisformat und Schreibkriterien](tickets/008-gedaechtnisformat-und-schreibkriterien.md) — `workspace/memory/` mit generiertem `MEMORY.md`-Index + fünf Themen-Dateien (Glossar, Systeme, Zuständigkeiten, Muster, offene Fragen); ein kompakter Bullet je Fakt mit Inline-Quellen-Tag `(Quelle: PROC-XXXX, bestätigt <Datum>)`, keine IDs/Statusleiter; Sicherheitsnetz ist ein append-only `memory-history.jsonl` mit Vorher-Ständen (kein Git); Schreibkriterien wie im Ticket, wörtlich für den versionierten Destillations-Prompt.
- [Destillationslauf nach dem Gespräch](tickets/009-destillationslauf-nach-dem-gespraech.md) — hängt nur an `POST /:id/chat/confirm` nach dem Vorbild des Discovery-Autostarts (nicht blockierend, Fehlschlag nur auditiert); frische Session, bounded Op mit `tools: "none"`, Zod-validierte Eintragsliste — Anwendungscode schreibt, das Modell nie; keine Doppelverarbeitung, kein Chat-Hinweis.
- [Konsolidierungslauf aus den Einstellungen](tickets/010-konsolidierungslauf-einstellungen.md) — volle Autorität inkl. Löschen und Widerspruchsauflösung, abgesichert allein durch Vorher-Snapshots im Audit; `runMemoryConsolidation()` hinter `POST /api/memory/consolidate` (cron-fähig, ohne Cron); serielle Queue, ein Gedächtnis-Schreiber global; Änderungszusammenfassung im UI.
- [Gedächtnis im Prompt](tickets/011-gedaechtnis-im-prompt.md) — alle Themen-Dateien (Cap 25 KB) als gekennzeichneter Block im User-Prompt des **ersten** Zugs + Recovery-Prompt; Systemprompt und `freezeContracts()` bleiben unberührt, Rahmung reist im Block mit; Empfänger nur Chat Capture.
- [Sichtbarkeit im UI](tickets/012-sichtbarkeit-im-ui.md) — Einstellungs-Abschnitt „Gelerntes Firmenwissen": Read-only-Ansicht der Themen-Dateien, „Wissen aufräumen"-Knopf und „Alles vergessen"-Reset mit Snapshot; keine Einzeleintrags-Bearbeitung.
- [Umsetzung: Speicherschicht und Destillationslauf](tickets/013-umsetzung-speicher-und-destillation.md) — firmenweites Dateigedächtnis, validierter Destillationsvertrag und separate auditierte bounded Operation nach Chat-Bestätigung sind implementiert und vollständig verifiziert.
- [Umsetzung: Gedächtnis in den Chat-Prompt](tickets/014-umsetzung-prompt-injektion.md) — erster Chat-Zug und Session-Recovery erhalten einen vollständig validierten, gekennzeichneten Themenblock; die 25-KiB-Grenze schneidet nur zwischen Bullet-Fakten und wird im Prozess-Audit festgehalten.
- [Umsetzung: Konsolidierungslauf](tickets/015-umsetzung-konsolidierung.md) — ein frischer, tool-freier vollständiger Konsolidierungslauf validiert Quellen gegen den Vorher-Stand, auditiert alle fünf Snapshots und läuft exklusiv über `POST /api/memory/consolidate` mit globalem SSE-Status.
- [Umsetzung: Einstellungs-UI „Gelerntes Firmenwissen"](tickets/016-umsetzung-einstellungs-ui.md) — Read-only-Sektion mit `GET /api/memory`, „Wissen aufräumen" (SSE-Status, 202/409, Zusammenfassung) und „Alles vergessen" (`DELETE /api/memory`, Snapshot-first mit Trigger „manueller Reset") sind umgesetzt und in angemeldeter Sitzung live verifiziert.

## Not yet specified

_Leer — der Nebel ist gelichtet; alle Tickets sind geschlossen, das Ziel ist erreicht._

## Out of scope

- **Gedächtnis im Discovery-Modul** (Hypothesen/Szenarien/Synthese lesen das Brain
  nicht) — das Ziel dieser Karte ist der Chat-Capture-Agent; kehrt nur als eigenes
  Vorhaben zurück.
- **Index-plus-Nachladen / grep-Abruf** — erst wenn die 25-KB-Grenze aus
  [Gedächtnis im Prompt](tickets/011-gedaechtnis-im-prompt.md) real drückt.
- **Einzeleintrags-Bearbeitung im UI** — Korrekturen laufen über Gespräche,
  Konsolidierung und den Gesamt-Reset.

- **Cron/zeitgesteuerte Konsolidierung** — explizit: nur vorbereitet, nicht gebaut.
- **Prozess-, Abteilungs- und Nutzer-Scopes** — erst nur ein Brain; Rückkehr nur bei
  neuem Ziel.
- **Report-Grade-Absicherung** (append-only Inbox, Consolidator-Statusleiter, Read-only
  Company Memory, Git-CAS, Retrieval-Screens) — Vertrauensmodell dieses Prototyps
  braucht sie nicht.
- **Vektor-DB / Embeddings / externe Memory-Dienste** — Kernprämisse des Ziels.
