# Chat Milestone Cards

## Goal

Make the beginning and completion of Chat Capture visually distinct while extending mentions backward-compatibly. The initial assistant event becomes a rich intake card with its document workflow and later shows the documents actually selected for analysis. The confirmation event becomes a rich completion card that owns the post-capture navigation. Structured process mentions become stable, revision-aware tokens instead of plain text.

## Locked Decisions

- Identify milestone messages exclusively through the persisted transcript actions `initial` and `confirmation`; never match German message copy.
- Keep the existing initial and confirmation server text unchanged. Extend mention records only through backward-compatible defaulted fields; do not rewrite existing transcript files.
- Keep ordinary user and assistant messages visually unchanged.
- The initial card contains the blocking document gate while `documentGate === "pending"`.
- After document analysis starts, the initial card shows only the uploads referenced by `selectedUploadIds`. Files uploaded but not selected are not presented as analyzed evidence.
- After skipping documents, the initial card has no empty attachment section.
- If a selected upload was removed after analysis, show one compact warning that a previously used document is unavailable; never invent its filename. Hide `Verwendete Unterlagen` only when there are neither resolved uploads nor missing selected IDs.
- Continue using the shared `DocumentPreviewDialog` for PDF, image, text, Office fallback, and download behavior.
- Extract one shared attachment-list primitive so selectable gate rows and read-only initial-card rows use the same file presentation and preview affordance.
- Render only structured `ChatMention[]` values as mention tokens. Arbitrary `@text` in a message remains ordinary text.
- A mention is a hybrid historical/live reference. Step mentions retain `stepId`; transition mentions retain `fromStepId` and `toStepId`. Both add bounded `nameSnapshot` (maximum 240 characters) and nullable `understandingRevision`, captured when the user adds the mention to the composer.
- Renaming, rewording, reordering, or enriching an existing step must preserve its ID. New steps receive new IDs, removed IDs are never reused, and split/merge operations preserve the ID of the closest semantic continuation while assigning new IDs to additional steps.
- Historic `label` values are immutable snapshots. When order changed, the token visibly retains the historical label and exposes `Jetzt Schritt N · <current name>` as supplementary text so the old order is not presented as current.
- Transition `nameSnapshot` is `Von <source snapshot> zu <target snapshot>`. A transition remains live only while both stable endpoint IDs exist and remain adjacent in the same direction; otherwise it is historical.
- Mention deduplication remains target-based within one outgoing message, independent of snapshot revision.
- ID preservation is prompt-governed, not falsely treated as deterministic. Every accepted understanding revision compares retained, added, and removed step IDs with the prior valid revision and appends an audit event whenever identities changed.
- Existing frozen process contracts are not silently replaced. They already contain the base stable-ID rule; strengthened split/merge/no-reuse instructions apply to newly frozen contracts, while historic processes remain best-effort and are covered by churn auditing.
- The final card owns `Zum Prozess` and `KI-Potenziale ansehen`. A confirmed compact or expanded process sidebar has no status label, buttons, footer border, or empty footer space.
- Preserve the centered 5/12 chat, 3/12 compact tracker, 768 px chat maximum, responsive tabs, streaming indicators, composer anchoring, and expanded 4/8 layout.

## UI Contract

### Initial card

- Card header: `Prozesserfassung`
- Body: the persisted initial assistant message.
- Pending state: the upload picker, selectable uploaded files, `Unterlagen auswerten`, and `Ohne Unterlagen fortfahren` render inside the card.
- Completed document gate: a section labelled `Verwendete Unterlagen` lists the selected files.
- In selectable mode, the checkbox toggles selection, the filename/preview action opens preview, and the remove button removes the upload; clicking empty row space performs no action.
- In read-only mode, the filename/preview action opens preview; clicking empty row space performs no action. The preview dialog retains its download action.
- Upload, removal, analyze, and skip failures render inside the initial card with `role="alert"`; the hidden composer is never the only error surface during the document gate.

### Mention rendering

