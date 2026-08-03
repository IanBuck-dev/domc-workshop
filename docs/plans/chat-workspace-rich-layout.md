# Rich Chat Capture Workspace Implementation Plan

## Goal

Replace the current card-based Chat Capture workspace with a focused, streaming-aware desktop experience: a free-flowing six-column conversation, a compact sticky Process Tracker, and an expandable full Process Diagram. Use the official React shadcn/ui Message Scroller as the page-level application viewport so streamed turns remain anchored without custom scroll bookkeeping. Preserve the existing Chat Capture domain, persisted transcript, confirmation flow, Claude session behavior, Form Capture alternative, and downstream Opportunity Discovery start.

The interface remains German. Internal contracts, code, and tests remain English.

## Locked Decisions

- At `xl` (`1280px`) and above, the collapsed layout is `3/12 empty focus space + 6/12 chat + 1/12 gap + 2/12 Process Tracker`.
- At `xl` and above, expansion changes the layout to `4/12 chat + 8/12 Process Diagram`; it moves and narrows the chat and never overlays it.
- Expansion is local React state only. It resets on reload, route change, and remount; no browser or backend persistence is added.
- Below `1280px`, keep the existing manually activated `Gespräch` and `Prozessbild` tabs. The selected tab and unread indicator remain local state.
- The transcript is visually free-flowing: assistant output sits directly on the page background; user messages are compact, right-aligned, muted bubbles. Only interactive upload/document actions remain cards.
- The complete application area below the current application chrome (global navigation plus the visible demo-data warning) is the height-constrained Message Scroller viewport. Its scrollbar is at the outer right edge and serves as the page scroll experience; do not introduce a second chat-only scrollbar.
- User messages start turns and are Message Scroller anchors. Keep 64px of the prior turn visible. Follow streamed output only while the reader is at the live edge. Scrolling away releases follow mode. The supplied Message Scroller button returns to the latest content and re-enables follow mode.
- No virtual scrolling, pagination, or history prepending is added.
- The composer remains visible at the bottom of the chat column while the workspace scrolls. Existing mention, attachment, Enter/Shift+Enter, send, stop, disabled, and error behavior stays intact.
- The page heading row shows process identity on the left and exactly one status badge on the right: `KI arbeitet …`, `Bereit für Ergänzung`, `Abgeschlossen`, or `Mit offenen Punkten bestätigt`.
- A running turn displays one transient Chat Activity. If no specific activity is active, display `Denkt nach …`.
- Specific activity labels are fixed application copy: `Unterlagen werden ausgewertet …`, `Prozessbild wird aktualisiert …`, and `Offene Punkte werden geprüft …`.
- Never render raw model reasoning, pre-tool narration, tool input, tool output, file paths, shell output, prompts, JSON, compaction summaries, or model/runtime terminology.
- Keep the successfully persisted final assistant reply as the only model-authored answer exposed to the browser. Do not token-stream raw Claude text in this change.
- The compact Process Tracker is a narrow orientation view of the same Process Understanding, not a second artifact. It shows ordered steps and transitions, the current update state, mention actions, confirmation, and an expand action.
- The expanded Process Diagram uses the existing React Flow rendering, zoom/pan controls, arrowheads, non-overlapping vertical nodes, and step/transition mentions.
- The compact tracker action is `Bestätigen`; the expanded and responsive action remains `Prozessbild bestätigen`.
- Expansion is available for missing, invalid, valid, active, and confirmed diagrams so loading and empty states can be inspected.
- Resizing below `1280px` resets expansion to `false`. Returning to desktop remains collapsed. Selecting a mention from an expanded diagram keeps the diagram expanded and focuses the still-visible chat composer.

## User Experience Contract

### Desktop collapsed state (`>=1280px`)

The application viewport begins directly below the global navigation and fills the remaining dynamic viewport height.

```text
columns  1–3             4–9                       10       11–12
         focus space     conversation              gap      Process Tracker
```

- The process heading aligns with the six-column conversation.
- The conversation has no enclosing Card, panel header, border, or pane label.
- The Process Tracker is sticky below the process heading, uses the available viewport height, and has its own compact header containing `Prozessbild` and the expand icon. Its step list may scroll internally when the available height is insufficient; this is the sole desktop nested scroll region.
- The tracker renders a vertical numbered step list. Long names use two-line truncation with a title tooltip. A thin arrowed transition separates adjacent steps.
- Hover and keyboard focus reveal a chat icon on every step and transition. Activating it adds the existing typed mention and focuses the composer.
- The tracker footer remains visible and contains the confirmation action or the existing confirmed-state destinations.
- With no valid understanding, render the compact loading/empty state and keep expansion available. During an invalid working write, retain the last valid compact tracker when one exists.

