# Demo data and tuning rounds

## Purpose

Two things depend on having a fixed, invented company to talk about: a workshop
demonstration that behaves the same way every time, and prompt tuning that compares one
change at a time.

Because the app **freezes prompts and response schemas per record** (see
[ai-runtime.md](ai-runtime.md)), a prompt change only affects newly created processes. A
tuning round therefore needs a freshly seeded process from identical source material —
otherwise two changes are being compared at once without anyone noticing.

## How it works

### LifeCorp Versicherung

`demo-data/UNTERNEHMEN.md` is the single source of the fiction: LifeCorp Versicherung
VVaG, Dortmund, ~1,800 employees, lines of business Kfz / Hausrat-Wohngebäude / Leben /
bAV, with a fixed invented system landscape and named personas. Its departments match the
seven configured in `defaults/process-capture-config.json`.

Every scenario document and every scripted answer uses **only** these names. Consistency
across the whole landscape is itself part of what a tuning round checks — if the assistant
invents a system name, that is a finding.

### Scenario layout

```
demo-data/szenarien/<slug>/
  szenario.json       cover sheet (department, participants, process name),
                      document list, optionally a `formular` block
  drehbuch.json       the persona's verbatim turn-by-turn answers
  DREHBUCH.md         persona, expectations per turn, failure signatures
  dokumente/          sources as Markdown/CSV/TXT; entries marked `pdf`
                      are rendered on seed or first fetch
  verstaendnis.json   optional confirmed understanding for `--stufe bestaetigt`
```

`drehbuch.json` holds the answers; `DREHBUCH.md` references them by turn number only, so
there are never two copies to drift apart.

### The three capture scenarios

| Slug | Department | The case it exercises |
| --- | --- | --- |
| `kfz-glasschaden` | Schaden | the clean case — clear flow, three complementary documents. Baseline: steps, roles, systems recognised, `documentCoverage: complete` |
| `beitragsanpassung` | Vertrag | the contradictory case — two documents disagree. Does the assistant notice and ask, or silently pick one? |
| `provisionsabrechnung` | Vertrieb | the document-free case — conversation only, no textual crutch |

### Running a tuning round

1. change a prompt under `defaults/prompts/`;
2. `bun run seed <slug>` (or `bun run seed --alle`);
3. open the process and play the script turn by turn using the in-app sidecar;
4. compare the result against the expectations in that scenario's `DREHBUCH.md`.

For opportunity discovery the chat need not be replayed:
`bun run seed kfz-glasschaden --stufe bestaetigt` creates the process directly in
`confirmed` state with a prepared understanding.

### The sidecar

`apps/web/src/components/demo-sidecar.tsx` is the in-app companion that serves the script:
it is stage-aware (`documents` during the upload gate, `chat` afterwards), can insert the
next answer, upload a scenario document, or fill the form and cover sheet. Its open state
and selected scenario persist in browser storage
(`claims-ai.demo-sidecar.open.v1`, `…slug.v1`).

### Seeding through the productive code paths

`scripts/seed-demo-process.ts` writes through the **repository layer**, not over HTTP —
`requireSession` sits in front of every `/api/*` route and no script ever touches the
credentials. It still goes through `ProcessCaptureRepository.saveUpload()`, so the same
magic-byte and OOXML checks apply: a demo document the server would reject fails here too.

If `workspace/process-captures/` is empty when `bun run dev` starts, all scenarios are
seeded once automatically. `DEMO_SEED=0` disables that.

`scripts/seed-documentation.ts` (`bun run seed:docs`) seeds the living documentation from
eight confirmed processes in `demo-data/dokumentation/`, replaying confirm → correct →
re-confirm → revert in chronological order so the archive shows exactly what the
application produces. Nothing is written into `workspace/docs/` by hand.

`bun run seed --list` / `bun run seed:docs --list` show what is available.

## Where it lives

| Layer | Path |
| --- | --- |
| Fixtures | `demo-data/UNTERNEHMEN.md`, `demo-data/szenarien/`, `demo-data/dokumentation/` |
| Server | `apps/server/src/demo-scenarios.ts`, `routes/demo.ts` (`GET /api/demo/szenarien`, `…/dateien/:zielname`) |
| Web | `apps/web/src/components/demo-sidecar.tsx` |
| Scripts | `scripts/seed-demo-process.ts` (`bun run seed`), `scripts/seed-documentation.ts` (`bun run seed:docs`), `scripts/documentation-fixtures.ts`, `scripts/reset-workspace.ts` |
| Tests | `tests/demo-data.test.ts`, `documentation-seed.test.ts` |

## Implementation status

**Implemented.** Three capture scenarios with scripts and documents, eight documentation
fixtures, both seed scripts, the auto-seed on an empty workspace, the stage-aware sidecar,
and the document-serving endpoint.

## Constraints

- Invented data only, LifeCorp Versicherung, domain `lifecorp.example`. Never real
  customer, contract, or claim data in `demo-data/`.
- System names and personas come from `demo-data/UNTERNEHMEN.md` and must stay consistent
  across all scenarios.
- Seeding goes through the productive code paths, never by hand-writing workspace files.
- No script reads or requires the application credentials.

## Open items

See [`../BACKLOG.md`](../BACKLOG.md).