- Each structured mention is shown before the message body as a compact token with an `@` prefix, primary-tinted background, primary text, and subtle border.
- Multiple mentions wrap as separate tokens.
- The raw synthetic mention prefix is removed from transcript-to-UI conversion so the mention is not duplicated.
- Optimistic user messages carry the same metadata and therefore show the token before the server transcript is resynchronized.
- Classify a milestone only for `role === "assistant"`, `status === "complete"`, and the matching action. Aborted events never receive milestone styling.
- Hide synthetic user events with actions `analyze_documents` and `skip_documents` from the visual transcript; retain them unchanged in storage and audit history.
- If a stable step target still exists, the token is interactive and resolves that current step even when its order or name changed. A changed order/name is explicitly exposed as current supplementary text while the visible token remains the historical snapshot.
- A transition target is live only when both endpoints still exist and are adjacent in the original direction.
- Desktop compact: activation scrolls and highlights the tracker step or transition without expanding the diagram.
- Desktop expanded: activation focuses and highlights the React Flow node or edge.
- Tablet: activation switches to `Prozessbild`, then focuses and highlights the React Flow node or edge.
- Focus remains selected until another mention is activated or the referenced target disappears after a diagram update.
- If the target no longer exists, the token remains visible but is not interactive and is labelled `Schritt existiert nur in einer früheren Version` or `Übergang existiert nur in einer früheren Version`.

### Completion card

- Card header: `Prozess bestätigt`
- Body: the persisted confirmation message.
- Primary action: `KI-Potenziale ansehen` → `/processes/:id/opportunities`.
- Secondary action: `Zum Prozess` → `/processes/:id`.
- The actions wrap on narrow chat widths without horizontal overflow.
- The confirmation event is a scroll anchor. Opening or completing a confirmed chat places the completion card and its actions in view rather than anchoring above it at the last user message.

## Implementation

1. Extend both structured mention variants with defaulted nullable `nameSnapshot` and `understandingRevision` fields. `nameSnapshot` is trimmed and limited to 240 characters; `understandingRevision` is either `null` or a 64-character revision hash. Existing records parse as legacy snapshots without rewriting files.
2. Populate snapshots when a mention is added to the composer, not when it is eventually sent. A missing current valid revision produces `understandingRevision: null`; target-based deduplication ignores snapshot fields.
3. Strengthen the default Chat Capture prompt with explicit ID preservation, no-reuse, split, and merge rules without replacing existing frozen contracts.
4. Compare step IDs after each accepted valid understanding update and append an audit event containing prior/current revisions plus retained, added, and removed IDs whenever the identity set changes.
5. Add typed UI-message metadata containing persisted action, status, and structured mentions. Populate it in `transcriptMessages()` and optimistic `sendMessage()` calls. Stop prepending mention labels to message text and omit synthetic gate-action events from visual rendering.
6. Add step and transition target resolution against the current understanding with the exact desktop compact, desktop expanded, and tablet behavior above. Existing targets focus visibly; removed or non-adjacent targets render as historical, disabled tokens.
7. Extract the document gate from the page into a component and place it in the initial milestone card rather than appending it as a separate transcript item. Give the gate its own visible error state and catch upload, removal, analyze, and skip failures.
8. Add a discriminated shared attachment-list component:
   - `selectable`: checkbox, preview action, and remove action;
   - `readonly`: preview action only.
9. Add dedicated initial and completion card components. Keep defensive message classification inside `ProcessChatTranscript`, based on typed message metadata.
10. Compute initial-card attachments from `view.state.selectedUploadIds` and `view.uploads`; pass missing-selected counts and the pending document gate into the card.
11. Render structured mention tokens for regular messages before their Markdown body.
12. Make `ProcessConfirmationActions` unconfirmed-only. Remove its `processId` and `confirmed` branches, and conditionally omit confirmed wrappers in compact tracker, expanded diagram, and tablet diagram tab.
13. Make the completed milestone a `MessageScrollerItem` anchor.
14. Test pure classification/resolution helpers with Bun, retain source-contract checks for wiring only, and rely on browser verification for rendered behavior because this repo has no DOM test harness.

## Files To Change

- `apps/web/src/pages/process-chat-page.tsx`
  - Define chat UI-message metadata.
  - Preserve action and mention metadata during transcript hydration and optimistic sends.
  - Pass selected initial uploads, preview handling, and the pending document gate into the transcript.
  - Resolve mention targets against the current understanding and coordinate focus/highlight state.
  - Remove the page-local `DocumentGate` implementation.
  - Omit confirmed footer wrappers in expanded and tablet diagram presentations.
  - Switch tablet mention activation to the diagram tab and retain one focused target.
- `apps/web/src/components/process-chat-transcript.tsx`
  - Classify stored milestone messages by action.
  - Render rich initial/completion cards and structured mention tokens.
- `apps/web/src/components/chat-mention.tsx` (new)
  - Render live and historical mention states with accessible snapshot/current labels.
- `apps/web/src/components/chat-document-gate.tsx` (new)
  - Own upload, selection, removal, analyze, and skip controls without adding a second outer card.
