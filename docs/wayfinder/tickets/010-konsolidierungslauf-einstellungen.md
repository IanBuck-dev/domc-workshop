# Konsolidierungslauf aus den Einstellungen

Karte: [Dateibasiertes Agenten-Gedächtnis](../map-agent-memory.md)
Typ: `wayfinder:grilling` (HITL)
Blockiert von: [008](008-gedaechtnisformat-und-schreibkriterien.md)
Bearbeiter: Claude
Status: geschlossen

## Question

Entschieden ist: ein manuell aus den Einstellungen startbarer Lauf räumt das Brain auf und
verdichtet — Cron-vorbereitet, aber ohne Cron. Offen:

1. **Aufgabenumfang.** Duplikate zusammenführen, Formulierungen verdichten, Veraltetes
   erkennen — darf der Lauf auch löschen, oder nur zusammenfassen und markieren? Was
   passiert mit Widersprüchen (stehen lassen und kennzeichnen vs. neuere Aussage gewinnt)?
2. **Sicherheitsnetz.** Der Lauf schreibt das Brain um — reicht die append-only
   Audit-Historie als Rücksprung, oder braucht es einen Vorher-Stand (Git-Commit je Lauf)?
3. **Cron-Vorbereitung.** Welcher Schnitt macht den Lauf später cron-fähig, ohne jetzt
   Scheduling zu bauen (idempotenter Job hinter einem Funktionsaufruf + API-Endpunkt)?
4. **Einstellungs-UI.** Startknopf, Laufstatus, Ergebnisanzeige („X Einträge
   zusammengeführt") — welches bestehende Job-Muster wird übernommen (Befund aus 007)?
   Deutsche Texte, kein Modell-Vokabular.

## Resolution

Entschieden am 2026-08-10 (Autorität vom Nutzer, Rest ausgestaltet).

1. **Volle Autorität, inklusive Löschen.** Der Lauf darf zusammenführen, verdichten,
   umformulieren **und** Einträge entfernen, die er als falsch oder überholt erkennt.
   Widersprüche darf er selbst auflösen (neuere/besser belegte Aussage gewinnt) oder,
   wenn unentscheidbar, nach `offene-fragen.md` verschieben. Absicherung ist allein
   das Audit: Vorher-Stand jeder Datei in `memory-history.jsonl`, Wiederherstellung
   über den Snapshot.
2. **Mechanik.** Frische Session, begrenzte Einzeloperation (`runStructured`,
   `tools: "none"`): Eingabe alle Themen-Dateien, Ausgabe die vollständigen neuen
   Dateiinhalte plus eine strukturierte Änderungszusammenfassung (zusammengeführt /
   gelöscht / verschoben, mit Begründung je Löschung). Anwendungscode schreibt atomar,
   regeneriert `MEMORY.md`, auditiert `memory-consolidated` samt Zusammenfassung.
3. **Nebenläufigkeit.** Global höchstens ein Gedächtnis-Schreiber: Konsolidierung und
   Destillationen laufen über dieselbe serielle Queue des Operation-Managers; ein
   zweiter Konsolidierungsstart während eines Laufs wird abgewiesen.
4. **Cron-Vorbereitung.** Idempotente Servicefunktion `runMemoryConsolidation()` hinter
   `POST /api/memory/consolidate` — ein späterer Scheduler ruft dieselbe Funktion;
   Scheduling selbst bleibt laut Karte out of scope.
5. **Einstellungs-UI.** Im neuen Abschnitt „Gelerntes Firmenwissen"
   ([012](012-sichtbarkeit-im-ui.md)): Startknopf „Wissen aufräumen", Laufstatus über
   das bestehende SSE-Muster, danach die Änderungszusammenfassung in deutscher
   Alltagssprache („5 Einträge zusammengeführt, 2 entfernt"). Erste serverbackte
   Aktion der bisher rein browserlokalen Einstellungsseite.
