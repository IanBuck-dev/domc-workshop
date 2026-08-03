# Chat View Tabs

## Goal

Replace the mobile/tablet `Gespräch` / `Prozessbild` button pair with the shadcn `Tabs` primitive while preserving the existing view state, unread indication, and desktop two-column layout.

## Locked Behavior

- Render one controlled shadcn `Tabs` root around the selector and both panels.
- Below the `lg` breakpoint, show a full-width two-column `TabsList` with `Gespräch` and `Prozessbild` triggers.
- The controlled tab value remains `chat | diagram`.
- Selecting `Prozessbild` clears `diagramUnread`; selecting `Gespräch` does not.
- Keep an `aria-hidden` unread dot in a fixed-width slot in the `Prozessbild` trigger so it neither changes the accessible name nor shifts the label.
- Use `activationMode="manual"` so arrow-key focus does not activate a view or trigger a reload until Enter or Space is pressed.
- Wrap both cards with `TabsContent`. A `matchMedia` listener leaves the inactive panel unmounted below `lg`, preventing hidden React Flow initialization; at `lg` and above, it force-mounts both panels while CSS shows them in separate columns and hides the tab list.
- Clicking a diagram mention continues to select `Gespräch` and focuses the composer.
- The pre-existing desktop unread-state behavior is outside this visual-control migration.
- Do not change chat, upload, confirmation, or process-diagram behavior.

## Files To Change

- `apps/web/src/components/ui/tabs.tsx`
  - Add the local shadcn-style `Tabs`, `TabsList`, `TabsTrigger`, and `TabsContent` wrappers backed by the installed Radix Tabs primitive.
- `apps/web/src/pages/process-chat-page.tsx`
  - Replace the two responsive buttons with a controlled `Tabs` root, a full-width `TabsList`, two `TabsTrigger` controls, and force-mounted `TabsContent` panels.
- `tests/chat-ui.test.ts`
  - Add source-contract coverage for the shadcn tabs integration and retained unread reset behavior.

## Verification

- `./scripts/qa changed`
- `./scripts/qa all`
- Required release build through `./scripts/qa release`
- Chrome desktop: both panels remain visible and the tabs are hidden.
- Chrome tablet: the segmented tabs switch between exactly one visible panel; the active state is clear; selecting `Prozessbild` clears its unread dot.
- Chrome mobile below 640 px: both German labels fit without overflow or layout shift.
- Chrome tablet: mentioning a diagram step switches the active tab back to `Gespräch` and focuses the composer.
- Chrome inspection: no console errors and no failed relevant network requests.

## Acceptance Criteria

- The view selector uses the shared shadcn/Radix Tabs primitive rather than independent buttons.
- Radix supplies complete tab/tabpanel ARIA relationships, roving keyboard focus, and manual activation.
- Existing responsive and unread behavior remains intact.
- Source-contract tests cover integration structure; responsive visibility, keyboard behavior, and unread behavior are verified manually in Chrome.
