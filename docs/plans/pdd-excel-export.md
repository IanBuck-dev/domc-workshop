# PDD Excel Export — Implementation Plan

## Goal

Add a deterministic downstream export that converts one human-confirmed Process
Understanding into a repository-local `.xlsx` Process Definition Document. The first
contract is a synthetic, German, multi-sheet workbook. It proves the full generation and
download path while the real PDD template is pending.

## Locked Decisions

- `PDD-Arbeitsmappe` is a derived, read-only artifact. The confirmed Process
  Understanding remains canonical and Excel is never imported back.
- Eligibility requires `state === "confirmed"`, a non-null understanding, and
  `confirmedAt`. Both form and chat captures are supported, including legacy profile-v1
  records that satisfy those invariants.
- Confirmation with acknowledged gaps remains exportable. The workbook marks the quality
  and lists every knowledge gap, conflict, and assumption.
- Generation is synchronous and deterministic except for `exportedAt` and `exportId`. It
  uses no Claude session and no autonomous operation.
- Each user action creates one immutable workbook under the process directory and appends
  one audit event. Repeated actions create separate files; they never overwrite an export.
- `sourceRevision` is a SHA-256 of the canonical cover, confirmed timestamp,
  confirmation quality, work characteristics, and Process Understanding. The workbook,
  filename metadata, and audit event carry that revision.
- The synthetic contract uses seven sheets: `Übersicht`, `Prozessschritte`,
  `Entscheidungen`, `Informationen`, `Organisation`, `Offene Punkte`, `Nachweise`.
- The synthetic contract requires no new capture fact. Unknown values render as
  `Nicht bekannt`. New capture questions are deferred until the real PDD reveals a
  required field with no canonical source.
- The production implementation writes the minimal OOXML package with the existing
  `fflate` dependency. It validates every config read, the source record, the generated
  ZIP entries, workbook sheet names, and absence of unresolved placeholders before
  persisting or returning bytes.
- The process detail page adds a third module card. Before confirmation it explains the
  gate; after confirmation it offers `Excel erstellen`; confirmed-with-gaps remains
  available with a warning state.
- No export history UI, template upload UI, batch export, scoring, prioritisation,
  financial values, solution recommendations, or handover is included.

## Domain Contract

Add `packages/domain/src/pdd-export.ts` with strict Zod schemas and pure functions:

- `pddExportConfigSchema`: schema version, template id/version/title, sheet names,
  filename prefix, and German labels for provenance, information types, decision modes,
  and confirmation quality.
- `pddWorkbookModelSchema`: the seven fully materialised sheet row models, source process
  id/name/revision, confirmation metadata, and template identity.
- `pddExportAuditDetailSchema`: export id, filename, byte size, SHA-256, source revision,
  confirmed timestamp, export timestamp, and template identity.
- `createPddWorkbookModel(record, config, exportedAt)`: maps every canonical field,
  graph gateway/branch, information item, work characteristic, gap, conflict,
  assumption, provenance value, confidence value, fact confirmation flag, and evidence
  reference without inference.
- `pddSourceRevision(record)`: stable canonical hashing independent of object key order.
- `safePddFilename(...)`: German-safe, path-safe deterministic prefix plus process id,
  confirmation date, source-revision prefix, and export-id prefix.

The model represents lists as rows or newline-separated cells according to sheet intent.
It never truncates within the domain limits.

## Workbook Contract

Add `defaults/pdd-export-config.json` as the versioned synthetic template contract.

Add `packages/storage/src/pdd-workbook.ts`:

- build a valid `.xlsx` OOXML ZIP using inline strings and typed numeric/date cells;
- use one restrained light-mode style system with hidden gridlines, title bands, header
  fills, wrapped body cells, column widths, frozen headers, autofilters, print settings,
  and explicit date/number formats;
- escape XML and spreadsheet formula prefixes so process text can never become an active
  formula;
- include core/app properties and no macros, external relationships, active content, or
  hyperlinks;
- re-open the bytes with `unzipSync`, require the full expected entry set, validate XML
  decoding and the exact seven sheet names, reject unresolved `{{...}}` markers, and
  reject macro or external-link parts.

Add `packages/storage/src/pdd-export-repository.ts`:

- load and validate `pdd-export-config.json` from `CLAIMS_AI_DEFAULTS_DIR` or `defaults/`;
- create a UUID export id and timestamp;
- call the pure mapper and OOXML writer;
- atomically write `workspace/process-captures/<id>/exports/<filename>.xlsx`;
- compute and return the validated audit detail plus bytes;
- append `pdd-exported` only after the durable write succeeds;
- remove a half-written file on failure while leaving prior exports untouched.

## API Contract

Add `apps/server/src/routes/pdd-exports.ts` and mount it under `/api/processes` in
`apps/server/src/index.ts`.

`POST /api/processes/:id/pdd-export`:

- returns `404` for an unknown process;
- returns `409` with manager-facing German copy unless the process is confirmed and has a
  confirmed understanding snapshot;
- creates and audits one immutable export;
- returns the generated bytes with the XLSX MIME type, `Cache-Control: private, no-store`,
  `Content-Disposition: attachment` with ASCII and RFC 5987 filenames,
  `X-Content-Type-Options: nosniff`, and `X-PDD-Source-Revision`;
