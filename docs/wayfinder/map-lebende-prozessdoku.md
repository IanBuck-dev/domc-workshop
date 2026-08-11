# Map: Lebende Prozessdokumentation

`wayfinder:map` — Tickets liegen als Kindtickets in `docs/wayfinder/tickets/` (ab 007).

Dieser Tracker ist lokales Markdown (kein Tracker konfiguriert, also der Standard).
Blockierung gibt es hier nicht nativ, deshalb die Konvention `Blockiert von:` im
Ticketkopf. Die Frontier — das, was jetzt genommen werden kann — sind alle offenen,
unblockierten, nicht beanspruchten Tickets. `Bearbeiter:` im Ticketkopf ist der Anspruch:
ein offenes Ticket ohne Bearbeiter ist frei.

**Status: am Ziel.** Alle sieben Tickets sind geschlossen, die Frontier ist leer, der
Nebel gelichtet. Die Spec liegt als
[`docs/PLAN-LEBENDE-PROZESSDOKU.md`](../PLAN-LEBENDE-PROZESSDOKU.md) vor und ist der
Startpunkt der Umsetzung.

## Destination

Eine entschiedene, implementierungsreife Spec in `docs/plans/` für die autonome
Doku-Schicht: aus abgeschlossenen Discovery-Gesprächen entsteht ein git-versioniertes
Markdown-Korpus der Unternehmensprozesse im `workspace/`, gepflegt über bounded
Operationen mit In-App-Review, einsehbar über einen Frontend-Ordner-Viewer mit Historie
und Diffs. **Diese Karte plant nur** — die Umsetzung ist ein eigener Folgeauftrag auf
Basis der Spec.

## Notes

- **Grundlage:** [Sol-Pro-Research-Report](../research/LEBENDE-PROZESSDOKU-SOL-REPORT.md)
  (Stand der Praxis 2025/2026). Kernempfehlungen: Evidenz / kanonisches Objekt / Markdown
  strikt trennen; Markdown als disposable Materialized View, deterministisch aus dem
  kanonischen Zod-Objekt gerendert; Agent liefert typisierte Proposals, kein direktes
  Markdown; Widersprüche als konkurrierende Claims erhalten, keine autonome semantische
  Konfliktentscheidung. Der Report ist Empfehlung, nicht Beschluss — was für diesen
  Prototyp gilt, entscheiden die Tickets.
- **Leitidee (Nutzer, 8. Aug 2026):** Das Modul soll die „agentic future" zeigen —
  **optimistic approval** statt Vorab-Freigabe: der Agent handelt sofort, der Mensch
  überwacht über sichtbare Audit-Trails und kann jede Änderung leicht zurücknehmen.
  Jede autonome Änderung ist vollständig attribuierbar (Anlass, Gespräch, Provenienz).
- **Beim Charten bereits vom Nutzer entschieden** (Rahmen, nicht erneut verhandeln):
  - **Trigger:** genau eine bounded Doku-Operation nach explizitem Gesprächsabschluss,
    plus ein On-Demand-Reconciliation-Auslöser in den Einstellungen — so geschnitten,
    dass ein späteres Cron-Upgrade trivial ist. Kein dauerlaufender Worker im Prototyp.
  - **Git als Backing Store** des Korpus. `workspace/` ist gitignored, also braucht das
    Korpus ein eigenes, von der App verwaltetes eingebettetes Repo.
  - **Frontend-Ordner-Viewer** für das Korpus mit Historie und Diffs, on the fly aus Git
    über die Server-API (kein nativer Dateizugriff im Browser). Lib vs. Eigenbau ist zu
    recherchieren.
- Domäne/Repo: TypeScript strict, Bun, Zod; Provenienz-Zustände `user_stated` …
  `unknown`; deutschsprachige Oberfläche für Fachbereichsleitung; AGENTS.md-Regeln
  (bounded Operationen, keine autonomen Loops) — die Spec muss die neue Trigger-Ausnahme
  in AGENTS.md nachziehen.
- Bestand: strukturierte Prozessobjekte in `workspace/processes/PROC-xxxx/` und
  `workspace/process-captures/PROC-xxxx/` (u. a. `process-understanding.json`,
  `history.jsonl`); `pdd.md` existiert dort, ist aber leer (Legacy-Platzhalter).
- Skills je nach Ticket: `/grilling`, `/domain-modeling`, `/research`, `/prototype`.

## Decisions so far

