# Chat Diagram Vertical Layout

## Goal

Improve the Chat Capture process diagram without changing its domain contract: render the existing linear process from top to bottom, show a directional arrowhead on every transition, and keep the zoom/fit controls fixed at the top-right of the diagram canvas.

## Implementation

1. Update `ProcessFlowDiagram` so step nodes use a single vertical lane with a constant vertical gap. Move each node's target handle to `Position.Top` and source handle to `Position.Bottom` so transitions leave and enter the correct sides.
2. Add one React Flow `MarkerType.ArrowClosed` marker definition to every generated transition. Use the existing foreground-muted color so direction remains visible without competing with process cards or mention controls.
3. Keep the existing custom edge renderer, evidence-independent derived transitions, hover mention button, stable mention IDs, read-only behavior, pan/zoom, and `fitView` behavior unchanged.
4. Configure `Controls` with `position="top-right"`. Add a small top/right inset through its class so it remains pinned inside the canvas and does not overlap the updating indicator on the left.
5. Strengthen the UI contract test to assert vertical handles/coordinates, closed arrow markers, and top-right controls.

## Files To Change

- `apps/web/src/components/process-flow-diagram.tsx`
- `tests/chat-ui.test.ts`
- `docs/plans/chat-diagram-vertical-layout.md`

## Verification

- `./scripts/qa test tests/chat-ui.test.ts`
- `./scripts/qa changed`
- Chrome DevTools at 1440×900 and 768×1024:
  - steps appear in order from top to bottom;
  - every transition ends in a visible arrowhead at the following step;
  - zoom and fit controls stay at the canvas's top-right while panning/zooming;
  - step and transition mention buttons still focus the chat composer;
  - no console errors, warnings, accessibility issues, or failed API requests.

## Acceptance Criteria

- The diagram remains a read-only linear projection of validated JSON.
- Vertical layout is the default at every supported viewport.
- Every derived transition has one closed arrowhead pointing to the next step.
- Controls remain inside the top-right corner of the canvas.
- Existing Chat Capture state, persistence, confirmation, and Opportunity Discovery behavior is unaffected.
