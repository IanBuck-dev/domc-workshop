# Frontend-Ordner-Viewer mit Historie und Diffs

Karte: [Lebende Prozessdokumentation](../map-lebende-prozessdoku.md)
Typ: `wayfinder:prototype` (HITL)
Blockiert von: [008 Git-Backend](008-git-backend-unter-bun.md), [010 Korpusstruktur](010-korpusstruktur-und-renderer.md)
Bearbeiter: Claude
Status: geschlossen

## Question

Wie sieht der Speicher-Browser für das Korpus aus — und wie viel davon braucht der
Prototyp? Per Prototyp (klickbarer Entwurf oder ausgearbeitetes Mockup) klären:

1. **Grundgestalt:** Dateibaum + gerenderte Markdown-Ansicht? Wo wohnt das in der
   bestehenden Navigation (eigene Route „Prozessdokumentation")?
2. **Historie:** Commit-Liste je Datei und global — wie viel Git-Vokabular verträgt die
   Zielgruppe (Fachbereichsleitung, kein Entwickler)? Vermutlich „Änderungsverlauf" mit
   Datum, Anlass, Gespräch statt Hashes und Branches.
3. **Diff-Ansicht:** Vergleich zweier Stände einer Datei — nebeneinander oder inline,
   auf Markdown-Quelltext oder gerenderter Ansicht?
4. **Verknüpfung zur Provenienz:** Von einem Abschnitt zur Quelle springen (welches
   Gespräch, welcher Abschluss)? Oder bleibt das im Review-Flow?
5. **Abgrenzung:** Der Viewer ist read-only (Korpus wird nie von Hand editiert —
   Materialized-View-Regel). Gilt das ausnahmslos?

Deutsche UI, kein Dark Mode, `components/ui/`-Grenze und semantische Typo-Skala gelten.
Das Ergebnis fließt als UI-Kapitel in die Spec; verlinkte Prototyp-Artefakte bleiben
Assets dieses Tickets.

## Resolution

Scope vom Nutzer entschieden (8. Aug 2026): **voller Read-only-Viewer in v1** — Baum,
gerenderte Dateien, Historie **und** Diff-Ansicht. Kein separater Prototyp-Durchlauf
nötig; die UX-Leitplanken sind entschieden, Feinschliff passiert in der Umsetzung am
lebenden Objekt:

1. **Grundgestalt:** eigene Route „Prozessdokumentation" in der Hauptnavigation.
   Zweispaltig: Dateibaum links, gerenderte Markdown-Ansicht rechts.
2. **Historie ohne Git-Vokabular.** „Änderungsverlauf" je Datei und global: Datum,
   Anlass in Fachsprache („Nach Abschluss des Gesprächs zu ‚Rechnungsprüfung'…"),
   Verweis auf den Quell-Prozess. Keine Hashes, Branches oder Commit-Begriffe in der
   Oberfläche; technische Details bleiben in der API.
3. **Diff-Ansicht:** Vergleich zweier Stände einer Datei auf dem Markdown-Quelltext,
   gerendert mit `react-diff-view` (siehe [008](008-git-backend-unter-bun.md)) —
   unified auf schmalen, split auf breiten Viewports. Einstieg über den
   Änderungsverlauf („Was hat sich geändert?").
4. **Optimistic-Approval-Anbindung:** jeder Verlaufseintrag zeigt die Attribution und
   bietet „Änderung zurücknehmen" (Gegen-Commit, siehe
   [009](009-review-modell-in-der-app.md)) — das ist die einzige Schreiboperation, die
   der Viewer auslöst.
5. **Read-only ausnahmslos.** Das Korpus wird nie von Hand editiert
   (Materialized-View-Regel); Korrekturen laufen über den Quell-Prozess.
6. Gestaltungsregeln der App gelten: Deutsch, kein Dark Mode, `components/ui/`-Grenze,
   semantische Typo-Skala, Ladezustände nach dem Ladevokabular der
   [Ladezustände-Karte](../map-loading-states.md).