### Desktop expanded state (`>=1280px`)

```text
columns  1–4                       5–12
         narrowed conversation     full Process Diagram workspace
```

- Replace the compact tracker with the full React Flow canvas.
- The collapse action occupies the same top-right location as the expand action.
- The full diagram workspace stays sticky within the application viewport.
- The chat remains fully functional at four columns; user bubbles, upload cards, Markdown, attachments, mentions, and composer wrap without horizontal overflow.

### Responsive state (`<1280px`)

- Render the existing full-width shadcn Tabs selector.
- The chat tab uses the Message Scroller behavior and free-flow message styling.
- The diagram tab renders the full React Flow workspace and full confirmation label.
- Preserve the unread dot when a new valid diagram revision arrives while the chat tab is active.
- Do not render the compact Process Tracker or expansion control.

### Streaming and activity state

For every submitted turn:

1. Immediately show `Denkt nach …` when `useChat.status` is `submitted` or `streaming` and no specific Chat Activity is active.
2. Replace the fallback with a fixed specific label when a safe transient `data-chat-activity` event arrives.
3. Update the label in place; do not append one transcript row per tool event.
4. Apply live `data-understanding-state` revisions to the page view and tracker/diagram without waiting for the final assistant answer.
5. Clear the specific activity when the server emits `idle`, the stream finishes, is stopped, or errors. The fallback also disappears when `useChat` returns to `ready` or `error`.
6. Render the activity as a small shadcn Marker/Spinner row with `role="status"`; set the transcript log to `aria-busy="true"` while the turn runs.

Safe event mapping:

| Runtime signal                                                                                          | Chat Activity                     |
| ------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Turn active with no mapped signal                                                                       | `Denkt nach …`                    |
| `Read` or `Glob` during `analyze_documents`, or initial document processing before the first tool event | `Unterlagen werden ausgewertet …` |
| A working-file change is detected or a `Write` tool call starts                                         | `Prozessbild wird aktualisiert …` |
| Provider generation has ended and final reconciliation/persistence is running                           | `Offene Punkte werden geprüft …`  |

`Bash`, reasoning, text deltas, tool results, errors, provider status, and compaction do not receive a direct UI representation. They leave the current specific activity unchanged or fall back to `Denkt nach …`.

## Message and Stream Contracts

Add strict schemas to `packages/domain/src/chat-capture.ts`:

```ts
ChatActivityKind =
  | "reading_documents"
  | "updating_diagram"
  | "checking_open_points";

ChatActivityEvent =
  | {
      schemaVersion: 1;
      state: "active";
      kind: ChatActivityKind;
      timestamp: string;
    }
  | {
      schemaVersion: 1;
      state: "idle";
      timestamp: string;
    };

ChatUnderstandingEvent = {
  status: "missing" | "invalid" | "valid";
  revision?: string;
  timestamp: string;
};
```

The browser message type is:

```ts
type ProcessChatUIMessage = UIMessage<
  never,
  {
    "chat-activity": ChatActivityEvent;
    "understanding-state": ChatUnderstandingEvent;
  }
>;
```

- Both custom data types use runtime Zod validation before client state changes. Invalid inbound data parts are ignored and leave the UI on the derived `Denkt nach …` fallback; they never fail or terminate the turn.
- Every `data-chat-activity` write includes `transient: true`; it is consumed only through `useChat.onData` and is never added to `message.parts` or the persisted transcript.
- Every `data-understanding-state` write, including the duplicate-turn branch, includes `transient: true`. A valid revision triggers one passive `GET /api/processes/:id/chat` refresh guarded by revision equality.
- Split the current page reload into `reloadView({ syncMessages: boolean })` and `syncTranscript()`. Mid-stream revision refreshes update only `view`, upload inventory, and diagram state and must not call `chat.setMessages`. Initial load and terminal `ready`, stopped, and error outcomes synchronize the persisted transcript exactly once.
- The persisted transcript remains `ChatTranscriptEvent[]` with user and final assistant messages only.
- No activity, reasoning, tool call, or compaction event is added to `transcript.jsonl`.

## Server Streaming Design

Refactor `POST /api/processes/:id/chat` in `apps/server/src/routes/chat-captures.ts` around one stream coordinator:

