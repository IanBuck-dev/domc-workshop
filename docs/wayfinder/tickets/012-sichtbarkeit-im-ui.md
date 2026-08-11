# Sichtbarkeit und Pflege des Gedächtnisses im UI

Karte: [Dateibasiertes Agenten-Gedächtnis](../map-agent-memory.md)
Typ: `wayfinder:grilling` (HITL)
Blockiert von: [008](008-gedaechtnisformat-und-schreibkriterien.md)
Bearbeiter: Claude
Status: geschlossen

## Question

Sieht der Nutzer, was sich die Anwendung gemerkt hat — und kann er eingreifen?

1. **Anzeige.** Eigene Ansicht in den Einstellungen („Was die Anwendung über LifeCorp
   weiß"), nur Rohdatei-Ablage ohne UI, oder gar nichts? `AGENTS.md` verlangt, den
   aktuellen Zustand und das Warum einer Empfehlung zu zeigen — spricht für Sichtbarkeit.
2. **Eingriff.** Einzelne Einträge löschen/korrigieren im UI vs. nur „alles zurücksetzen"
   vs. Pflege nur über den Konsolidierungslauf. Menschliche Korrekturen brauchen laut
   Repo-Regel einen erfassten Grund — gilt das auch hier?
3. **Formulierung.** Deutsche, managementtaugliche Begriffe („Gelerntes", „Firmenwissen"?) —
   kein Modell- oder Memory-Jargon.

## Resolution

Entschieden am 2026-08-10 (Grundsatz vom Nutzer, Rest ausgestaltet).

1. **Read-only-Ansicht plus Gesamt-Reset.** Neuer Abschnitt **„Gelerntes
   Firmenwissen"** auf der Einstellungsseite: rendert die fünf Themen-Dateien
   (`GET /api/memory`) schreibgeschützt, gruppiert nach Thema, mit Eintragszahl und
   „zuletzt gelernt am …". Leerer Zustand mit Erklärung, woher das Wissen kommt
   („lernt aus bestätigten Prozessaufnahmen").
2. **Eingriff: nur „Alles vergessen".** Ein Reset mit Bestätigungsdialog
   (`DELETE /api/memory`): aktueller Stand wandert als Snapshot in
   `memory-history.jsonl` (Grund: manueller Reset), dann werden die Dateien geleert
   und der Index regeneriert. **Keine Einzeleintrags-Bearbeitung im UI** — Korrekturen
   fließen über neue Gespräche und den Konsolidierungslauf (volle Autorität, siehe
   [010](010-konsolidierungslauf-einstellungen.md)). Die Repo-Regel „menschliche
   Korrektur braucht erfassten Grund" greift beim Reset (fester Grund im Audit).
3. **Formulierung:** deutsche Alltagssprache — „Gelerntes Firmenwissen", „Wissen
   aufräumen" (Konsolidierung), „Alles vergessen"; kein Memory-/Modell-Jargon, keine
   Dateipfade im UI. Im selben Abschnitt wohnt der Konsolidierungs-Startknopf aus
   [010](010-konsolidierungslauf-einstellungen.md).
