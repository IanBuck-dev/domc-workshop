# PDD current-state template export — implementation plan

## Outcome

Newly captured processes store one evidence-aware `ProcessCaptureRecord` with the
existing `understanding` plus fixed `currentStateDetails`. The bounded capture AI
generates both the step activity descriptions and a two-to-three-sentence current-state
summary from the supplied material. After human review and confirmation, the app fills
only `Deckblatt`, `01_Prozessdefinition`, and `02_Prozessschritte` in the sanitized
`PDD_Draft.xlsx` template. Export performs no AI call and preserves sheets 4–17.

The field, validation, and cell contract in
`docs/plans/pdd-draft-current-state-contract.md` is binding. If this plan and that
contract differ, the contract wins.

## Locked decisions

- Add capture profile `compact-v1` version `3`; versions 1 and 2 remain readable.
- `ProcessCaptureRecord.currentStateDetails` is a sibling of `understanding`. Profile 3
  persists both in one atomic `process-definition.json` object; profile 1/2 keep their
  existing `process-understanding.json` storage.
- AI contracts return a `ProcessDefinitionDraft` containing `understanding` and
  `currentStateDetails`. The form adapter returns that object. Chat maintains the two
  working files and publishes them together only after one verifier validates both.
- Step `activity` remains the diagram sublabel and PDD step description. There is no
  second description field and no dedicated question for it.
- The AI derives `currentStateSummary`, actors, systems, handoffs, decisions, pain-point
  links, and exception classifications only from user statements and selected files.
  Missing evidence becomes an explicit `unknown`, never an invented `known` value.
- Existing version 1/2 records expose `currentStateDetails: null`. The real-template
  export is offered only for a confirmed version 3 definition.
- Version 3 confirmation requires structurally complete coverage. Explicit unknowns
  are allowed and produce `confirmationQuality: with_gaps` plus the existing override.
- The sanitized template is a versioned default asset. The mapping holds workbook
  details; domain objects contain no sheet names or cell addresses.
- `defaults/pdd-export-config.json.enabled` is the rollback switch. Disabled means the
  API returns 404 and the UI hides the export without altering stored processes.
- Sheets 4–17 and every unmapped OOXML part are preserved byte-for-byte relative to the
  sanitized asset. Only mapped cells on sheets 1–3 and document properties are mutable.
- Current-state-only scope notices populate future-state fields on sheets 1–3. All
  other future-state and downstream project fields remain untouched.

## Domain and persistence

### Types and validation

Extend `packages/domain/src/process-understanding.ts` with the exact types from the
field contract:

- `coverageStateSchema` and generic-qualified-value builders enforcing the state/value/
  reason invariant.
- `processActorSchema`, `processSystemSchema`, `processPainPointSchema`,
  `processVariationSchema`, and `currentStateDetailsSchema`.
- Step fields `actors`, `systemRefs`, `painPoints`, `decisions`, and `exceptionRefs`.
- Gateway fields `variationRef`, `humanInvolvement`, and `ownerActorRef`.
- Edge field `handoff`, including actor/information references, channel, media-break
  coverage, and note.
- `processDefinitionDraftSchema = { schemaVersion: 1, understanding,
currentStateDetails }`.
- Profile/config version 3 and nullable `currentStateDetails` on the record schema.

Add pure `validatePddCurrentState(record)` and `derivePddCoverage(record)` functions in
`packages/domain/src/pdd-export.ts`. They enforce reference integrity, one actor per
step, human decision ownership, variation kind rules, handoff completeness, the
eight-step limit, and coverage state completeness. The report has `valid`, `quality`,
`covered`, `gaps`, and `errors`; it is derived and never stored as editable truth.

All version 1/2 step records parse with empty new arrays and nullable new flow fields.
Only profile 3 confirmation invokes the new readiness gate.

### Repository

Update `packages/storage/src/process-capture-repository.ts` to:

- create, read, and atomically replace one `process-definition.json` for profile 3;
- save `ProcessDefinitionDraft` after synthesis before the state transition and append
  one audit event;