1. Emit `reading_documents/active` with `transient: true` immediately for `analyze_documents`; all other actions begin without a specific event so the client shows `Denkt nach …`.
2. Consume `active.result.fullStream` exactly once instead of calling `consumeStream`. A provider error chunk or thrown stream error aborts normal finalization, invokes the existing failed/aborted persistence path exactly once, and reaches the existing generic UI error response.
3. Ignore provider text and reasoning chunks completely.
4. On `tool-call` or `tool-call-streaming-start`, inspect `toolName` and, only for `Write`, the target path server-side:
   - `Read`/`Glob` during document analysis -> `reading_documents/active`.
   - `Write` whose normalized target is the process root `process-understanding.json` -> `updating_diagram/active`.
   - every other tool -> no event.
5. Never serialize tool inputs, target paths, results, reasoning, or provider text into the UI stream, logs intended for users, or error responses. `Bash` remains unmapped; file changes produced through it are detected by reconciliation.
6. Keep the existing 350ms reconciliation loop. When the working-file status or valid revision changes, emit `updating_diagram/active` followed by the existing safe understanding state.
7. After the provider stream finishes, emit `checking_open_points/active`, call `finishTurn`, persist the session and final assistant event, then emit the single final text part.
8. Emit `idle` with `transient: true` in `finally`; retain the current failure/abort persistence and generic error response. The duplicate-turn branch emits its current understanding state and then `idle` without starting Claude.
9. Continue publishing `process-changed` only after a successful persisted turn.

`ChatCaptureService.finishTurn` continues to resolve `text`, `finalStep`, and `finishReason` after the coordinated stream consumption. Replace the API-test fake with a real async `fullStream` fake whose text/final-step/finish promises resolve only after the stream completes. This proves the consumption order and demonstrates that provider text/reasoning/tool payloads never appear in the browser stream while safe activity types, understanding revisions, and the final persisted answer do.

## Component Structure

### shadcn components

Install the official React components into the repository using the configured shadcn registry:

```sh
bunx --bun shadcn@latest add message-scroller message marker spinner
```

Retain only the generated components required by the workspace. This is a source distribution into `apps/web/src/components/ui`; do not add Vue packages, AI Elements, or a second styling system. Pin any generated runtime dependency added by the CLI in `package.json` and `bun.lock`.

Registry availability was verified on 2026-08-03 with `bunx --bun shadcn@latest view`: `message-scroller` resolves to the React `registry/new-york-v4/ui/message-scroller.tsx` wrapper and depends on `@shadcn/react`; `message`, `marker`, and `spinner` resolve in the same registry. Installation must be reviewed for unintended rewrites to `components.json`, `apps/web/src/styles.css`, or existing primitives; restore any unrelated CLI rewrite while keeping the generated components and required dependency.

Configure `MessageScrollerProvider` with:

```tsx
autoScroll
defaultScrollPosition="last-anchor"
scrollPreviousItemPeek={64}
```

Every persisted user and assistant message is wrapped in `MessageScrollerItem` with its stable transcript ID. Set `scrollAnchor={message.role === "user"}`. The activity indicator and document gate are items without anchors. Render `MessageScrollerButton direction="end"` with the German accessible label `Zur neuesten Nachricht`.

Before the server refactor, build a minimal real-page composition using `MessageScrollerViewport` as the full content region below the application chrome, with nested `MessageScrollerItem` rows in the chat column and the tracker as a sticky grid sibling. Verify in Chrome that anchoring, sticky positioning, and a bounded React Flow canvas work together. The implementation must use a zero-gap 12-column grid: column 10 is the explicit gap, not a CSS `gap` value.

### page and extracted components

- `ProcessChatPage` owns data loading, `useChat`, responsive tab state, expansion state, mentions, upload selection, confirmation, and dialogs.
- Extract `ProcessChatTranscript` to render Message Scroller items, restricted Markdown, document gate, and transient activity.
- Extract `ProcessChatComposer` to preserve the current attachment, mention, keyboard, send, stop, disabled, and error behavior while providing the sticky bottom surface.
- Add `ProcessTracker` for the compact ordered overview and compact confirmation footer.
- Keep `ProcessFlowDiagram` as the full canvas renderer. Add a presentation prop only where needed for expanded/responsive height and toolbar placement; do not duplicate graph construction.
- Extract a shared `ProcessConfirmationActions` so compact, expanded, and responsive surfaces use identical enabled/disabled logic and confirmed destinations with different button labels.
- `AppShell` detects the Chat Capture route and makes the authenticated shell `h-dvh overflow-hidden flex flex-col`; its navigation and optional demo warning retain natural height and `main` becomes `min-h-0 flex-1`. Other routes retain their current document layout. This gives the Message Scroller a definite remaining height even while the demo warning is visible or dismissed.
- The composer is an overlay sibling of the viewport aligned to the active chat columns. Observe its dynamic height with `ResizeObserver`, expose it as `--chat-composer-height`, and apply matching `scroll-padding-bottom` plus transcript bottom padding. Mention chips, attachment chips, errors, and textarea growth must never cover the last message or alter the user-turn anchor position.

