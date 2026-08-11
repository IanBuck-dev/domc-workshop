# Spec zusammenführen und schreiben

Karte: [Lebende Prozessdokumentation](../map-lebende-prozessdoku.md)
Typ: `wayfinder:task` (AFK)
Blockiert von: [007 Datenmodell](007-datenmodell-quelle-der-wahrheit.md), [008 Git-Backend](008-git-backend-unter-bun.md), [009 Review-Modell](009-review-modell-in-der-app.md), [010 Korpusstruktur](010-korpusstruktur-und-renderer.md), [011 Trigger/Kontrakt](011-trigger-und-operationskontrakt.md), [012 Ordner-Viewer](012-ordner-viewer-mit-historie.md)
Bearbeiter: Claude
Status: geschlossen

## Question

Alle Entscheidungen der Karte zu einer implementierungsreifen Spec in `docs/plans/`
zusammenführen (Arbeitstitel `PLAN-LEBENDE-PROZESSDOKU.md`), im Stil der bestehenden
Plan-Dokumente: Domänenzustände, Datenmodell, Operationskontrakt, Korpusstruktur,
Git-Backend, Review-Flow, Viewer-UI, Akzeptanzkriterien, Teststrategie.

Dazu gehört das **AGENTS.md-Delta** (neue Trigger-Ausnahme, Planning-Source-Eintrag für
die neue Spec) als benannter Änderungsvorschlag — nicht selbst anwenden, sondern in der
Spec ausweisen. Das Schließen dieses Tickets ist das Ziel der Karte.

## Resolution

Die Spec ist geschrieben: [`docs/PLAN-LEBENDE-PROZESSDOKU.md`](../../PLAN-LEBENDE-PROZESSDOKU.md)
— am `docs/`-Root statt in `docs/plans/`, konsistent mit den übrigen `PLAN-*.md`, die
AGENTS.md als Planning Sources führt.

Sie führt alle Kartenentscheidungen zusammen (Leitprinzipien, End-to-End-Flow,
Datenmodell, Korpusstruktur, Renderer-Paket `packages/corpus`, Git-Wrapper via
`Bun.spawn`, Operationen `documentation-sync`/Reconciliation/Revert, API-Fläche,
UI, Deployment) und weist das **AGENTS.md-Delta als anzuwendenden Änderungsvorschlag
aus** (Korpus = abgeleitetes Read Model; deterministische bounded Operationen ohne
Claude-Session; neuer Planning-Source-Eintrag) — angewendet wird es erst mit der
Umsetzung. Neun Akzeptanzkriterien und eine leane Teststrategie machen die Spec
implementierungsreif.
