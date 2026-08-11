# Git-Backend unter Bun für das eingebettete Korpus-Repo

Karte: [Lebende Prozessdokumentation](../map-lebende-prozessdoku.md)
Typ: `wayfinder:research` (AFK)
Blockiert von: —
Bearbeiter: Research-Subagent
Status: geschlossen

## Question

Wie verwaltet der Bun-Server ein eingebettetes Git-Repo im gitignorierten `workspace/`
(z. B. `workspace/docs/.git`) — Lib oder Eigenbau, und mit welcher API-Fläche für den
Frontend-Ordner-Viewer?

Benötigte Operationen (alles serverseitig, on the fly, kein nativer Dateizugriff im
Browser):

- Repo initialisieren, falls nicht vorhanden; Commits mit Autor/Message erzeugen
  (Autor = App bzw. bestätigender Nutzer).
- Verzeichnisbaum und Dateiinhalt zu einem beliebigen Commit lesen.
- Historie je Datei und global (Commit-Liste mit Message, Zeit, berührte Dateien).
- Diff zwischen zwei Revisionen einer Datei (für die Diff-Ansicht im Viewer) —
  strukturiert genug, um im Frontend hübsch gerendert zu werden.

Zu vergleichen (mit Belegen: Bun-Kompatibilität, Wartungszustand, Lizenz, Größe):

1. **isomorphic-git** — pure JS, kein System-Git nötig; wie gut läuft es unter Bun,
   kann es Diffs, wie ist die Performance bei kleinen Repos?
2. **simple-git** (Wrapper um System-Git) oder direktes Shell-out via `Bun.spawn` —
   auf macOS/Linux ist Git vorhanden; wie robust ist das Parsen von `git log`/`git diff`
   und gibt es fertige Parser?
3. **Eigenbau ohne Git** (z. B. Snapshot-Ordner + jsdiff) — nur falls Git
   unverhältnismäßig ist; der Nutzer hat Git als Backing Store gesetzt, also nur als
   Gegenprobe.

Zusatzfragen: Wie erzeugt man deterministische, saubere Commits (ein Commit je
angewendetem Proposal)? Gibt es fertige Diff-Renderer fürs Frontend (z. B. Bibliotheken,
die git-Diffs als strukturierte Hunks liefern), die zu React + Tailwind passen?

Ergebnis: Empfehlung mit Begründung und die konkrete API-Fläche
(Server-Endpunkte → Git-Operationen), als Grundlage für das Viewer-Ticket und die Spec.

## Resolution

**Empfehlung: Direktes Shell-out zu System-Git via `Bun.spawn` (dünner eigener
Wrapper, ~100–150 Zeilen), Diffs als roher `git diff`-Output an das Frontend, dort mit
`react-diff-view` geparst und gerendert.** simple-git ist die akzeptable
Komfort-Alternative, isomorphic-git ist es nicht.

### Vergleich