## State Derivation

Derive the page badge without persistence:

```text
confirmationQuality == with_gaps     -> Mit offenen Punkten bestätigt
processState == confirmed            -> Abgeschlossen
chat status submitted/streaming      -> KI arbeitet …
otherwise                            -> Bereit für Ergänzung
```

Derive the activity row:

```text
not busy                             -> hidden
busy + active safe activity          -> fixed label for activity kind
busy + no active safe activity       -> Denkt nach …
```

`expanded` initializes to `false` on every mount and is never read from or written to `localStorage`, `sessionStorage`, URL parameters, process files, or server state.

The document gate replaces the composer until the required upload/skip action completes. A confirmed capture replaces the composer with its deterministic completed-state actions. Both remain non-anchor Message Scroller rows and reserve the same bottom safe area.

Accessibility uses one transcript live region supplied by `MessageScrollerContent` (`role="log"`). The page status badge is not live. The transient activity row alone uses `role="status"`; `aria-busy` suppresses token-by-token announcements, and the completed assistant row is announced once when synchronized.

## Files To Change

### Documentation

- `CONTEXT.md` — add `Chat Activity` and retain `Process Tracker` as the compact view of the same artifact.
- `docs/adr/0001-continuous-chat-capture-session.md` — record the safe activity translation boundary and continued suppression of raw provider output.
- `docs/plans/chat-workspace-rich-layout.md` — this implementation contract.

### Dependencies and generated UI primitives

- `package.json` — add the exact Message Scroller runtime dependency generated by the shadcn CLI.
- `bun.lock` — lock the dependency graph.
- `apps/web/src/components/ui/message-scroller.tsx` — generated React shadcn Message Scroller wrapper.
- `apps/web/src/components/ui/message.tsx` — generated message row primitive used without assistant bubbles.
- `apps/web/src/components/ui/marker.tsx` — generated accessible activity row.
- `apps/web/src/components/ui/spinner.tsx` — generated activity indicator.

### Shared contracts and server

- `packages/domain/src/chat-capture.ts` — strict Chat Activity schemas/types.
- `apps/server/src/chat-capture-service.ts` — export/reuse the understanding event type and keep finalization compatible with coordinated full-stream consumption.
- `apps/server/src/routes/chat-captures.ts` — safe provider-event translation, activity events, live revision publication, final answer publication, and idle cleanup.

### Web application

- `apps/web/src/lib/process-types.ts` — re-export the Chat Activity and understanding-event types plus their runtime schemas as value exports, and declare the typed UI message contract used by `transcriptMessages`, `DefaultChatTransport`, and `useChat`.
- `apps/web/src/pages/process-chat-page.tsx` — new responsive 12-column workspace, application-level Message Scroller viewport, status badge, ephemeral expansion state, and live data handling.
- `apps/web/src/components/app-shell.tsx` — route-scoped definite-height shell for the Chat Capture viewport without changing other page scrolling.
- `apps/web/src/components/process-chat-transcript.tsx` — free-flow transcript and Message Scroller item composition.
- `apps/web/src/components/process-chat-composer.tsx` — sticky composer extracted from the current page.
- `apps/web/src/components/process-tracker.tsx` — compact sticky step/transition orientation view.
- `apps/web/src/components/process-confirmation-actions.tsx` — shared confirmation and confirmed-state actions.
- `apps/web/src/components/process-flow-diagram.tsx` — expanded/responsive sizing hooks without changing graph semantics.

### Tests

- `tests/chat-domain.test.ts` — accept valid Chat Activity events and reject unknown kinds, extra fields, and malformed timestamps.
- `tests/chat-api.test.ts` — use an async full-stream fake and assert safe activity order, transient flags, live understanding revisions, final text, duplicate/idle cleanup, provider-error handling, and suppression of provider reasoning/tool payloads.
- `tests/chat-ai-contract.test.ts` — replace the obsolete `consumeStream`/no-`fullStream` assertion with exact single full-stream consumption and forbidden raw merge assertions; pin the Message Scroller runtime dependency.
- `tests/chat-ui.test.ts` — assert the `xl` breakpoint, collapsed/expanded column contracts, ephemeral expansion state, responsive tabs, Message Scroller configuration, user-turn anchors, safe fallback/activity labels, free-flow assistant styling, and compact/full confirmation labels.