- correct both parts through `correctDefinition`, record the user's reason, add human
  correction evidence/provenance, and revoke confirmation;
- validate profile 3 readiness in `confirm` and include explicit PDD gaps in the
  confirmation-quality calculation;
- finalize chat with both parts and the same readiness rules;
- delete/reset/export neither source part independently.

Keep the existing understanding-only methods/routes for profile 1/2 compatibility.

## Capture AI contracts

### Form capture

Add `defaults/ai-schemas/process-definition.json` and change
`defaults/prompts/process-synthesis.md` so the one bounded synthesis returns the full
definition draft. Update:

- `packages/claude/src/process-response-schemas.ts`
- `packages/claude/src/process-ai-contracts.ts`
- `packages/claude/src/process-ai-utils.ts`
- `packages/claude/src/process-synthesis-adapter.ts`
- `apps/server/src/routes/process-captures.ts`

The prompt explicitly generates step activity text and the current-state summary,
classifies XOR branches versus small step exceptions, and emits qualified unknowns for
unsupported facts. It excludes target state, solution proposals, scoring, priority,
financial values, and optimization claims.

### Chat capture

Version the chat contract for profile 3 without changing frozen contracts of existing
processes:

- Add `defaults/prompts/process-chat-v3.md` and use
  `defaults/ai-schemas/process-definition.json`.
- Update `packages/storage/src/chat-capture-repository.ts` to initialize and reconcile
  one `process-definition.json`, while publishing one
  `last-valid-process-definition.json` snapshot. The contract manifest records profile
  and contract version, and repair always restores the frozen profile-matching files.
- Update `apps/server/src/chat-capture-service.ts`,
  `apps/server/src/chat-turn-runner.ts`,
  `packages/claude/src/chat-capture-adapter.ts`, and
  `packages/claude/src/chat-sandbox-spawn.ts` so the verifier validates both files and
  produces one revision.
- Keep the version 1/2 paths, filenames, and frozen schemas operational.

The chat asks at most one useful question per user turn. The PDD checklist guides topic
coverage; it does not become a second questionnaire or autonomous loop.

Update the structured step contract from its current five-step minimum to the locked
one-to-eight range. Form follow-ups use the PDD checklist to prefer missing handoff,
decision-owner, media-break, and operational-context facts within the existing maximum
of five questions. Anything still unsupported is stored as `unknown`.

## Review and capture UI

Update the process pages and types so profile 3 always present the same aggregate:

- `apps/web/src/lib/process-types.ts` and `apps/web/src/lib/api-client.ts` expose the
  definition, readiness report, definition correction, and confirmed export.
- Add `apps/web/src/components/process-current-state-details.tsx` to show and edit
  summary, process owner, confidentiality, systems, pain points, variations, and
  operational context with known/unknown/not-applicable controls.
- Extend `apps/web/src/components/process-brief.tsx` and
  `apps/web/src/components/process-step-card.tsx` to review/edit typed actors, system
  references, pain-point links, decisions, exception links, and handoffs in the existing
  correction transaction.
- Extend `apps/web/src/components/process-map.tsx` to show a compact exception-count
  badge on a step; selecting it opens the existing expanded step card. XOR alternatives
  remain gateways, not exception badges.
- Add a derived PDD checklist to form and chat review. It shows covered, explicitly
  unknown, and invalid items; it never exposes JSON or Excel cells.
- Keep the first intake page unchanged. Process owner remains a later capture fact.

Catalog correction rejects deletion of a referenced system, pain point, actor, or
variation and identifies the referencing step/flow item. IDs remain stable for edited
entities; replacement creates a new ID and requires references to change in the same
correction transaction.

Profile 3 correction uses `PATCH /api/processes/:id/definition`; the server records the
reason and returns the full record. Confirmation returns `409` with safe German
readiness errors when the definition is invalid. Unknowns use the existing confirmation
override dialog.

## Real workbook adapter

### Sanitized asset and mapping

