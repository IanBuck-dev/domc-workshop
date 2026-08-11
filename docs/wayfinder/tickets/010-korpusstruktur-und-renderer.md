# Korpusstruktur und deterministischer Renderer

Karte: [Lebende Prozessdokumentation](../map-lebende-prozessdoku.md)
Typ: `wayfinder:grilling` (HITL)
Blockiert von: [007 Datenmodell](007-datenmodell-quelle-der-wahrheit.md)
Bearbeiter: Claude
Status: geschlossen

## Question

Wie ist das Markdown-Korpus geschnitten und wie entsteht es deterministisch aus den
strukturierten Objekten?

Zu klären:

1. **Dateischnitt:** eine Datei pro Unternehmensprozess (Report-Empfehlung) — und was
   heißt das, solange Capture ≈ Prozess? Ordnerstruktur nach Fachbereich
   (LifeCorp-Fachbereiche aus `demo-data/UNTERNEHMEN.md`)?
2. **Indexe und Katalog:** generierter Gesamtindex, Bereichsindexe, ein maschinell
   lesbarer `catalog.json` für die Prozessauflösung — welche davon braucht der Prototyp?
3. **Frontmatter:** welches Minimal-Set (ID, Titel, Status, Revision,
   `source_revision`, Review-Stand, offene Konflikte)? Keine volatilen Zeitstempel.
4. **Abschnittsstruktur:** feste deutsche Abschnittsfolge je Prozessdatei — welche
   Abschnitte, und wie verhält sich das zum bestehenden Process-Brief/PDD-Format?
   (`pdd.md` in `workspace/processes/` existiert, ist aber leer — ersetzen, füllen oder
   ausmustern?)
5. **Determinismus:** Renderer als reiner TypeScript-Code (byte-identischer Output bei
   identischem Input), LLM-Text nur als strukturierte Felder — welche Prüfungen sichern
   das (Re-Render ohne Diff, Linkvalidierung)?
6. **Querverweise:** stabile Prozess-IDs im Objekt, relative Links vom Renderer erzeugt
   — welches ID-Schema (bestehende PROC-xxxx vs. sprechende IDs wie
   `claims.fnol-intake`)?

## Resolution

1. **Layout des Korpus-Repos `workspace/docs/`** (eigenes Git-Repo, App-verwaltet):

   ```text
   workspace/docs/
   ├── index.md                          # generierter Gesamtindex, nach Fachbereich gruppiert
   ├── katalog.json                      # maschinenlesbar: id, titel, slug, fachbereich,
   │                                     # systeme, quellProzessIds[], quellRevision
   └── prozesse/<fachbereich-slug>/<prozess-slug>.md
   ```

   Ein Dokument je Prozess (1:1 zu PROC-xxxx, siehe
   [007](007-datenmodell-quelle-der-wahrheit.md)); Fachbereich aus `cover.department`.
   Keine Bereichs-Indexe in v1 — der Gesamtindex gruppiert. `katalog.json` speist auch
   den Ähnliche-Prozesse-Vorschlag bei der Anlage.

2. **Frontmatter (minimal, keine volatilen Zeitstempel):** `id` (PROC-xxxx), `titel`,
   `fachbereich`, `status: aktiv`, `bestaetigt_am`, `qualitaet`
   (`complete`/`with_gaps`), `quell_revision` (Hash über kanonisch serialisiertes
   Verständnis + Cover), `renderer_version`, `offene_punkte` (Zahl).
3. **Feste deutsche Abschnittsfolge**, projiziert aus den v3-Feldern: Zweck und
   Ergebnis (purpose, outcome) · Auslöser (trigger) · Geltungsbereich und Abgrenzung
   (boundaries) · Beteiligte und Rollen (participants) · Ablauf (steps 1–8 mit
   Tätigkeit, Eingaben, Ausgaben) · Systeme · Informationsquellen und Dokumente ·
   Kontrollen · Übergaben · Mengen und Zeiten · Bekannte Schwachstellen (painPoints) ·
   Verbesserungsziele · Offene Fragen und Widersprüche (knowledgeGaps + conflicts) ·
   Quellen und Änderungshistorie (Quell-Prozess, Bestätigungsdatum, Qualität,
   Provenienz-Zusammenfassung als Zählwerte je FactBase-Zustand). Leere optionale
   Abschnitte erscheinen mit dem einheitlichen Platzhalter „_Keine Angaben erfasst._".
   Das Flussdiagramm (`flow`) wird in v1 **nicht** gerendert — die App hat dafür das
   Prozessbild; als spätere Erweiterung notiert (deterministisches Mermaid).
4. **Determinismus:** Renderer als reiner TypeScript-Code in einem neuen Paket
   `packages/corpus` (React- und Claude-frei, gemäß Schichtenregel). Byte-identischer
   Output bei identischem Input, stabile Sortierung, kein LLM-Text. Invarianten-Tests:
   Re-Render erzeugt keinen Diff; jede bestätigte Aufnahme hat genau eine Datei; alle
   internen Links auflösbar; `quell_revision` stimmt mit der Quelle überein.
5. **IDs und Querverweise:** Doku-Identität ist die PROC-ID; der Dateipfad leitet sich
   aus dem Namens-Slug bei der ersten Veröffentlichung ab. Ändert sich Name oder
   Fachbereich, verschiebt der nächste Render die Datei im selben Commit (`git mv`-
   Semantik) — Links laufen über `katalog.json`-Auflösung, nicht über harte Pfade.
   Prozess-Querverweise gibt es in v1 nicht (kein Feld im Schema); die Struktur
   (Katalog + stabile IDs) trägt sie später.
