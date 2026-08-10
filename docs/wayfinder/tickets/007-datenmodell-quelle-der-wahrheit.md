# Datenmodell und Quelle der Wahrheit

Karte: [Lebende Prozessdokumentation](../map-lebende-prozessdoku.md)
Typ: `wayfinder:grilling` (HITL)
Blockiert von: —
Bearbeiter: Claude
Status: geschlossen

## Question

Wie bildet sich das Report-Modell **Gespräch → ProcessObservation → Claims →
CanonicalProcess → Markdown** auf den Bestand dieses Prototyps ab — und was ist die
Publikationsquelle des Korpus?

Zu klären:

1. **Was ist die Beobachtung?** Der Discovery-Chat erzeugt bereits ein Zod-validiertes,
   vom Nutzer bestätigtes `process-understanding.json` je Capture. Ist das bestätigte
   Process Understanding die „Observation" des Reports — oder braucht es ein separates,
   append-only Beobachtungsobjekt darüber hinaus?
2. **Braucht der Prototyp ein separates kanonisches Objekt?** Der Report trennt
   Beobachtung (je Gespräch) von kanonischem Prozess (unternehmensweit konsolidiert).
   Solange jede Capture 1:1 ein Prozess ist, fallen beide zusammen. Wird die Trennung
   jetzt eingezogen (Spec-seitig vorbereitet) oder bewusst vertagt?
3. **Wie schlank darf das Claim-Modell sein?** Der Report schlägt atomare Claims mit
   `semanticPath`, `perspective`, `scope`, `status` vor. Der Bestand hat bereits
   Provenienz-Zustände (`user_stated`, `file_evidence`, `ai_structured`, `ai_inferred`,
   `user_confirmed`, `unknown`) plus `history.jsonl`. Was davon deckt Claims schon ab,
   was fehlt wirklich (z. B. `contested`, Evidenzreferenzen auf Nachrichten)?
4. **Was rendert der Renderer?** Aus welchem Objekt entsteht das Markdown, und wo lebt
   dieses Objekt — im bestehenden PROC-Ordner oder im neuen Korpus-Repo?

Das Ergebnis dieses Tickets bestimmt Review-Modell, Korpusstruktur und
Operationskontrakt — es ist das Fundament der Karte.

## Resolution

Entschieden mit dem Nutzer (High-Level, 8. Aug 2026) und gegen den Codebestand
verifiziert. Kernentscheidung: **kein neues Zwischenmodell — das bestätigte
Prozessverständnis ist bereits alles, was der Report fordert.**

1. **Die „Observation" existiert schon.** Das bestätigte `process-understanding.json`
   (Schema v3, `packages/domain/src/process-understanding.ts:895`) ist ein
   Zod-validiertes, nutzerbestätigtes Objekt mit FactBase-Provenienz je Fakt und
   Schritt, `evidence`, `knowledgeGaps` und `conflicts`. Es braucht kein separates
   append-only Beobachtungsobjekt; `history.jsonl` und `operations.jsonl` liefern den
   Audit-Trail der Entstehung.
2. **Kein separates kanonisches Objekt — Capture bleibt 1:1 Prozess.** Publikationsquelle
   des Korpus ist das bestätigte Verständnis plus `cover.yaml` und Metadaten
   (`confirmedAt`, `confirmationQuality`). **Der Prozessname ist die Identität**
   (`cover.processName`): bei der Anlage wird ein normalisierter Namens-Duplikatcheck
   erzwungen (heute existiert keiner — `ProcessCaptureRepository.create` prüft nur die
   PROC-ID) und die Eingabeseite zeigt ähnliche bestehende Prozesse an, um Dubletten zu
   verhindern. Naht für später: der Korpus-Katalog führt je Doku-Datei eine Liste von
   Quell-PROC-IDs (heute immer genau eine) — eine Konsolidierungsschicht kann dort
   andocken, ohne Migration.
3. **Kein Claim-Ledger.** Leichtgewichtiges Konfliktmodell: die vorhandenen `conflicts`
   und `knowledgeGaps` des Verständnisses werden in den Doku-Abschnitt „Offene Fragen
   und Widersprüche" projiziert; die FactBase-Provenienz wird als kompakte
   Quellenzusammenfassung gerendert. Konflikte über Captures hinweg entstehen im
   1:1-Modell nicht; eine Neu-Bestätigung ersetzt den Stand, und der Git-Diff macht die
   Änderung sichtbar (Widerspruchserhalt via Historie statt Ledger).
4. **Renderer-Eingabe und -Ort:** deterministischer Renderer liest ausschließlich
   bestätigte Quellobjekte aus `workspace/process-captures/PROC-xxxx/` und schreibt in
   das eingebettete Korpus-Repo `workspace/docs/` (siehe
   [010](010-korpusstruktur-und-renderer.md)). Das leere Legacy-`pdd.md` unter
   `workspace/processes/` wird ausgemustert, nicht befüllt.