Add `scripts/import-pdd-template.ts`. It accepts an explicit source and destination,
requires the inspected source hash, rejects macros/external links, clears personal and
pre-filled project values plus personal document properties, comment authors, people
metadata, and orphaned shared strings, and writes:

`defaults/pdd/PDD_Draft.current-state.v1.xlsx`

The script validates the 17-sheet order and all mapping anchors after sanitizing. It
must never log removed values. The generated binary asset is committed; runtime never
depends on the user's Downloads folder.

Replace `defaults/pdd-export-config.json` with schema version 2 containing template id,
version, relative asset path, sanitized SHA-256, mapping version, expected sheet order,
the exact cell map from the field contract, eight step rows, and German constants.

### View model and OOXML patcher

Replace the synthetic workbook model in `packages/domain/src/pdd-export.ts` with a typed
three-sheet `PddCurrentStateView`. It derives display strings only from the confirmed
aggregate. It uses explicit `Nicht bekannt: …` text for unknowns and the locked scope
notice for future fields.

Replace `packages/storage/src/pdd-workbook.ts` with a template patcher that:

1. loads and verifies the configured asset hash;
2. resolves sheet relationships by name and validates the 17-sheet order, mapped rows,
   merged anchors, expected styles, and data-validation lists;
3. copies every ZIP entry, modifying only mapped worksheet XML and allowed document
   properties;
4. replaces the content/type of existing target cells and inserts absent cells in column
   order while preserving the row, dimension, spans, and inherited style contract;
5. writes strings as escaped `inlineStr` values and neutralizes formula prefixes;
6. blanks unused process rows 7–14 without changing style, validation, comments, row
   dimensions, or merged ranges;
7. confirms decompressed excluded-sheet entries and all other non-target entries match
   the asset; re-zipping uses a pinned timestamp for deterministic bytes;
8. decodes only OOXML text entries, permits template-owned formulas on excluded sheets,
   and rejects macros, external links, unresolved placeholders, or formulas introduced
   into mapped cells; and
9. reopens the final archive before returning bytes.

Cell `H7:H14` receives only one value accepted by its existing list validation:
`Ja`, `Nein`, `Teilweise`, or `Offen`. The accountable actor is rendered in column `I`.
The view model applies explicit per-cell character and line budgets; overflow becomes a
visible readiness error instead of clipped output.

Update `packages/storage/src/pdd-export-repository.ts` and
`apps/server/src/routes/pdd-exports.ts` to pass the authenticated username, persist the
immutable workbook atomically, and audit export id, sanitized template hash, mapping
version, source revision, output hash, confirmation/export timestamps, and initiating
user. A failed export removes a partial file and does not change the process.

`pddSourceRevision` hashes the complete canonical profile 3 definition, including
`currentStateDetails`. Cover cell `B10` uses `record.cover.participantName`; the
authenticated username is audit-only and is never substituted for the participant.

The existing synthetic writer remains only as a test fixture helper under `tests/`; it
is not reachable from production code.

## Files To Change

- Domain: `packages/domain/src/process-understanding.ts`,
  `packages/domain/src/pdd-export.ts`, `packages/domain/src/process-events.ts`
- AI: `packages/claude/src/process-ai-contracts.ts`,
  `packages/claude/src/process-response-schemas.ts`,
  `packages/claude/src/process-ai-utils.ts`,
  `packages/claude/src/process-synthesis-adapter.ts`,
  `packages/claude/src/chat-capture-adapter.ts`,
  `packages/claude/src/chat-sandbox-spawn.ts`
- Storage: `packages/storage/src/process-capture-repository.ts`,
  `packages/storage/src/chat-capture-repository.ts`,
  `packages/storage/src/pdd-export-repository.ts`,
  `packages/storage/src/pdd-workbook.ts`
- Server: `apps/server/src/routes/process-captures.ts`,
  `apps/server/src/routes/chat-captures.ts`,
  `apps/server/src/routes/pdd-exports.ts`, `apps/server/src/chat-capture-service.ts`,
  `apps/server/src/chat-turn-runner.ts`