**1. isomorphic-git** — MIT, aktuell v1.40.8, aktiv gepflegt (Release August 2026,
inzwischen von jcubic publiziert; Quelle: [npm-Registry](https://registry.npmjs.org/isomorphic-git/latest),
[Releases](https://github.com/isomorphic-git/isomorphic-git/releases)). Pure JS, kein
System-Git nötig — aber ~4,9 MB unpacked plus 11 Dependencies. Entscheidende Lücken:

- **Kein Diff-API.** Diffs zwischen Commits muss man selbst bauen: `git.walk()` mit zwei
  `TREE({ ref })`-Walkern, OID-Vergleich je Datei, Textdiff dann per jsdiff — d. h.
  Eigenbau der Kernanforderung ([walk-Doku](https://isomorphic-git.org/docs/en/walk),
  [Issue #732](https://github.com/isomorphic-git/isomorphic-git/issues/732)).
- **Bun-Kompatibilität ungeklärt:** offenes, unbeantwortetes Issue, dass `git.clone()`
  unter Bun die Ausführung einfach stoppt
  ([Issue #1966](https://github.com/isomorphic-git/isomorphic-git/issues/1966), Nov 2024,
  unresolved). Bun ist kein getestetes Target des Projekts.
- Per-Datei-Historie existiert (`git.log({ filepath, follow })`,
  [log-Doku](https://isomorphic-git.org/docs/en/log)), läuft aber als JS-Commit-Walk —
  für unser kleines Korpus tolerabel, aber ohne Vorteil gegenüber System-Git.

**2. System-Git via Shell-out** — Git ist auf macOS (Xcode CLT) und Linux-Servern
Standard; jede benötigte Operation (Baum, Blob, Log, Diff) ist ein battle-tested
Plumbing-Kommando. Robustes Parsen ist gelöst, wenn man maschinenlesbare Formate nutzt:
`git log -z --pretty=format:%H%x00%an%x00%aI%x00%s --name-status` (NUL-separiert, kein
Escaping-Problem), `git ls-tree -z -l`, `git show <rev>:<pfad>`. Für den Diff liefert
`git diff --no-color` das Unified-Format, das fertige Parser strukturiert zerlegen
(`gitdiff-parser` via react-diff-view, alternativ
[`parse-git-diff`](https://www.npmjs.com/package/parse-git-diff)).

- **[simple-git](https://registry.npmjs.org/simple-git/latest)**: MIT, v3.36.0, ~928 KB,
  5 Dependencies, sehr aktiv gepflegt, >11 Mio. Downloads/Woche (Snyk: „Key ecosystem
  project“, [snyk.io](https://security.snyk.io/package/npm/simple-git)). Nutzt
  `node:child_process`, das Bun gut abdeckt. Mehrwert gegenüber `Bun.spawn` ist für
  unsere vier Read-Operationen gering, da wir ohnehin eigene Formate parsen.
- **Bun-Fallstrick:** Nicht die Bun Shell (`$\`git …\``) verwenden — dort gibt es
bestätigte, intermittierende Hänger mit `git show`bei größeren Outputs; plain`spawn`/`spawnSync`aus`node:child_process`bzw.`Bun.spawn` mit gepufferten Streams
  funktioniert ([oven-sh/bun #25652](https://github.com/oven-sh/bun/issues/25652),
  [#26580](https://github.com/oven-sh/bun/issues/26580)).
- **Deployment:** `deploy/pi/install.zsh` installiert derzeit **kein** `git`
  (apt-Zeile: bubblewrap, socat, ripgrep, …) und der rsync-Release schließt `.git` aus —
  das Spec-/Implementierungsticket muss `git` in die apt-Paketliste aufnehmen
  (Einwort-Änderung, siehe `docs/PI-DEPLOYMENT.md`).

**3. Eigenbau ohne Git (Snapshot-Ordner + jsdiff)** — verworfen. Der Nutzer hat Git als
Backing Store gesetzt; ein Snapshot-Modell müsste Historie, berührte Dateien und
Revisionsadressierung selbst nachbauen und wäre nicht inspizierbar
(`git log` im Terminal entfällt). Kein Aufwandsvorteil, da Shell-out trivial ist.

### Saubere, deterministische Commits

Ein Commit je angewendetem Proposal: exakt die geschriebenen Dateien stagen
(`git add -- <dateien>`), dann `git commit --author "Name <mail>" -m "<message>"`.
Damit Host-Konfiguration das eingebettete Repo nie kontaminiert, jede Invokation mit
`GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null` und expliziten
`-c user.name/user.email -c commit.gpgsign=false` fahren; Repo-Init mit
`git init -b main workspace/docs`. Wer volle Determinismus-Reproduzierbarkeit will,
setzt zusätzlich `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` aus dem Proposal-Zeitstempel.
Rev-/Pfad-Parameter aus dem Frontend strikt validieren (SHA/`HEAD`-Allowlist per Regex,
Pfad-Normalisierung, immer `--`-Trenner vor Pfaden) — verhindert Argument-Injection.

### Frontend-Diff-Rendering

- **Empfohlen: [react-diff-view](https://github.com/otakustay/react-diff-view)** (MIT,
  aktiv gepflegt): parst rohen `git diff`-Text via `parseDiff` (gitdiff-parser) in
  strukturierte Hunks und rendert Unified- **und** Split-View als unstyled/leicht
  stylebare React-Komponenten — passt zu React + Tailwind. Server liefert nur den rohen
  Diff-Text.
- Alternativen: [@git-diff-view/react](https://www.npmjs.com/package/@git-diff-view/react)
  (neuer, GitHub-ähnliches Rendering out of the box),
  [react-diff-viewer-continued](https://github.com/Aeolun/react-diff-viewer-continued)
  (diffed clientseitig zwei Texte via jsdiff — bräuchte zwei File-Fetches statt eines
  Diffs, dafür gar kein Diff-Endpoint), [diff2html](https://npm-compare.com/diff2html,react-diff-view,react-diff-viewer)
  (framework-agnostisch, generiert HTML-Strings — schlechterer Fit für React).

### API-Fläche (Server-Endpunkte → Git-Operationen)

Alle Endpunkte read-only unter z. B. `/api/corpus/…`; `rev` default `HEAD`. Commits
entstehen nie über diese API, sondern intern beim Anwenden eines Proposals.

| Endpunkt                               | Git-Operation                                 | Antwort                                                              |
| -------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| `GET /api/corpus/tree?rev=&path=`      | `git ls-tree -z -l <rev> -- <path>`           | JSON-Einträge `{name, path, type: blob\|tree, size}`                 |
| `GET /api/corpus/file?rev=&path=`      | `git show <rev>:<path>`                       | Dateiinhalt (Markdown/Text)                                          |
| `GET /api/corpus/log?limit=&skip=`     | `git log -z --pretty=format:… --name-status`  | JSON-Commits `{sha, author, date, message, files: [{status, path}]}` |
| `GET /api/corpus/log?path=…`           | dito plus `--follow -- <path>`                | wie oben, gefiltert auf die Datei                                    |
| `GET /api/corpus/diff?from=&to=&path=` | `git diff --no-color <from> <to> [-- <path>]` | roher Unified-Diff-Text; Frontend parst mit `parseDiff`              |

Intern (kein Endpoint): `ensureRepo()` beim Serverstart (`git init` falls
`workspace/docs/.git` fehlt) und `commitProposal(files, author, message)` wie oben.

### Fazit

Shell-out via `Bun.spawn` gewinnt in jeder Bewertungsdimension: null bzw. eine kleine
MIT-Dependency statt 4,9 MB, echte Diffs statt Eigenbau auf walk(), belegte statt
fraglicher Bun-Kompatibilität, und Plumbing-Formate machen das Parsen deterministisch.
Einzige Auflage: `git` in die Pi-Paketliste aufnehmen und die Bun Shell meiden.
