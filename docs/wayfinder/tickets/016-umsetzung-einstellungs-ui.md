# Umsetzung: Einstellungs-UI „Gelerntes Firmenwissen"

Karte: [Dateibasiertes Agenten-Gedächtnis](../map-agent-memory.md)
Typ: `wayfinder:task` (Ausführung; UI-Arbeit → Opus-Subagent laut Nutzer-Routing)
Blockiert von: [013](013-umsetzung-speicher-und-destillation.md), [015](015-umsetzung-konsolidierung.md)
Bearbeiter: Claude (Opus-Subagent)
Status: geschlossen (2026-08-10)

## Question

Entscheidungen aus [012](012-sichtbarkeit-im-ui.md) umsetzen:

1. `GET /api/memory` (Themen-Inhalte + Metadaten) und `DELETE /api/memory` (Reset mit
   Snapshot ins Audit, fester Grund „manueller Reset").
2. Einstellungs-Abschnitt „Gelerntes Firmenwissen": Read-only-Ansicht der fünf Themen
   mit Eintragszahl und „zuletzt gelernt am …", leerer Zustand mit Erklärung;
   Startknopf „Wissen aufräumen" (Status via SSE, danach Änderungszusammenfassung);
   „Alles vergessen" mit Bestätigungsdialog.
3. UX-Regeln der Karte: deutsche Alltagssprache, kein Jargon, keine Dateipfade,
   shadcn-Konventionen inkl. Skeleton-Vokabular aus der Ladezustände-Karte,
   `components/ui/` unangetastet, kein Dark Mode.
4. Verifikation im Browser (Desktop + Tablet) gemäß `AGENTS.md`; `./scripts/qa all`.

## Resolution

Umgesetzt und live verifiziert (2026-08-10, angemeldete Sitzung im Browser):

- **Endpunkte:** `GET /api/memory` liefert die fünf Themen (Titel, Beschreibung,
  Eintragszahl, „zuletzt gelernt am" aus den Quellen-Tags, Einträge) plus Gesamtmetadaten;
  Themen-IDs ohne Dateiendung, keine Pfade zum Client. `DELETE /api/memory` schreibt
  zuerst den vollständigen Vorher-Stand als Snapshot (Trigger „manueller Reset") nach
  `memory-history.jsonl`, leert dann die Themen-Dateien und erzeugt `MEMORY.md` neu.
- **UI:** Letzte Einstellungs-Sektion „Gelerntes Firmenwissen" — Read-only-Themenkarten,
  leerer Zustand mit Erklärung („lernt aus bestätigten Prozessaufnahmen"),
  „Wissen aufräumen" (SSE-Status, Änderungszusammenfassung, ruhiger 409-Hinweis,
  Knopf während des Laufs deaktiviert), „Alles vergessen" mit Bestätigungsdialog.
- **Live-Verifikation:** Desktop- und Tablet-Breite (834×1112) geprüft; Konsolidierung
  → `POST /api/memory/consolidate` 202 im Netzwerk-Tab, Parallelstart → 409 mit
  deutscher Meldung, Abschluss „Aufgeräumt: Es gab nichts aufzuräumen."; Gedächtnisblock
  „## Hintergrundwissen über das Unternehmen" nachweislich genau einmal (nur erster Zug)
  in der SDK-Session von PROC-0004 über zwei AI-Züge; Reset → Bestätigungsdialog →
  leerer Zustand, Snapshot mit Trigger „manueller Reset" und vollständigem Vorher-Stand
  aller fünf Dateien im Audit. `./scripts/qa all` grün.