- Web: `apps/web/src/lib/process-types.ts`, `apps/web/src/lib/api-client.ts`,
  `apps/web/src/pages/process-capture-page.tsx`,
  `apps/web/src/pages/process-chat-page.tsx`,
  `apps/web/src/pages/process-detail-page.tsx`,
  `apps/web/src/components/process-brief.tsx`,
  `apps/web/src/components/process-step-card.tsx`,
  `apps/web/src/components/process-map.tsx`,
  `apps/web/src/components/process-current-state-details.tsx`
- Defaults/assets: `defaults/process-capture-config.json`,
  `defaults/ai-schemas/process-definition.json`,
  `defaults/prompts/process-synthesis.md`, `defaults/prompts/process-chat-v3.md`,
  `defaults/pdd-export-config.json`, `defaults/pdd/PDD_Draft.current-state.v1.xlsx`
- Scripts/docs: `scripts/import-pdd-template.ts`, `docs/domain/README.md`,
  `docs/domain/pdd-export.md`, `CONTEXT.md`
- Tests: `tests/process-domain.test.ts`, `tests/process-storage.test.ts`,
  `tests/process-ai-contract.test.ts`, `tests/chat-storage.test.ts`,
  `tests/chat-ai-contract.test.ts`, `tests/chat-api.test.ts`,
  `tests/pdd-export-domain.test.ts`, `tests/pdd-export-storage.test.ts`,
  `tests/pdd-export-api.test.ts`, `tests/pdd-export-ui.test.ts`,
  `tests/process-review-ui.test.ts`, `tests/process-fixtures.ts`, and a sanitized
  template fixture/hash assertion.

## Test scenarios

- Domain accepts all three coverage states and rejects each invalid state/value/reason
  combination and every broken actor/system/pain-point/variation/handoff reference.
- AI form/chat contracts produce both aggregate parts, generate step activity/summary,
  preserve evidence, and convert missing facts to explicit unknowns.
- Profile 1/2 records and frozen chat sessions remain readable; profile 3 cannot confirm
  an invalid definition and can confirm/export a definition with explicit gaps.
- Human corrections update both parts, append correction evidence/audit reason, and
  revoke confirmation.
- Workbook output has the exact 17-sheet order; only sheets 1–3 mapped cells differ;
  sheets 4–17 and non-target package parts equal the sanitized asset byte-for-byte.
- All 39 direct fields and eight step rows map correctly; fewer than eight steps clear
  unused rows; more than eight is rejected.
- Unknown, not-applicable, long Unicode, line breaks, XML characters, and formula-prefix
  strings remain literal and readable.
- Export rejects unconfirmed/legacy/invalid processes, template hash drift, missing
  anchors, macros, external links, path traversal, duplicate export ids, and injected
  filenames.
- Audit contains template hash, mapping version, source/output revisions, timestamps,
  and authenticated user; export failure leaves no partial artifact.
- Desktop and tablet UI show checklist status, current-state review/editing, exception
  badges, safe validation messages, and a confirmed-only PDD download.

## Validation commands

During implementation:

```sh
./scripts/qa test tests/process-domain.test.ts
./scripts/qa test tests/process-storage.test.ts
./scripts/qa test tests/process-ai-contract.test.ts
./scripts/qa test tests/chat-storage.test.ts
./scripts/qa test tests/chat-api.test.ts
./scripts/qa test tests/pdd-export-domain.test.ts
./scripts/qa test tests/pdd-export-storage.test.ts
./scripts/qa test tests/pdd-export-api.test.ts
./scripts/qa test tests/pdd-export-ui.test.ts
./scripts/qa changed
```

Before handoff:

```sh
./scripts/qa all
bun run build
```

Open one generated workbook with LibreOffice in headless mode, render sheets 1–3 to
PDF/PNG, and visually compare them with the inspected template. Then run the authenticated
Chrome end-to-end flow at desktop and tablet widths: create a fresh demo process, let AI
capture the full current state, review the checklist, confirm with or without explicit
gaps, export, download, inspect failed network requests and filtered console errors, and
verify the stored audit event.