## Implementation Sequence

1. Add the shadcn React primitives, pin their generated dependency versions, and review CLI changes for unrelated rewrites.
2. Build and Chrome-check the actual page-level Message Scroller, sticky tracker placeholder, bounded diagram, and measured composer composition at desktop and tablet widths.
3. Add and test the discriminated Chat Activity stream contract.
4. Replace the API fake and refactor the server route to consume the provider full stream once and emit only safe transient activities, validated understanding states, and the persisted final response.
5. Add typed `useChat.onData` handling, split mid-stream view refresh from transcript synchronization, and cover stopped/error recovery.
6. Extract transcript and composer components and complete Message Scroller composition at the application-content viewport.
7. Add the compact Process Tracker and shared confirmation actions.
8. Implement the `xl` collapsed/expanded grid, breakpoint-reset behavior, and responsive Tabs path.
9. Run focused tests, full QA, release build, and browser verification.

## Hard Verification Goals

### Automated

Run during implementation:

```sh
./scripts/qa test tests/chat-domain.test.ts
./scripts/qa test tests/chat-api.test.ts
./scripts/qa test tests/chat-ai-contract.test.ts
./scripts/qa test tests/chat-ui.test.ts
./scripts/qa changed
```

Before handoff:

```sh
./scripts/qa all
bun run build:release
```

All commands must exit zero. The release build must contain the web bundle and server executable without unresolved shadcn or `@shadcn/react` imports.

### Desktop browser (`1440x900` or wider)

- The collapsed grid measures 25% empty space, 50% chat, 8.33% gap, and 16.67% tracker within the workspace content width.
- The 12-column grid has no CSS gap; the explicit tenth column provides the full 1/12 separation, so the percentage contract is exact within normal subpixel rounding.
- The scrollbar is at the application viewport's far-right edge; there is no nested transcript scrollbar.
- Sending a message anchors that user row near the top with visible prior-turn context.
- While following the live edge, streamed activity/diagram changes remain visible. Scrolling upward prevents forced movement. The scroll button returns to the latest content and resumes following.
- `Denkt nach …` appears immediately when a turn starts and no specific activity is active.
- Specific activity replaces the fallback without appending permanent transcript rows.
- No raw tool name, path, JSON, shell output, provider reasoning, or compaction text appears in the DOM, accessibility tree, console, or network response body.
- A valid working-file revision updates the tracker/full diagram before the final assistant response completes.
- Expanding produces a 4/12 chat and 8/12 full diagram without overlay or horizontal overflow. Collapsing restores the 3/6/1/2 layout.
- Reloading while expanded returns to collapsed mode.
- Resizing below `1280px` returns to tabs and clears expansion; resizing back returns to the collapsed desktop layout.
- Step and transition mention actions work in compact and expanded views and focus the composer.
- Confirmation uses `Bestätigen` in the compact tracker and `Prozessbild bestätigen` in the full view; both trigger the same override behavior.

### Responsive browser (`1024x768` and `768x1024`)

- The compact tracker and expansion action are absent.
- `Gespräch` and `Prozessbild` tabs remain keyboard-operable with manual activation.
- Chat and diagram each use the available width without clipping.
- The diagram unread indicator appears after a new valid revision while `Gespräch` is active and clears on opening `Prozessbild`.
- The composer remains reachable and does not cover the final transcript content.

### Regression and diagnostics

- Initial document upload, preview, selection, analysis, and skip actions remain blocking and functional.
- Stop, failure, retry/recovery, confirmation override, final confirmation, and automatic Opportunity Discovery start retain existing behavior.
- Stopping or failing a turn synchronizes the persisted deterministic assistant outcome into the visible transcript after the stream reaches its terminal state.
- Existing Form Capture routes and UI are unchanged.
- Chrome DevTools filtered console contains no uncaught errors or accessibility warnings attributable to the change.
- Chrome DevTools failed-network inspection contains no unexpected 4xx/5xx request.

## Expected Output

- A focused Chat Capture page matching the agreed collapsed and expanded layouts.
- Stable shadcn-managed streaming scroll behavior with no custom scroll anchoring implementation.
- Safe live operational feedback, including the `Denkt nach …` fallback, without exposing internal model behavior.
- A compact Process Tracker that keeps the evolving process visible and opens the existing full diagram workspace.
- No changes to the stored Process Understanding, persisted transcript semantics, confirmation rules, Claude session lifecycle, or Opportunity Discovery domain behavior.
