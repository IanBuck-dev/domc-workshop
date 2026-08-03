# Wayfinder Map: Chat-first Process Capture V1

Type: wayfinder:map
Status: resolved

## Destination

Reach a decision-complete, implementation-ready specification for an end-to-end Chat Capture V1 that is the default process-input experience, preserves Form Capture as an alternative, and produces the same confirmed Process Understanding consumed by automatic Opportunity Discovery.

## Notes

- Planning artifacts and implementation specifications are written in English; all normal UI copy is German.
- Consult the `wayfinder` and `domain-modeling` skills in every session working this map.
- The current form implementation and `ProcessUnderstanding` domain contract remain active and reusable.
- Historical reference commit `16a31dc` contains the earlier Vercel AI SDK chat implementation. Reuse its integration lessons, not its obsolete domain model or styling.
- Chat Capture is the default immutable Interaction Mode; Form Capture remains selectable on the setup page. V1 has no mode switching or automatic cross-mode duplication.
- The setup page keeps the four current cover fields and adds a two-card Interaction Mode selector at the bottom.
- V1 is a real end-to-end slice: tutorial, upload gate, Claude document processing, persistent chat, evolving diagram, contextual corrections, confirmation, and automatic Opportunity Discovery all operate against real local data.
- Use Vercel AI SDK with `@ai-sdk/react`, `ai`, and `ai-sdk-provider-claude-code` against the authenticated local Claude subscription.
- Each Chat Capture owns one continuous resumable Claude session. A Claude subprocess runs only for an explicit message, retry, or initial document-analysis action. Page views never resume Claude.
- If resumption fails, create a replacement session from the persisted transcript, uploads, working JSON, and last valid Process Understanding.
- V1 assumes one active chat client and turn per Process Capture. The UI disables its own composer while active; no backend lock or queue is added.
- Claude directly writes the process-scoped `process-understanding.json` file with filesystem tools. The backend watches the file and exposes an updating state while it is invalid.
- Before the first valid JSON, show a pending diagram skeleton. During later invalid writes, retain the last valid diagram and disable confirmation until a new valid snapshot is available.
- Both Interaction Modes produce the existing shared `ProcessUnderstanding` contract. The Chat Capture diagram renders only step order, name, short activity, and derived linear Transitions in V1.
- Use `@xyflow/react` as a controlled, read-only diagram renderer. V1 derives horizontal nodes and edges from ordered steps; pan, zoom, focus, and mention targeting are enabled while manual graph editing is disabled.
- Hovering a Process Step or Transition exposes a chat icon. Selecting it inserts a structured mention rendered as `@Schritt-N` or `@Übergang-N-M`; detailed inputs and outputs are not visualized.
- Desktop and tablet landscape use a roughly 42/58 chat/diagram split. Narrow screens use `Gespräch` and `Prozessbild` tabs with update indicators and automatic tab switching for mentions.
- The three-step tutorial covers documents, fachliche Alltagssprache, and diagram review. It is browser-local, completion and skip are remembered automatically, and Settings can reset it.
- The initial fixed upload card blocks the composer. Users batch files and explicitly choose `Unterlagen auswerten` or `Ohne Unterlagen fortfahren`.
- Confirmation is human-owned. `knowledgeGaps` or `conflicts` trigger a second Confirmation Override dialog; assumptions alone do not. No written override reason is required.
- Confirmed Chat Captures are read-only in V1. Both normal confirmation and Confirmation Override show a deterministic German thank-you state and automatically start Opportunity Discovery in the background.
- Confirmation Override marks the source as potentially incomplete but does not prevent hypotheses or scenario generation.
- Preserve existing provenance, evidence, audit, deletion, authentication, process-local sandboxing, SSE operation updates, and demo-data boundaries unless this map explicitly changes them.
- ADR references: [`Use one continuous Claude session per Chat Capture`](../../docs/adr/0001-continuous-chat-capture-session.md) and [`Use React Flow for Process Diagrams`](../../docs/adr/0002-use-react-flow-for-process-diagrams.md).

## Decisions so far

<!-- Closed ticket pointers are appended here as the frontier is resolved. -->

- [Verify the current Vercel AI SDK and Claude session contract](issues/01-current-chat-stack-contract.md) — Pin AI SDK 7.0.48/React 4.0.51/provider 4.0.1; resume Claude by captured session ID, recover with an application-owned replacement, and keep cancellation and raw file writes behind validated boundaries.
- [Fix the German Chat Capture workspace experience](issues/02-chat-workspace-ux.md) — Use a blocking document-first chat beside a last-valid linear React Flow diagram, with persisted tutorial, typed mentions, responsive tabs, and explicit confirmation states.
- [Define the Chat Capture domain and persistence contract](issues/03-chat-domain-and-persistence.md) — Add immutable interaction mode and confirmation quality, process-local transcript/session/contracts, raw working JSON plus an atomic last-valid snapshot, and mode-safe APIs.
- [Define automatic Opportunity Discovery handoff](issues/04-automatic-opportunity-handoff.md) — Finalize chat confirmation durably before calling the shared opportunity service; preserve confirmation if queueing fails and recover from the process detail module.

## Not yet specified

- The exact versioned Chat Capture role, tool-use instructions, concise German response rules, and document-first elicitation prompt will be tuned after the V1 interaction and persistence contracts are fixed.
- V2 validation through an application-owned structured write tool will replace raw filesystem writes after the prototype experience is tested.

## Out of scope

- Branches, loops, parallel paths, transition metadata, and graph authoring.
- Manual editing of Chat Capture diagrams, steps, inputs, outputs, information, or decisions.
- Rendering inputs, outputs, information, decisions, provenance, or evidence inside the V1 diagram.
- Persistent diagram comment threads, an unresolved-comment inbox, and multi-user collaboration.
- Backend concurrency locks, distributed queues, and multiple simultaneous tabs for one Chat Capture.
- Reopening a confirmed Chat Capture.
- Mode switching and automatic duplication into the other Interaction Mode.
- Opportunity scoring, financial assessment, prioritization, scenario editing, and recalculation.
- Final prompt-quality optimization, exhaustive edge-case interviews, and adversarial-user recovery.
