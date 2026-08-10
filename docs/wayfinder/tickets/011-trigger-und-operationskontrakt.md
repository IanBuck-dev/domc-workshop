# Trigger und Operationskontrakt

Karte: [Lebende Prozessdokumentation](../map-lebende-prozessdoku.md)
Typ: `wayfinder:grilling` (HITL)
Blockiert von: [007 Datenmodell](007-datenmodell-quelle-der-wahrheit.md), [009 Review-Modell](009-review-modell-in-der-app.md)
Bearbeiter: Claude
Status: geschlossen

## Question

Der Rahmen steht (bounded Operation nach Gesprächsabschluss + On-Demand-Reconciliation
in den Einstellungen, cron-fähig geschnitten). Wie lautet der genaue Kontrakt?

Zu klären:

1. **Was ist der Abschluss?** Welches bestehende Ereignis im Capture-Flow zählt als
   `conversation.finalized` — die Nutzerbestätigung des Prozessverständnisses, ein
   eigener „Abschließen"-Schritt, oder beides?
2. **Ergebnis-Kontrakt der Operation:** `noop` / `apply` (bzw. Proposal in die
   Review-Queue) / `review_required` / `unresolved_process_identity` — welche Ausgänge
   braucht der Prototyp wirklich, und wie werden sie dem Nutzer angezeigt?
3. **Idempotenz und Nebenläufigkeit:** stabile Event-ID je Abschluss, `baseRevision`
   im Proposal, Verhalten bei erneutem Auslösen — was genau garantiert „gleiches Event +
   gleiche Quelle = keine zweite Mutation"?
4. **Reconciliation-Semantik:** Was tut der Einstellungen-Auslöser genau — Re-Render
   aller Dateien + Drift-/Link-/Waisen-Check + liegengebliebene Abschlüsse nachholen,
   aber keine semantische Neuinterpretation? Wie wird das Ergebnis berichtet?
5. **AGENTS.md-Delta:** Formulierung der neuen Ausnahme analog zum
   Opportunity-Discovery-Job (genau eine bounded Doku-Operation je Abschluss bzw. je
   manuellem Auslöser, keine Session-Resumes, keine Loops).
6. **Cron-Fähigkeit:** Welcher Schnitt macht das spätere Upgrade trivial (Operation als
   reine Funktion „Stand X → Ergebnis", Auslöser austauschbar)?

## Resolution

Wichtigste Konsequenz der übrigen Entscheidungen: **die Doku-Operation ist in v1
vollständig deterministisch — kein Claude-Aufruf.** Ohne Konsolidierung (1:1,
[007](007-datenmodell-quelle-der-wahrheit.md)) und ohne Claim-Ledger ist die Operation
reines Rendern + Committen. AGENTS.md braucht damit **keine neue KI-Ausnahme**, nur die
Klarstellung, dass die Korpus-Pflege eine deterministische Folgeoperation der
Bestätigung ist.

1. **Abschluss-Ereignis:** die Nutzerbestätigung. Hook im Confirm-Handler
   (`apps/server/src/routes/chat-captures.ts:183`, direkt neben dem bestehenden
   Opportunity-Auto-Start) und gespiegelt im Formular-Pfad
   (`routes/process-captures.ts:395`). Kein eigener „Abschließen"-Schritt.
2. **Ausführungsform:** neuer Operationsname `documentation-sync` in
   `processOperationNameSchema`, eingereiht über den bestehenden
   `process-operation-manager` (eine Operation je Prozess, global serialisiert,
   SSE-Status im vorhandenen `ai-operation-queue`-Panel). Ergebnis-Events über
   `publishProcessChanged`; Verlauf via `history.jsonl`-Audit-Event.
3. **Ergebnis-Kontrakt:** `updated` (Commit erzeugt) · `noop` (Quellrevision bereits
   veröffentlicht bzw. Render byte-identisch) · `error` (Historie-Eintrag + im Panel
   sichtbar, Nachholung durch Reconciliation). `review_required` und
   `unresolved_process_identity` entfallen (optimistic approval, Name = Identität).
4. **Idempotenz:** `quell_revision` (Hash) im Frontmatter ist der Abgleich — gleiche
   Revision oder identischer Render ⇒ kein Commit. Wiederholtes Auslösen ist damit
   gefahrlos; Nebenläufigkeit regelt die bestehende globale Serialisierung der
   Operationswarteschlange (kein `baseRevision`-Protokoll nötig).
5. **Reconciliation (Einstellungen-Button, `POST /api/corpus/reconcile`):** rendert
   alle bestätigten Prozesse neu, verschiebt/entfernt Waisen (Datei ohne aktive
   Quelle, z. B. nach Papierkorb-Löschung), prüft Katalog- und Linkkonsistenz — **ein**
   Sammel-Commit „Reconciliation", Ergebnisbericht in der UI (n aktualisiert, n
   Waisen, n Fehler nachgeholt). Keine semantische Neuinterpretation.
6. **Cron-Fähigkeit:** beide Auslöser rufen dieselbe reine Funktion
   (`syncProcess(id)` bzw. `reconcileCorpus()`); ein späterer Zeitplan ruft
   `reconcileCorpus()` unverändert auf.
7. **AGENTS.md-Delta (in der Spec ausgewiesen, nicht hier angewendet):** Korpus ist
   abgeleitetes Read Model und wird nie von Hand editiert; `documentation-sync` und
   Reconciliation sind deterministische bounded Operationen ohne Claude-Session;
   Planning-Source-Eintrag für die neue Spec.
