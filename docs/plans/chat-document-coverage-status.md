# Chat Document Coverage Status — V1 Implementation Plan

## Goal

Show the persisted processing coverage of every selected chat attachment without implying that selection equals successful analysis. Define bounded V1 rules for `complete`, `partial`, and `failed`; keep large-document handling inside the existing single Claude session and defer subagents/indexing.

## Locked Decisions

- The green check and `Ausgewertet` appear only for persisted `status: "complete"`.
- `partial` renders amber as `Teilweise ausgewertet`; its persisted limitation remains available on the detailed process page rather than expanding the compact chat row.
- `failed` renders destructive as `Nicht auswertbar`; its persisted limitation remains available on the detailed process page.
- A selected file without coverage renders neutrally as `Wird ausgewertet …` while the chat turn is active and `Noch nicht ausgewertet` otherwise.
- The compact attachment list remains shared between the upload gate and the completed initial milestone. Selectable rows do not show a terminal processing status.
- `partial` and `failed` require a non-empty limitation at runtime. `failed` may not report a positive `processedCharacters` value.
- `complete` means all potentially process-relevant logical units were inspected. It does not require reading every repetitive data row after document structure and relevant patterns are established.
- Any materially relevant unread or unreadable portion must be represented by `partial` and added to `knowledgeGaps`; evidence may only come from inspected content.
- V1 uses structure-first, bounded incremental reading through existing `Read`, `Glob`, and `Bash` tools. Claude `Task` subagents, autonomous loops, indexing, and a new extraction service remain out of scope.
- The existing maximum of five files, 20 MB per file, 100 MB total, and twelve Claude turns remains unchanged.

## Implementation

### 1. Tighten the persisted coverage contract

Update `packages/domain/src/process-understanding.ts`:

- Add cross-field refinement to `documentCoverageSchema`.
- Reject `partial` or `failed` without `limitation`.
- Reject `failed` with `processedCharacters > 0`.
- Preserve nullable `processedCharacters` for binary and image-based formats.

Update `tests/process-domain.test.ts` with focused valid and invalid coverage cases.

### 2. Define model-facing inspection rules

Update `defaults/prompts/process-chat.md` and `defaults/prompts/process-synthesis.md`:

- Define `complete`, `partial`, and `failed` using logical document coverage.
- Require structure-first inspection for large PDFs, presentations, workbooks, and documents.
- Require a precise limitation for partial/failed processing: inspected units, skipped or unreadable units, and the reason.
- Require material missing content to become a `knowledgeGap`.
- Forbid evidence derived from uninspected content.
- Tell the model to avoid dumping large extracted documents into context and instead inspect bounded relevant chunks.
- Do not introduce token counts, product-internal thresholds, subagents, or autonomous follow-up loops into the prompt.

### 3. Render coverage in the shared attachment list

Update `apps/web/src/components/document-attachment-list.tsx`:

- Add an optional read-only coverage input keyed by upload ID plus a `processing` flag.
- Export a small pure presentation helper mapping persisted coverage to German label, tone, icon state, and limitation.
- Render complete, partial, failed, processing, and pending states accessibly.
- Keep every chat attachment row compact and single-line; do not render limitation text in this list.
- Preserve preview, selection, removal, file count expansion, filename truncation, type, and size behavior.

Update `apps/web/src/components/process-chat-milestone-card.tsx` and `apps/web/src/components/process-chat-transcript.tsx`:

- Pass the current understanding's `documentCoverage` and turn activity into the initial milestone attachment list.
- Do not synthesize coverage for missing files.

Update `apps/web/src/pages/process-chat-page.tsx` only if the transcript does not already receive enough activity state to derive the processing flag.

### 4. Add a visible partial demo case

Update both canonical fixture snapshots for `PROC-0010`:

- `workspace/process-captures/PROC-0010/chat/last-valid-process-understanding.json`
- `workspace/process-captures/PROC-0010/process-understanding.json`

Mark `Beispiel-Fallliste.csv` as `partial`, retain a positive processed character count, and state that only the header and example rows were inspected for the UI demo. Let normal reconciliation publish the new valid revision; do not manually alter revision hashes.

## Files To Change

- `packages/domain/src/process-understanding.ts`
- `defaults/prompts/process-chat.md`
- `defaults/prompts/process-synthesis.md`
- `apps/web/src/components/document-attachment-list.tsx`
- `apps/web/src/components/process-chat-milestone-card.tsx`
- `apps/web/src/components/process-chat-transcript.tsx`
- `apps/web/src/pages/process-chat-page.tsx` only if required for the transient state
- `tests/process-domain.test.ts`
- `tests/chat-presentation.test.ts`
- `tests/chat-ui.test.ts`
- `workspace/process-captures/PROC-0010/chat/last-valid-process-understanding.json`
- `workspace/process-captures/PROC-0010/process-understanding.json`

## Verification

1. `./scripts/qa test tests/process-domain.test.ts`
2. `./scripts/qa test tests/chat-presentation.test.ts`
3. `./scripts/qa test tests/chat-ui.test.ts`
4. `./scripts/qa changed`
5. `./scripts/qa all`
6. Run the required release build through the QA script.
7. In Chrome at desktop width, open `/processes/PROC-0010/chat`, expand the five-file list, and verify:
   - four files show a green `Ausgewertet` check;
   - `Beispiel-Fallliste.csv` shows amber `Teilweise ausgewertet`;
   - its persisted limitation remains visible on the detailed process page;
   - `2 weitere Unterlagen anzeigen` and `Weniger anzeigen` still work;
   - file preview still opens and downloads safely.
8. Verify tablet layout, keyboard focus, filtered console, and failed network requests.

## Acceptance Criteria

- No selected file is shown as successfully analyzed merely because it was uploaded or selected.
- Partial and failed coverage cannot be persisted without an explanation.
- The chat UI derives status only from validated persisted coverage.
- The partial demo is visible in the real five-file `PROC-0010` list.
- No subagent, autonomous loop, file index, scoring, or opportunity-analysis behavior is added.
