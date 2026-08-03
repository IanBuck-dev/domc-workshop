# Chat Attachment List Reference

## Goal

Adapt the supplied `file-attachment.tsx` reference to the existing Chat Capture attachment UI. Use one compact bordered list for one to five files, including the single-file case, while preserving the current selectable intake and read-only analyzed-document behaviors.

## Locked Decisions

- Extend the existing `DocumentAttachmentList`; do not add a competing attachment model or copy the reference component wholesale.
- Render the list variant for every non-empty collection, including exactly one file.
- Use only persisted `UploadRecord` fields. Do not introduce synthetic `processing`, `partial`, or `failed` states.
- Selectable intake rows contain a checkbox, type-aware icon, filename, type/size metadata, preview action, and remove action.
- Read-only analyzed rows contain the same file presentation and preview action plus a compact `Ausgewertet` check.
- Keep the filename action as the primary preview affordance and add an eye icon button. Empty row space performs no action.
- Show the first three files and collapse additional files behind `Weitere Unterlagen anzeigen`; the maximum remains five.
- Keep existing parent labels and preview/download dialog unchanged.

## Files To Change

- `apps/web/src/components/document-attachment-list.tsx`
  - Add type-aware icons, byte/type formatting, middle truncation, compact status, preview action, and the shared collapsible list container.
  - Preserve the existing discriminated selectable/read-only props.
- `tests/chat-presentation.test.ts`
  - Cover the pure formatting/truncation helpers.
- `tests/chat-ui.test.ts`
  - Assert the shared list remains wired into both intake and milestone states and uses the collapsible list contract.

## Verification

- `./scripts/qa test tests/chat-presentation.test.ts tests/chat-ui.test.ts`
- `./scripts/qa changed`
- `./scripts/qa all`
- `bun run build:release`
- `git diff --check`
- Chrome at 1440 × 900:
  - one pending file uses the compact list row;
  - checkbox, preview, and remove controls remain separate;
  - one analyzed file uses the same list row with an `Ausgewertet` check;
  - preview dialog and download still work;
  - no console errors or failed requests.

## Expected Output

One consistent, compact attachment list based on the supplied reference, adapted to the repository's existing storage contract and interaction states.
