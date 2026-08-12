# Implementierungsplan — Lebende Prozessdokumentation

## Status, Ziel und Produktgrenze

Status: entschieden, bereit zur Umsetzung. Grundlage sind die Wayfinder-Karte
[Lebende Prozessdokumentation](./wayfinder/map-lebende-prozessdoku.md) mit ihren
geschlossenen Tickets 007–012 und der externe Research-Report
[LEBENDE-PROZESSDOKU-SOL-REPORT.md](./research/LEBENDE-PROZESSDOKU-SOL-REPORT.md).
Dieses Dokument ist die verbindliche Spezifikation des Moduls.

Ziel ist eine autonome Dokumentationsschicht hinter der bestehenden Prozessaufnahme:
Nach jeder fachlichen Bestätigung eines Prozesses erzeugt und pflegt die Anwendung
selbstständig ein git-versioniertes Markdown-Korpus der Unternehmensprozesse und macht
es in einem read-only Ordner-Viewer mit Änderungsverlauf und Diff-Ansicht sichtbar.

Das Modul demonstriert die „agentic future": **optimistic approval**. Die Anwendung
handelt sofort und ohne Vorab-Freigabe; der Mensch überwacht über vollständige
Audit-Trails und kann jede Änderung mit einem Klick zurücknehmen.

Außerhalb der Produktgrenze bleiben: Konsolidierung mehrerer Aufnahmen zu einem
Unternehmensprozess, Claim-Ledger und Konfliktauflösungslogik, Vektor-/Graph-/
Wissensdatenbanken, echte GitHub-/Remote-PRs, Auto-Merge-Staffelung, Mehrbenutzer-
Rollenmodelle sowie jede manuelle Bearbeitung des Korpus.

## Leitprinzipien

1. **Das Korpus ist eine Materialized View.** Es wird ausschließlich deterministisch
   aus bestätigten Quellobjekten gerendert, nie von Hand editiert, und ist jederzeit
   vollständig regenerierbar. Quelle der Wahrheit bleibt das bestätigte
   `process-understanding.json` samt `cover.yaml` und Metadaten.
2. **Deterministisch statt KI.** Die Doku-Operation enthält in v1 keinen
   Claude-Aufruf. Rendern und Committen sind reiner TypeScript-Code; damit entsteht
   keine neue KI-Ausnahme in AGENTS.md.
3. **Optimistic approval.** Jede Änderung committet sofort auf den Hauptzweig des
   eingebetteten Korpus-Repos. Die Schranke ist der Audit-Trail plus ein
   First-Class-Revert (Gegen-Commit); Historie wird nie umgeschrieben.
4. **Der Prozessname ist die Identität.** Eine Aufnahme entspricht genau einem
   dokumentierten Prozess (1:1). Dubletten werden bei der Anlage verhindert, nicht
   nachträglich konsolidiert.

## Verbindlicher End-to-End-Flow

1. Ein Nutzer legt einen Prozess an. Die Anlage erzwingt einen normalisierten
   Namens-Duplikatcheck (409 bei Kollision) und zeigt während der Eingabe ähnliche
   bestehende Prozesse an, um Dubletten zu vermeiden.
2. Der Nutzer bestätigt das Prozessverständnis (Chat- oder Formular-Pfad). Direkt nach
   der Finalisierung reiht der Confirm-Handler — zusätzlich zum bestehenden
   Opportunity-Auto-Start — genau eine Operation `documentation-sync` für diesen
   Prozess in die globale Operationswarteschlange ein.
3. `documentation-sync` liest die bestätigten Quellobjekte, rendert die betroffene
   Prozessdatei, `index.md` und `katalog.json` deterministisch neu und committet
   ausschließlich tatsächlich geänderte Dateien als einen Commit mit vollständiger
   Attribution. Ergebnis: `updated`, `noop` oder `error`.
