# Verify the current Vercel AI SDK and Claude session contract

Type: research
Status: resolved
Blocked by:

## Question

Which current package versions and APIs should Chat Capture V1 use for React `useChat`, Hono streaming transport, Claude CLI session creation/resumption/replacement/deletion, session-ID capture, cancellation, filesystem tools, and provider metadata under Bun, and which assumptions from historical commit `16a31dc` are now obsolete?

The answer must rely on current primary documentation and source, identify exact package-version compatibility, and produce an implementation-facing note under `docs/research/`.

## Answer

Use `ai@7.0.48`, `@ai-sdk/react@4.0.51`, and `ai-sdk-provider-claude-code@4.0.1`; the current transport, session lifecycle, cancellation, file-tool, Bun, and migration contract is recorded in [Chat Capture V1: current chat-stack contract](../../../docs/research/CHAT-CAPTURE-CURRENT-STACK.md).