- exposes no local path, JSON, model terminology, or stack trace.

Extend `processHistoryEventNames` with `pdd-exported` and validate its detail in the PDD
domain schema before appending it.

## Web Contract

Extend `ProcessNavigationModel` with a `pdd` module and action `export_pdd`:

- pre-confirmation: `Nach Bestätigung`, no action, explicit blocked reason;
- confirmed complete: `Bereit`, success tone, `Excel erstellen`;
- confirmed with gaps: `Offene Punkte enthalten`, warning tone, `Excel erstellen`.

Update `ProcessDetailPage`:

- render a `PDD-Export` card with `FileSpreadsheet` icon;
- perform the POST through `api.exportPdd`, derive the filename from
  `Content-Disposition`, create a temporary object URL, trigger one browser download,
  revoke the URL, and restore the button state;
- show `Wird erstellt …` while busy and manager-facing inline errors on failure;
- keep the card usable at desktop and tablet widths in the existing responsive grid.

## Files To Change

- `AGENTS.md`
- `CONTEXT.md`
- `defaults/pdd-export-config.json`
- `packages/domain/src/pdd-export.ts`
- `packages/domain/src/process-events.ts`
- `packages/storage/src/pdd-workbook.ts`
- `packages/storage/src/pdd-export-repository.ts`
- `apps/server/src/routes/pdd-exports.ts`
- `apps/server/src/index.ts`
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/lib/process-navigation-model.ts`
- `apps/web/src/pages/process-detail-page.tsx`
- `docs/domain/README.md`
- `docs/domain/pdd-export.md`
- `tests/pdd-export-domain.test.ts`
- `tests/pdd-export-storage.test.ts`
- `tests/pdd-export-api.test.ts`
- `tests/process-navigation-model.test.ts`
- `tests/pdd-export-ui.test.ts`

## Test Scenarios

### Domain

- Same confirmed snapshot produces the same source revision regardless of object key order.
- Every global fact, step, gateway branch, information item, work characteristic, gap,
  conflict, assumption, provenance value, confidence value, and evidence record appears
  exactly once in the appropriate model rows.
- Null values become `Nicht bekannt`; zero confidence remains `0`; unsafe filenames and
  formula-prefixed text are neutralised without losing readable content.
- Profile-v1 confirmed records export with absent work characteristics described as
  `Nicht erfasst`.

### Storage and workbook

- Generated bytes are a valid OOXML ZIP with the exact seven sheets and required package
  relationships.
- XML-special characters and German umlauts round-trip correctly.
- No macro, external-link, formula cell, unresolved marker, or path traversal is present.
- The workbook contains source revision and confirmation/export timestamps.
- Two exports create two files and two audit entries; a failed write creates neither a
  success event nor a partial workbook.
- LibreOffice opens the workbook without repair prompts and can export every sheet to PDF.

### API

- Unknown process returns `404`; unconfirmed or missing understanding returns `409`.
- Confirmed complete and confirmed-with-gaps processes return an XLSX attachment with safe
  headers and exact stored bytes.
- The audit detail hash and byte size match the returned workbook.
- Process deletion removes its export directory through the existing process deletion path.

### Web

- Navigation states expose a reason whenever PDD export is unavailable.
- Complete and with-gaps confirmations both expose the export action with distinct status.
- The card renders German copy, busy state, and inline error state without dark-mode classes.
- The API helper rejects non-2xx JSON errors and downloads successful binary responses with
  the server filename.

## Validation Commands

During implementation:

```zsh
./scripts/qa test tests/pdd-export-domain.test.ts
./scripts/qa test tests/pdd-export-storage.test.ts
./scripts/qa test tests/pdd-export-api.test.ts
./scripts/qa test tests/process-navigation-model.test.ts tests/pdd-export-ui.test.ts
./scripts/qa changed
```

Before handoff:

```zsh
./scripts/qa all
bun run build:release
```

## Browser Acceptance

Use Chrome DevTools MCP with an authenticated user session; the user enters credentials.

1. Desktop width: open a confirmed complete process, verify the PDD card reads `Bereit`,
   trigger `Excel erstellen`, confirm one `.xlsx` download and no failed network request or
   console error.
2. Desktop width: open a confirmed-with-gaps process, verify the warning status, export,
   and confirm the workbook lists those gaps.
3. Tablet width: repeat one export and verify the three module cards, busy state, status,
   and button remain visible and operable without horizontal page overflow.
4. Open the downloaded workbook in LibreOffice, inspect all seven sheets, export to PDF,
   render every PDF page, and confirm titles, headers, wrapped cells, umlauts, and long
   process text are legible with no clipping severe enough to hide content.
5. Filter the browser console to warnings/errors and inspect failed network requests; both
   must be empty for the export action.

## Acceptance Criteria

- A human-confirmed process produces and downloads one complete multi-sheet PDD workbook
  with no Claude call.
- The workbook is durably stored inside that process, source-revisioned, validated, and
  append-only audited before it is returned.
- Open points and provenance remain visible; the workbook contains no invented values.
- Pre-confirmation export is impossible and explained in the UI.
- The release packages include the versioned PDD config and run on supported targets.
- Focused tests, `./scripts/qa all`, the release build, LibreOffice verification, and desktop
  plus tablet browser checks pass.