4. Der Ordner-Viewer („Prozessdokumentation") zeigt Baum, gerenderte Dateien,
   Änderungsverlauf in Fachsprache und Diffs zweier Stände. Jeder Verlaufseintrag
   bietet „Änderung zurücknehmen"; das erzeugt einen Gegen-Commit.
5. In den Einstellungen stößt „Dokumentation abgleichen" eine Reconciliation an:
   vollständiger Re-Render aller bestätigten Prozesse, Waisen- und Katalogprüfung,
   Nachholung fehlgeschlagener Syncs — als ein Sammel-Commit, mit Ergebnisbericht.
6. Wiederholtes Auslösen ist jederzeit gefahrlos: identische Quelle ⇒ identischer
   Render ⇒ kein Commit (`noop`).

## Datenmodell und Quelle der Wahrheit

- **Publikationsquelle** je Prozess: bestätigtes `process-understanding.json`
  (Schema v3), `cover.yaml` (`processName`, `department`) und Metadaten
  (`confirmedAt`, `confirmationQuality`) aus `workspace/process-captures/PROC-xxxx/`.
- **Kein neues Zwischenmodell.** Beobachtung, Provenienz (FactBase-Zustände
  `user_stated` … `unknown`), Evidenz, Wissenslücken und Konflikte existieren bereits
  im Verständnis; `history.jsonl`/`operations.jsonl` liefern den Entstehungs-Audit.
- **Leichtgewichtiges Konfliktmodell:** `conflicts` und `knowledgeGaps` werden in den
  Abschnitt „Offene Fragen und Widersprüche" projiziert. Eine Neu-Bestätigung ersetzt
  den veröffentlichten Stand; der Git-Diff macht die Änderung sichtbar und
  revertierbar.
- **Quellrevision:** SHA-256 über die kanonisch serialisierte Publikationsquelle
  (stabile Schlüsselreihenfolge). Sie steht als `quell_revision` im Frontmatter und im
  Katalog und ist die Idempotenz-Referenz.
- **Identität und Namensregeln:** Identität ist die PROC-ID, fachlicher Schlüssel der
  normalisierte Prozessname (Trim, Kleinschreibung, Whitespace-Faltung).
  `ProcessCaptureRepository.create` lehnt Kollisionen gegen aktive Aufnahmen ab.
  Ähnlichkeitsvorschlag bei der Anlage: deterministische Token-Überlappung über
  Katalog- und Aufnahmenamen, kein KI-Aufruf.
- **Naht für spätere Konsolidierung:** `katalog.json` führt je Dokument
  `quellProzessIds` als Liste (heute immer genau ein Eintrag).
- Das leere Legacy-`pdd.md` unter `workspace/processes/` wird ausgemustert und nicht
  befüllt.

## Korpus: Struktur und Format

Eingebettetes Git-Repo `workspace/docs/` (App-verwaltet; `workspace/` selbst bleibt
gitignored und unversioniert):

```text
workspace/docs/
├── index.md                              # generierter Gesamtindex, nach Fachbereich gruppiert
├── katalog.json                          # id, titel, slug, fachbereich, systeme,
│                                         # quellProzessIds[], quellRevision
└── prozesse/<fachbereich-slug>/<prozess-slug>.md
```

**Frontmatter** (minimal, keine volatilen Zeitstempel): `id`, `titel`, `fachbereich`,
`status: aktiv`, `bestaetigt_am`, `qualitaet` (`complete`/`with_gaps`),
`quell_revision`, `renderer_version`, `offene_punkte`.

**Feste deutsche Abschnittsfolge** je Prozessdatei: Zweck und Ergebnis · Auslöser ·
Geltungsbereich und Abgrenzung · Beteiligte und Rollen · Ablauf (Schritte 1–8 mit
Tätigkeit, Eingaben, Ausgaben) · Systeme · Informationsquellen und Dokumente ·
Kontrollen · Übergaben · Mengen und Zeiten · Bekannte Schwachstellen ·
Verbesserungsziele · Offene Fragen und Widersprüche · Quellen und Änderungshistorie
(Quell-Prozess, Bestätigungsdatum, Qualität, Provenienz-Zählwerte je
FactBase-Zustand). Leere optionale Abschnitte erhalten einheitlich
„_Keine Angaben erfasst._". Das Flussdiagramm (`flow`) wird in v1 nicht gerendert.

**Pfadregel:** Der Dateipfad leitet sich aus Fachbereichs- und Namens-Slug ab. Ändert
sich Name oder Fachbereich, verschiebt der nächste Render die Datei im selben Commit;
Auflösung läuft über `katalog.json`, nie über harte Pfade.

## Renderer: neues Paket `packages/corpus`

React- und Claude-frei gemäß Schichtenregel. Reine Funktionen:

- `renderProcess(source): { path, frontmatter, markdown }` — byte-identischer Output
  bei identischem Input, stabile Sortierung, kein LLM-Text, keine Zeitstempel jenseits
  der Quelldaten.
- `renderIndex(catalog): string` und `buildCatalog(sources): Katalog`.
- Invarianten (als Tests): Re-Render erzeugt keinen Diff; genau eine Datei je
  bestätigter Aufnahme; alle internen Links auflösbar; `quell_revision` entspricht der
  Quelle; `renderer_version`-Erhöhung ist der einzige legitime Grund für einen Render-
  Diff ohne Quelländerung.

## Git-Backend

Dünner eigener Wrapper (~100–150 Zeilen) um System-Git via `Bun.spawn` — **nicht** die
Bun Shell (bestätigte Hänger bei `git show`, oven-sh/bun #25652/#26580), keine
isomorphic-git-Dependency (kein Diff-API, Bun-Kompatibilität ungeklärt; Details im
[Research-Ticket](./wayfinder/tickets/008-git-backend-unter-bun.md)).

- `ensureRepo()` beim Serverstart: `git init -b main workspace/docs`, falls `.git`
  fehlt.
- Jede Invokation mit `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`,
  `-c user.name/user.email`, `-c commit.gpgsign=false`; Commit-Daten optional aus dem
  Quell-Zeitstempel für Reproduzierbarkeit.
- Ein Commit je Sync (`git add -- <dateien>` nur für geänderte Dateien), ein
  Sammel-Commit je Reconciliation, ein Gegen-Commit je Revert (`git revert`-Semantik).
- Commit-Message maschinell aus Vorlage: erste Zeile Fachsprache
  („Dokumentation aktualisiert: <Prozessname>"), Trailer-Zeilen mit `Anlass:`
  (`bestaetigung` | `reconciliation` | `ruecknahme`), `Prozess: PROC-xxxx`,
  `Quell-Revision: <hash>` — daraus speist sich der Änderungsverlauf der UI ohne
  eigene Metadaten-Datei.
- Lesen über NUL-separierte Plumbing-Formate: `git ls-tree -z -l`,
  `git show <rev>:<pfad>`, `git log -z --pretty=format:… --name-status [--follow]`,
  `git diff --no-color`.
- Rev-/Pfad-Parameter strikt validieren (SHA/`HEAD`-Allowlist per Regex,
  Pfad-Normalisierung, immer `--`-Trenner) — verhindert Argument-Injection.

## Operationen

**`documentation-sync`** (neuer Name in `processOperationNameSchema`, eingereiht über
den bestehenden `process-operation-manager`, sichtbar im vorhandenen
Operations-Panel):

- Auslöser: Chat-Confirm-Handler (`apps/server/src/routes/chat-captures.ts`, neben dem
  Opportunity-Auto-Start) und Formular-Confirm (`routes/process-captures.ts`).
- Ablauf: Quellobjekte lesen → `quell_revision` berechnen → rendern → nur bei
  Abweichung committen → `history.jsonl`-Audit-Event (`documentation-synced` mit
  Ergebnis und Commit-Referenz) → `publishProcessChanged`.
- Ergebnis-Kontrakt: `updated` | `noop` | `error`. Fehler blockieren die Bestätigung
  nie (analog `opportunity-auto-start-failed`); Nachholung durch Reconciliation.

**Reconciliation** (`POST /api/corpus/reconcile`, Button „Dokumentation abgleichen" in
den Einstellungen): rendert alle bestätigten Prozesse, entfernt Waisen (Quelle
gelöscht/im Papierkorb), stellt Katalog- und Indexkonsistenz her — ein Sammel-Commit,
Antwort `{ aktualisiert, entfernt, unveraendert, fehler }` für den UI-Bericht. Läuft
als globale Operation über dieselbe Warteschlange. Keine semantische
Neuinterpretation.

**Revert** (`POST /api/corpus/revert/:commit`): erzeugt den Gegen-Commit und
protokolliert ihn im Verlauf; die einzige Schreiboperation, die aus dem Viewer
erreichbar ist.

**Cron-Fähigkeit:** beide Auslöser rufen reine Funktionen (`syncProcess(id)`,
`reconcileCorpus()`); ein späterer Zeitplan ruft `reconcileCorpus()` unverändert auf.

## Server-API

Neues Routenmodul `apps/server/src/routes/corpus.ts` (Hono-Factory-Muster), gemountet
hinter `requireSession`:

| Endpunkt                                   | Git-Operation                     | Antwort                                                                |
| ------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------- |
| `GET /api/corpus/tree?rev=&path=`          | `ls-tree -z -l`                   | `{name, path, type, size}[]`                                           |
| `GET /api/corpus/file?rev=&path=`          | `show rev:path`                   | Markdown-/Textinhalt                                                   |
| `GET /api/corpus/log?limit=&skip=[&path=]` | `log -z --name-status [--follow]` | `{sha, autor, datum, anlass, prozessId, zusammenfassung, dateien[]}[]` |
| `GET /api/corpus/diff?from=&to=&path=`     | `diff --no-color`                 | roher Unified-Diff-Text                                                |
| `POST /api/corpus/reconcile`               | Render + Sammel-Commit            | Reconciliation-Bericht                                                 |
| `POST /api/corpus/revert/:commit`          | `revert`                          | neuer Verlaufseintrag                                                  |

Zusätzlich an der Prozessanlage: `GET /api/processes/similar?name=` (deterministische
Namensähnlichkeit) und der 409-Duplikatcheck in `POST /api/processes`
(Fehlercode `duplicate_process_name`, deutsche Meldung).

## Web-UI

- **Route „Prozessdokumentation"** in der Hauptnavigation. Zweispaltig: Dateibaum
  links, gerenderte Markdown-Ansicht rechts. Read-only ausnahmslos.
- **Änderungsverlauf** je Datei und global, ohne Git-Vokabular: Datum, Anlass in
  Fachsprache, Verweis auf den Quell-Prozess; keine Hashes/Branches in der Oberfläche.
- **Diff-Ansicht** zweier Stände auf dem Markdown-Quelltext via `react-diff-view`
  (Server liefert rohen Diff-Text; `parseDiff` im Client); unified auf schmalen,
  split auf breiten Viewports.
- **„Änderung zurücknehmen"** an jedem Verlaufseintrag, mit Bestätigungsdialog und
  sichtbarem Ergebnis (neuer Verlaufseintrag „Rücknahme").
- **Einstellungen:** Abschnitt „Prozessdokumentation" mit dem Reconciliation-Button
  und dem letzten Bericht.
- **Prozessanlage:** Live-Hinweis „Ähnliche Prozesse" unter dem Namensfeld; Duplikate
  werden mit deutscher Fehlermeldung abgelehnt.
- Gestaltungsregeln der App gelten unverändert: Deutsch, kein Dark Mode,
  `components/ui/`-Grenze, semantische Typo-Skala, Ladevokabular (Skelett für Routen,
  Spinner nur in stehenden Flächen), kein rohes JSON und keine Modell-Terminologie.

## Deployment

`deploy/pi/install.zsh` erhält `git` in der apt-Paketliste (Einwort-Änderung); der
rsync-Release schließt `.git` des Anwendungs-Repos weiterhin aus, das eingebettete
Korpus-Repo liegt unter `workspace/` und ist davon unberührt.

## AGENTS.md-Delta (mit der Umsetzung anzuwenden)

1. Implementation rules, neue Punkte: „Das Dokumentationskorpus unter `workspace/docs/`
   ist ein abgeleitetes Read Model in einem app-verwalteten Git-Repo. Es wird
   ausschließlich deterministisch aus bestätigten Prozessverständnissen gerendert und
   nie von Hand oder durch KI-Text direkt bearbeitet." und „`documentation-sync` und
   Korpus-Reconciliation sind deterministische bounded Operationen ohne
   Claude-Session; sie fallen nicht unter die KI-Operationsregeln."
2. Planning source, neuer Eintrag: „Follow `docs/PLAN-LEBENDE-PROZESSDOKU.md` for the
   living process documentation corpus."

## Akzeptanzkriterien

1. Nach jeder Bestätigung (Chat und Formular) existiert spätestens nach Abarbeitung
   der Warteschlange genau eine aktuelle Korpus-Datei je bestätigtem Prozess; Index
   und Katalog sind konsistent.
2. Wiederholte Bestätigung ohne inhaltliche Änderung erzeugt keinen neuen Commit.
3. Jeder Commit trägt Anlass, Quell-Prozess und Quell-Revision; der Verlauf in der UI
   zeigt diese Attribution in Fachsprache.
4. „Änderung zurücknehmen" stellt den vorherigen Stand her, ohne Historie zu löschen.
5. Reconciliation nach manuellem Löschen einer Korpus-Datei oder eines Prozesses
   stellt den Soll-Zustand wieder her und berichtet die Zahlen.
6. `knowledgeGaps`/`conflicts` erscheinen im Abschnitt „Offene Fragen und
   Widersprüche"; `qualitaet: with_gaps` ist im Frontmatter und Index sichtbar.
7. Anlage mit bereits vergebenem Namen schlägt mit 409 und deutscher Meldung fehl;
   ähnliche Namen werden während der Eingabe angezeigt.
8. Viewer, Verlauf und Diff funktionieren bei Desktop- und Tablet-Breite; kein
   Git-Vokabular in der Oberfläche.
9. `./scripts/qa all` grün; Fehlerpfade (Git nicht verfügbar, Repo korrupt) blockieren
   weder Bestätigung noch App-Start und sind im Operations-Panel sichtbar.

## Teststrategie (lean, gemäß AGENTS.md)

- **Domain/Renderer:** Golden-File-Tests je Demo-Szenario; Idempotenz (Doppel-Render
  ⇒ kein Diff); Slug-/Umbenennungsregeln; Projektion von Gaps/Konflikten;
  Provenienz-Zählwerte.
- **Git-Wrapper:** Init, Commit, Log-/Tree-/Show-/Diff-Parsing gegen ein
  Temp-Repo; Injection-Abwehr (Pfad-/Rev-Validierung).
- **Kontrakt:** Sync-Ergebnisse `updated`/`noop`/`error`; Reconciliation-Bericht;
  Duplikatcheck und Ähnlichkeitssuche.
- **UI-Verifikation** manuell über Chrome DevTools MCP bei Desktop- und
  Tablet-Breite inklusive Konsole/Netzwerk, gemäß Verification-Regeln.

## Spätere Erweiterungen (bewusst nicht in v1)

Konsolidierung mehrerer Aufnahmen über `quellProzessIds`, deterministisches
Mermaid-Flussdiagramm, Bereichs-Indexe, zeitgesteuerte Reconciliation,
KI-Redaktionsschicht (Kurzbeschreibungen) mit eigener AGENTS.md-Ausnahme.
