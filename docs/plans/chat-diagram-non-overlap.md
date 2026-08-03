# Prevent Chat Diagram Step Overlap

## Goal

Guarantee that long process-step content cannot make adjacent cards overlap in the vertical Chat Capture diagram.

## Implementation

1. Give every `StepNode` card a fixed `12rem` height and hide visual overflow.
2. Clamp the step name and activity to three lines each. Preserve each complete value through the element's `title` attribute and unchanged text content so truncation is visual only.
3. Increase the deterministic vertical node interval from `180px` to `240px`, leaving a fixed `48px` transition corridor between two `192px` cards.
4. Preserve vertical handles, arrow markers, mention actions, read-only behavior, `fitView`, and top-right controls unchanged.
5. Update the Chat UI contract test to lock the fixed card height, both clamps, and the `240px` interval.

## Files To Change

- `apps/web/src/components/process-flow-diagram.tsx`
- `tests/chat-ui.test.ts`
- `docs/plans/chat-diagram-non-overlap.md`

## Verification

- `./scripts/qa test tests/chat-ui.test.ts`
- `./scripts/qa changed`
- Chrome DevTools at 1440×900 and 768×1024 using the existing long-title smoke process:
  - every adjacent node has a positive vertical gap;
  - no card content paints outside its node bounds;
  - arrowheads remain visible in every transition corridor;
  - controls remain at the top-right;
  - console errors, warnings, accessibility issues, and failed API requests remain empty.

## Acceptance Criteria

- Process-step cards never overlap for any schema-valid step name or activity.
- The visual diagram remains compact and legible.
- Full step text remains available to assistive technology and through native hover text.
- No Chat Capture domain, storage, or AI behavior changes.
