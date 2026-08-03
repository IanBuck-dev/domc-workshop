# Define the Chat Capture domain and persistence contract

Type: grilling
Status: resolved
Blocked by: 01, 02

## Question

What exact Interaction Mode, capture state, chat-message, mention-reference, tutorial preference, Claude-session, working-file, last-valid-snapshot, confirmation outcome, audit, deletion, recovery, and event contracts let Chat Capture coexist with Form Capture while both produce the same `ProcessUnderstanding`?

The decision must include process-directory files, Zod schemas, allowed state transitions, API and SSE boundaries, raw-write validation timing, failure and retry behavior, and backward-compatible handling of existing form records.

## Answer

The immutable mode, confirmation quality, chat state/transcript/session schemas, process-directory layout, raw-write/last-valid boundary, APIs, session recovery, legacy migration, sandbox contract, and tests are specified in [Chat Capture V1 Implementation Plan](../../../docs/plans/chat-capture-v1.md#domain-contracts).
