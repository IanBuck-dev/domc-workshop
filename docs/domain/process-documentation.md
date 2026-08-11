# Living process documentation

## Purpose

The confirmed process understandings, published as a readable German process manual that
maintains itself. Every confirmation writes a new revision; nobody edits the manual by
hand, and nobody has to remember to update it. A department lead can browse it, search it,
copy a process into an e-mail, print it as PDF, look at what changed between two
revisions, and undo a publication.

## How it works

### A derived read model, not a second source of truth

`workspace/docs/` is an **app-managed git repository** holding a materialised read model.
It is rendered **deterministically** from confirmed process understandings only. It is
never written by hand and never contains free AI text — the renderer
(`packages/corpus/src/index.ts`) is a pure function with no I/O and no model call.

Because of that, `documentation-sync` and corpus reconciliation are deterministic bounded
operations **without** a Claude session; the AI operation rules do not apply to them.

Git is an implementation detail. The UI speaks of _Änderungsverlauf_, _Fassung_, and
_Rücknahme_ — never of commits, branches, or reverts.

### Layout

```
workspace/docs/
  index.md                              ← generated overview, must start "# Prozessdokumentation"
  katalog.json                          ← machine catalogue: id, title, slug, department, systems, source revision
  prozesse/<department>/<process>.md
```

Paths are slugged German (`slug()` transliterates ä→ae, ö→oe, ü→ue, ß→ss). Two processes
that slug to the same path are disambiguated by appending `--proc-nnnn`.

### A document

YAML frontmatter (`corpusFrontmatterSchema`) carries `id`, `titel`, `fachbereich`,
`status`, `bestaetigt_am`, `qualitaet` (`complete` | `with_gaps`), `quell_revision` (a
SHA-256 over the canonicalised source), `renderer_version`, and `offene_punkte`. The
frontmatter is machine metadata and is **never** shown raw; the viewer surfaces only the
meaningful fields as badges.

The body has fixed German sections: Zweck und Ergebnis, Auslöser, Geltungsbereich und
Abgrenzung, Beteiligte und Rollen, Ablauf (numbered steps with Tätigkeit / Eingaben /
Ausgaben), Systeme, Informationsquellen und Dokumente, Kontrollen, Übergaben, Mengen und
Zeiten, Bekannte Schwachstellen, Verbesserungsziele, Offene Fragen und Widersprüche,
Quellen und Änderungshistorie. Empty sections render `_Keine Angaben erfasst._` rather
than disappearing, so a gap is visible instead of invisible.

`renderer_version` is validated as any positive integer on read so documents published by
an older renderer stay readable; new output always writes the current `rendererVersion`.

### Operations

| Operation           | Trigger                           | Effect                                                              |
| ------------------- | --------------------------------- | ------------------------------------------------------------------- |
| `syncProcess(id)`   | every confirmation, form and chat | renders one process and commits it                                  |
| `reconcileCorpus()` | Settings, manual                  | re-renders everything, catching up anything a failed enqueue missed |
| `revert(commit)`    | _Rücknahme_ in the viewer         | undoes one publication as a new revision                            |

All writes go through `withCorpusMutex`, so two operations can never interleave in the
repository. If a sync fails to enqueue, the confirmation still stands and the failure is
written to the process history — reconciliation is the catch-up path.

### API and viewer

`GET /api/corpus/tree`, `/file`, `/log`, `/diff`; `POST /api/corpus/reconcile`,
`/revert/:commit`. Path arguments are validated by `corpusPath`, revisions by
`validRevision` / `validCommit`.

The viewer at `/dokumentation` is read-only apart from the revert action:

- a collapsible document tree whose fold state persists in browser storage
  (`claims-ai.corpus-tree.collapsed.v1`);
- inline search over titles **and** full text, loading document bodies once on the first
  keystroke — no server-side search endpoint; hits are counted per document and marked in
  the open text with `<mark>`. The frontmatter is never searched;
- _Kopieren_, writing both `text/html` and `text/plain` so Word and Outlook keep headings
  and lists;
- _Als PDF exportieren_, which is `window.print()` against a print stylesheet in
  `apps/web/src/styles.css`;
- an _Änderungsverlauf_ tab with a side-by-side diff (`react-diff-view`) and the revert
  dialog.

Markdown is rendered by `react-markdown` with `skipHtml` and **without** `remark-gfm`.

## Where it lives

| Layer    | Path                                                                                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Renderer | `packages/corpus/src/index.ts` (pure)                                                                                                                                                                                                                                                |
| Storage  | `packages/storage/src/corpus-git.ts`, `workspace-repository.ts`                                                                                                                                                                                                                      |
| Server   | `apps/server/src/corpus-service.ts`, `routes/corpus.ts`                                                                                                                                                                                                                              |
| Web      | `apps/web/src/pages/documentation-page.tsx`; components `corpus-tree.tsx`, `corpus-document.tsx`, `corpus-history.tsx`, `corpus-diff.tsx`, `corpus-revert-dialog.tsx`; libs `corpus-types.ts`, `corpus-tree.ts`, `corpus-search.ts`, `corpus-export.ts`, `corpus-tree-preference.ts` |
| Seed     | `scripts/seed-documentation.ts` / `bun run seed:docs`, fixtures in `demo-data/dokumentation/`                                                                                                                                                                                        |
| Tests    | `tests/corpus.test.ts`, `corpus-ui.test.ts`, `documentation-seed.test.ts`                                                                                                                                                                                                            |

## Implementation status

**Implemented.** Deterministic rendering, the app-managed git repository with mutex,
sync on confirmation in both capture modes, manual reconciliation, revert, the catalogue
and index, and the full viewer (tree with persisted fold state, title + full-text search
with highlighting, rich-text copy, PDF export, diff, revert) are built and covered.

The demo seed produces eight processes across six departments including revisions and one
revert, driven through the productive code paths (`finalizeChatCapture`,
`correctUnderstanding`/`confirm`, `syncProcess`, `revert`) — nothing is written into
`workspace/docs` by hand.

Three divergences from the UI guardrails are known and recorded in
[`../BACKLOG.md`](../BACKLOG.md): `katalog.json` and the index appear as browsable
documents in the manager-facing tree; tree labels come from transliterated file paths
("It", "Stoerungsannahme im anwendersupport") rather than the document's own H1; and the
rendered document ends with a _Provenienz-Zählwerte_ section that prints the raw
provenance enum keys. Tables can never render, because `remark-gfm` is absent.

## Constraints

- The corpus is derived. Never edit it by hand, never let AI text into it directly.
- Rendering is deterministic and pure: same source, same bytes.
- No Git vocabulary, no raw frontmatter, and no JSON in the viewer.
- The viewer is read-only; _Rücknahme_ is the single write action.
- All repository writes go through the corpus mutex.

## Open items

See [`../BACKLOG.md`](../BACKLOG.md).