- `apps/web/src/components/document-attachment-list.tsx` (new)
  - Shared selectable/read-only attachment rows with preview affordances.
- `apps/web/src/components/process-chat-milestone-card.tsx` (new)
  - Implement initial and completion card presentation and completion navigation.
- `apps/web/src/components/process-confirmation-actions.tsx`
  - Retain only the pre-confirmation guidance and confirmation button.
- `apps/web/src/components/process-tracker.tsx`
  - Remove `processId`, omit its footer when confirmed, and scroll/highlight a focused stable step ID.
- `apps/web/src/components/process-flow-diagram.tsx`
  - Focus and highlight a stable step ID when the user activates a live mention.
- `packages/domain/src/chat-capture.ts`
  - Add backward-compatible mention snapshot and revision fields.
- `packages/storage/src/chat-capture-repository.ts`
  - Compare prior/current stable step IDs before publishing a new valid revision and append a bounded identity-change audit event.
- `defaults/prompts/process-chat.md`
  - Specify exact step-ID preservation, no-reuse, split, and merge rules.
- `apps/server/src/chat-capture-service.ts`
  - Include snapshot context in the bounded mention reference sent to Claude.
- `tests/chat-domain.test.ts`
  - Cover new mention snapshots and legacy transcript compatibility.
- `tests/chat-storage.test.ts`
  - Cover retained IDs and bounded added/removed ID audit output across understanding revisions.
- `tests/chat-api.test.ts`
  - Verify mention snapshot persistence and prompt context.
- `tests/chat-ui.test.ts`
  - Update moved-copy source checks and assert wiring for action-based milestone rendering, live/historical mention behavior, shared attachment preview integration, completion anchoring, and removal of all three confirmed footer wrappers.
- `tests/chat-presentation.test.ts` (new)
  - Unit-test pure message classification plus step/transition live-vs-historical resolution without requiring a DOM harness.

No storage migration is required. The runtime schema accepts legacy mention records and writes the richer fields for new mentions.

## Verification

### Automated

- `./scripts/qa test tests/chat-ui.test.ts`
- `./scripts/qa changed`
- `./scripts/qa all`
- `bun run build:release`
- `git diff --check`

### Browser

At `1440 × 900` and `2048 × 1152` on a completed chat process:

- Initial assistant message is a rich card.
- Selected intake documents appear inside it and open the shared preview/download dialog.
- `@Schritt-4` is a styled mention token and is not duplicated in the message body.
- Activating `@Schritt-4` focuses the current step with the same stable ID even after reorder or rename.
- When the current order/name differs, the token retains its historical label and clearly exposes the current order/name.
- A live transition mention focuses its current connector; removing an endpoint or adjacency makes it a disabled historical transition.
- A mention whose target was removed remains readable as a disabled historical reference.
- Final assistant message is a rich card with both navigation buttons.
- The completed card is visible immediately on route load and after confirmation.
- Compact tracker is 3/12 wide and has no confirmed label, buttons, footer border, or empty footer area.
- Chat remains centered at 5/12 and caps at 768 px.

At `1024 × 768`:

- Cards and buttons fit the `Gespräch` tab without horizontal scrolling.
- Activating a live mention switches to `Prozessbild` and focuses its target.
- A confirmed `Prozessbild` tab has no empty bordered footer.

For a new pending chat process:

- Upload and skip controls appear inside the initial card.
- Uploaded files use the shared row and preview behavior.
- Selecting documents and starting analysis replaces the gate with `Verwendete Unterlagen` without duplicating the initial message.
- Synthetic analyze/skip user bubbles are not rendered.
- Upload, removal, analyze, and skip errors appear inside the initial card.
- A missing formerly selected upload produces one compact unavailable-document warning.

Keyboard verification:

- Tab reaches attachment checkboxes, preview controls, remove controls, mention tokens, and final navigation in logical order.
- Enter/Space activate the focused control without triggering a second row action.

Contract verification:

- A newly created process freezes the strengthened ID instructions.
- An existing process keeps its original frozen contract and still loads; ID changes appear in the audit history rather than silently masquerading as guaranteed stability.

Inspect filtered console messages and failed fetch/XHR requests after each browser scenario; both must be empty.

## Expected Output

- One clearly framed start milestone containing the document intake experience.
- One clearly framed completion milestone containing the next-step navigation.
- Recognizable, structured mention tokens in user messages.
- A process sidebar dedicated only to the evolving process image after confirmation.