<!-- Index: eine Zeile je geschlossenem Ticket, Detail liegt im Ticket selbst -->

- [Git-Backend unter Bun](tickets/008-git-backend-unter-bun.md) — Shell-out zu System-Git via `Bun.spawn` (dünner Wrapper, NUL-separierte Plumbing-Formate); Diffs als roher `git diff`-Text, im Frontend mit `react-diff-view` gerendert; isomorphic-git verworfen (kein Diff-API, Bun-Kompatibilität ungeklärt); `git` muss in die Pi-apt-Paketliste.
- [Review-Modell in der App](tickets/009-review-modell-in-der-app.md) — optimistic approval: jede Änderung committet sofort, Schranke ist Audit-Trail + First-Class-Revert (Gegen-Commit); Konflikte werden sichtbar committet statt harmonisiert; Auflösung am Quell-Prozess, nie am Korpus.
- [Ordner-Viewer mit Historie](tickets/012-ordner-viewer-mit-historie.md) — voller Read-only-Viewer in v1: Baum + gerenderte Ansicht, „Änderungsverlauf" ohne Git-Vokabular, Diff via react-diff-view; einzige Schreibaktion ist „Änderung zurücknehmen".
- [Datenmodell und Quelle der Wahrheit](tickets/007-datenmodell-quelle-der-wahrheit.md) — kein neues Zwischenmodell: das bestätigte `process-understanding.json` ist Observation und Publikationsquelle zugleich; Capture bleibt 1:1 Prozess, der Prozessname ist die Identität (Duplikatcheck + Ähnlichkeitsvorschlag bei Anlage); kein Claim-Ledger, Konflikte leichtgewichtig aus `conflicts`/`knowledgeGaps`.
- [Korpusstruktur und Renderer](tickets/010-korpusstruktur-und-renderer.md) — `workspace/docs/` mit `index.md`, `katalog.json`, `prozesse/<fachbereich>/<slug>.md`; minimales Frontmatter mit `quell_revision`-Hash; feste deutsche Abschnittsfolge aus den v3-Feldern; deterministischer Renderer in neuem Paket `packages/corpus`; Flow-Diagramm erst später.
- [Trigger und Operationskontrakt](tickets/011-trigger-und-operationskontrakt.md) — Doku-Operation ist in v1 vollständig deterministisch (kein Claude-Aufruf, keine neue KI-Ausnahme in AGENTS.md): `documentation-sync` über die bestehende Operationswarteschlange nach jeder Bestätigung, Ergebnis `updated`/`noop`/`error`, Idempotenz über `quell_revision`; Reconciliation als Sammel-Commit über `POST /api/corpus/reconcile`, cron-fähig geschnitten.
- [Spec zusammenführen und schreiben](tickets/013-spec-schreiben.md) — `docs/PLAN-LEBENDE-PROZESSDOKU.md` geschrieben (am `docs/`-Root, konsistent mit den übrigen Plänen), inkl. AGENTS.md-Delta als Änderungsvorschlag, neun Akzeptanzkriterien und leaner Teststrategie. **Damit ist die Karte am Ziel.**

## Not yet specified

_Leer — der Nebel ist gelichtet, alle Fragen sind entschieden._

Die drei zuvor hier verzeichneten Punkte sind beantwortet: **Prozessidentität** über
den Namen (Duplikatcheck + Ähnlichkeitsvorschlag, keine Konsolidierungsinfrastruktur —
siehe Datenmodell-Ticket); **Konflikt-Detailtiefe** leichtgewichtig aus den bestehenden
Feldern (Datenmodell- und Review-Ticket); der **Cron-Upgradepfad** ist im
Operationskontrakt festgehalten (reine Funktionen, Auslöser austauschbar).

## Out of scope

- **Vektor-, Graph- oder Wissensdatenbank-Infrastruktur** — der Nutzer will bewusst
  leichtgewichtig bleiben; der Report zeigt, dass Katalog + Dateien reichen.
- **Echte GitHub-/Remote-PRs und Auto-Merge-Staffelung nach Risikoscore** — Report
  Phase 2/3; Review passiert in der App, das Git-Repo bleibt lokal und eingebettet.
- **Autonome semantische Konfliktentscheidung** — der Report belegt, dass aktuelle
  Systeme daran scheitern; Widersprüche gehen immer an einen Menschen.
- **Mehrbenutzer-Rollen und Rechte fürs Review** — der Prototyp hat einen lokalen
  Demo-Login, kein Rollenmodell.
