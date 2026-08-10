# Destillationslauf nach dem Gespräch

Karte: [Dateibasiertes Agenten-Gedächtnis](../map-agent-memory.md)
Typ: `wayfinder:grilling` (HITL)
Blockiert von: [007](007-bestandsaufnahme-integrationspunkte.md), [008](008-gedaechtnisformat-und-schreibkriterien.md)
Bearbeiter: Claude
Status: geschlossen

## Question

Entschieden ist: nach dem Gespräch wird destilliert und sofort geschrieben. Offen ist das
Wie im Rahmen der Repo-Regeln (keine autonomen Schleifen, frische Session je Operation):

1. **Auslöser.** Was gilt als „Gespräch abgeschlossen"? Eine explizite Nutzeraktion (z. B.
   Bestätigung des Prozessverständnisses), das Ende jedes Chat-Turns, oder ein eigener
   „Merken"-Schritt? Abhängig vom Befund aus der Bestandsaufnahme (007).
2. **Eingabe und Umfang.** Bekommt der Destillat-Lauf das ganze Transkript + bestehendes
   Brain, oder nur das Delta seit dem letzten Lauf? Wie wird Doppelverarbeitung desselben
   Gesprächs verhindert (Markierung am Prozess/Transkript)?
3. **Update statt Duplikat.** Der Lauf schreibt sofort — wie geht er mit schon vorhandenen
   Einträgen um (bestätigen/aktualisieren statt anhängen), und was validiert der
   Anwendungscode vor dem Write (Schema, Schreibkriterien aus 008)?
4. **Fehlerbild.** Lauf schlägt fehl oder liefert Unbrauchbares — stiller Verzicht, Hinweis
   im UI, Wiederholung durch den Nutzer?
5. **Sichtbarkeit.** Erfährt der Nutzer, dass etwas gemerkt wurde (dezenter Hinweis im
   Chat?) — UI-Texte deutsch, kein Modell-Vokabular.

## Resolution

Entschieden am 2026-08-10 (Trigger vom Nutzer, Rest ausgestaltet).

1. **Auslöser: nur die Bestätigung.** Der Lauf hängt an `POST /:id/chat/confirm`, exakt
   nach dem Vorbild des Discovery-Autostarts (`chat-captures.ts:206-219`): eigene
   `enqueueProcessOperation`, Fehlschlag wird nur auditiert und blockiert die Bestätigung
   nie. Annahme (vom Nutzer bestätigt): die meisten Gespräche erreichen die Bestätigung;
   unbestätigte Gespräche lehren nichts. Kein „Merken"-Button, kein Turn-Trigger.
   Da `confirm` je Prozess nur einmal möglich ist, gibt es keine Doppelverarbeitung;
   ein fehlgeschlagener Lauf wird in diesem Epic nicht wiederholbar gemacht (nur Audit).
2. **Eingabe und Mechanik.** Frische Session, eine begrenzte Operation nach dem
   Bounded-Op-Muster (`SandboxRunner.runStructured`, `tools: "none"`): Eingabe sind das
   vollständige Transkript, das bestätigte Prozessverständnis, die aktuellen
   Themen-Dateien und die Schreibkriterien aus [008](008-gedaechtnisformat-und-schreibkriterien.md).
   Ausgabe ist eine Zod-validierte Liste von Einträgen je Themen-Datei
   (neu / bestehenden bestätigen / bestehenden aktualisieren) — **das Modell schreibt
   keine Dateien**; Anwendungscode wendet an, hängt den Vorher-Stand an
   `memory-history.jsonl` an und regeneriert `MEMORY.md`.
3. **Update statt Duplikat** ist Prompt- plus Anwendungspflicht: der Prompt verlangt,
   Vorhandenes zu bestätigen (Prozess-ID + Datum an den Quellen-Tag) statt neu
   anzulegen; der Anwendungscode validiert Schema und Kriterien vor dem Write.
4. **Fehlerbild:** Audit-Eintrag (`memory-distillation-failed`), kein UI-Alarm, keine
   automatische Wiederholung.
5. **Sichtbarkeit:** kein Hinweis im Chat — das Gelernte ist in den Einstellungen
   sichtbar ([012](012-sichtbarkeit-im-ui.md)); im Audit steht `memory-distilled`.
6. **Regelwerk:** die Destillation ist eine zusätzliche, durch die Bestätigung
   ausgelöste begrenzte Einzeloperation; `AGENTS.md` wird bei der Umsetzung um diesen
   Satz ergänzt, damit die Ausnahmenliste vollständig bleibt.
