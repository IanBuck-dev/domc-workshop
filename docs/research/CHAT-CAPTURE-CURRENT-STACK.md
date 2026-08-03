# Chat Capture V1: current chat-stack contract

Research date: 2026-08-02. Sources are current first-party documentation and source from Vercel, Anthropic, and the provider repository.

## Decision

Pin this compatible tuple exactly:

| Package                       |  Version | Compatibility evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------- | -------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai`                          | `7.0.48` | The release manifest is AI SDK 7 and requires Node `>=22`; it accepts Zod 3.25.76+ or 4.1.8+ ([Vercel manifest](https://github.com/vercel/ai/blob/3bc0d4f40df7a77af4b181bc97dc1c54843545ab/packages/ai/package.json)).                                                                                                                                                                                                                                                    |
| `@ai-sdk/react`               | `4.0.51` | This release depends exactly on `ai: 7.0.48` and supports React 18 plus the listed React 19 lines ([Vercel manifest](https://github.com/vercel/ai/blob/3bc0d4f40df7a77af4b181bc97dc1c54843545ab/packages/react/package.json)).                                                                                                                                                                                                                                            |
| `ai-sdk-provider-claude-code` |  `4.0.1` | Provider 4.x is the AI SDK 7 line; 4.0.1 depends on provider v4 utilities, pins `@anthropic-ai/claude-agent-sdk` to `0.3.205`, requires Zod `^4.1.8`, is ESM-only, and declares Node `>=22` ([provider manifest](https://github.com/ben-vargas/ai-sdk-provider-claude-code/blob/0bae2dd84172bedf4528fd2b1708e3875087e7e1/package.json), [v4 compatibility notes](https://github.com/ben-vargas/ai-sdk-provider-claude-code/blob/v4.0.1/README.md#version-compatibility)). |

Do not add the Agent SDK directly. The provider intentionally pins `0.3.205` exactly because upstream type releases have drifted; use the provider's tested transitive version ([provider Agent SDK notes](https://github.com/ben-vargas/ai-sdk-provider-claude-code/blob/v4.0.1/README.md#claude-agent-sdk-03x-notes)).

## React and Hono transport

Keep the transport architecture already demonstrated in the historical implementation:

- React owns input state. `useChat` no longer owns it; configure `useChat({ id, messages: initialMessages, transport: new DefaultChatTransport({ api }) })`, render `message.parts`, send with `sendMessage({ text })`, and gate the composer from `status` ([`useChat` reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat), [current chatbot example](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot)).
- `DefaultChatTransport` POSTs UI messages to the configured endpoint. The Hono handler must runtime-validate the received `UIMessage[]`; `validateUIMessages`/`safeValidateUIMessages` are the current persistence-boundary APIs, and `convertToModelMessages` is the current conversion when a provider needs the whole UI transcript ([message persistence guide](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence)).
- Hono may return the standard Web `Response` produced by `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })` directly. When custom data parts are needed, use `createUIMessageStream`, `writer.write({ type: 'data-…', data })`, `writer.merge(toUIMessageStream({ stream: result.stream }))`, and `createUIMessageStreamResponse({ stream })` ([official Hono recipe](https://ai-sdk.dev/cookbook/api-servers/hono), [`createUIMessageStream` reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/create-ui-message-stream)). The older result method `result.toUIMessageStreamResponse()` and `result.fullStream` remain available in 7.0.48 but their package types mark both deprecated; do not introduce them in V1 ([AI SDK 7 type contract](https://unpkg.com/ai@7.0.48/dist/index.d.ts)).
- Chat Capture resumes the **Claude session**, not an interrupted browser SSE stream. Keep `useChat` stream resumption off (its default), because `stop()`/page abort and `useChat({ resume: true })` are explicitly incompatible ([Vercel limitation](https://ai-sdk.dev/docs/troubleshooting/abort-breaks-resumable-streams)).

For a resumed Claude session, validate the complete client payload for trust and persistence, but send only the new turn plus any deliberately selected application recovery context to Claude. Re-sending the complete chat transcript into a session that already contains it duplicates context; Anthropic defines `resume` as restoring that session's full prior conversation ([Anthropic session semantics](https://code.claude.com/docs/en/agent-sdk/sessions)).

## Claude session lifecycle

Use an application-generated UUID for the first call and persist it before spawning Claude:

```ts
const settings = firstTurn
  ? { sessionId: activeSessionId }
  : { resume: activeSessionId };

const result = streamText({
  model: claudeCode(modelId, {
    ...settings,
    cwd: processDirectory,
    persistSession: true,
    settingSources: [],
  }),
  prompt: turnPrompt,
});

const actualSessionId = (await result.finalStep).providerMetadata?.[
  "claude-code"
]?.sessionId;
```

`sessionId` creates a new session with a chosen UUID; `resume` restores a specific persisted session. They are mutually exclusive unless forking. For streaming, the documented capture point is `(await result.finalStep).providerMetadata['claude-code'].sessionId`; `generateText` uses `result.finalStep` ([provider session guide](https://github.com/ben-vargas/ai-sdk-provider-claude-code/blob/v4.0.1/docs/sessions.md#session-settings)). Persist and compare the returned ID rather than assuming the requested ID was honored.

Replacement is an application workflow; there is no `replaceSession` API. If resume fails:

1. Generate and persist a new UUID as the active candidate.
2. Start a fresh session with `sessionId: candidateId` and one bounded recovery prompt containing only the repository-persisted transcript, upload inventory/evidence, current working JSON, and last valid Process Understanding.
3. Capture the returned ID, atomically make it active, and audit the old-to-new relationship.
4. Delete the old transcript only after the replacement is durable, or retain its ID until process deletion.

This follows Anthropic's documented robust fallback: when session files cannot be resumed, pass the necessary application state into a fresh session ([resume-across-hosts guidance](https://code.claude.com/docs/en/agent-sdk/sessions#resume-across-hosts)). Provider 4.0.1 re-exports `getSessionInfo`, `getSessionMessages`, `forkSession`, and `deleteSession`; `deleteSession(id, { dir: processDirectory })` removes the persisted transcript, and `dir` disambiguates per-working-directory storage ([provider helper contract](https://github.com/ben-vargas/ai-sdk-provider-claude-code/blob/v4.0.1/docs/sessions.md#session-helper-functions), [provider exports](https://github.com/ben-vargas/ai-sdk-provider-claude-code/blob/v4.0.1/src/index.ts#L68-L91)). Track every original/replacement ID so process deletion can best-effort delete them all.

## Cancellation and timeouts

Wire both user cancellation and a server limit into `streamText`:

```ts
const result = streamText({
  model,
  prompt,
  abortSignal: c.req.raw.signal,
  timeout: { totalMs: configuredTimeoutMs },
  onAbort: () => {
    /* persist an aborted audit event */
  },
});
```

`useChat.stop()` aborts the fetch. Forwarding the request signal cancels AI SDK Core; AI SDK 7's `timeout` can coexist with `abortSignal`, aborting on either condition ([stopping streams](https://ai-sdk.dev/docs/advanced/stopping-streams), [timeout contract](https://ai-sdk.dev/docs/ai-sdk-core/settings#timeout)). Provider 4.0.1 links the AI SDK signal to the Agent SDK `AbortController`, including its reason ([provider source](https://github.com/ben-vargas/ai-sdk-provider-claude-code/blob/v4.0.1/src/claude-code-language-model.ts#L3459-L3503)). For UI message streams, pass `consumeSseStream: consumeStream` and handle the aborted finish path so cleanup/persistence still runs ([Vercel abort guidance](https://ai-sdk.dev/docs/troubleshooting/stream-abort-handling)). An aborted turn does not imply the persisted Claude session should be deleted; the next explicit user action may resume it.

## File tools and direct JSON writes

Claude Code's built-in `Read`, `Write`, and `Edit` tools execute in the SDK process against the local filesystem; this is not an AI SDK `tools` callback. Provider 4.0.1 explicitly ignores ordinary AI SDK tool definitions and says custom tools require MCP ([provider source](https://github.com/ben-vargas/ai-sdk-provider-claude-code/blob/v4.0.1/src/claude-code-language-model.ts#L1810-L1819)); Anthropic documents built-in file read/write/edit as Agent SDK capabilities ([Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)).

For V1 raw writes, set `cwd` to the process directory, `settingSources: []`, and an explicit Agent SDK tool surface containing only the required file tools. Use `permissionMode: "dontAsk"` with explicit `allowedTools`; `allowedTools` alone only auto-approves and does **not** restrict unlisted tools, while `dontAsk` denies everything not pre-approved ([Anthropic permission evaluation](https://code.claude.com/docs/en/agent-sdk/permissions#allow-and-deny-rules), [TypeScript `Options`](https://code.claude.com/docs/en/agent-sdk/typescript#options)). Do not use `bypassPermissions`: unlisted Bash/Write/Edit calls would still be approved.

The provider and Agent SDK do not promise that `Write`/`Edit` produces schema-valid or atomic JSON. Therefore treat `process-understanding.json` as untrusted file input on every watcher read: parse and runtime-validate it, retain the last valid snapshot while a write is invalid, and record provenance/audit separately. Claude session persistence stores conversation history, not filesystem state ([Anthropic session boundary](https://code.claude.com/docs/en/agent-sdk/sessions)).

## Existing sandbox integration

Do not restore the historical direct local spawn. Provider 4.0.1 exposes `spawnClaudeCodeProcess(options)` specifically for VM, container, and custom-process execution; `SpawnOptions` carries the resolved command, arguments, working directory, environment, and a cancellation signal, while the returned object follows the Node `ChildProcess` stream/lifecycle interface ([provider setting](https://unpkg.com/ai-sdk-provider-claude-code@4.0.1/dist/index.d.ts), [Agent SDK spawn contract](https://unpkg.com/@anthropic-ai/claude-agent-sdk@0.3.205/sdk.d.ts)). Chat Capture must adapt the repository's existing Anthropic Sandbox Runtime command construction to this callback and spawn the provider-selected Claude executable behind `srt`.

The Chat Capture sandbox grants read access to the process uploads and contract snapshot, write access to the working `process-understanding.json` and a process-local temporary directory, plus the existing Claude configuration paths needed for authentication and persisted sessions. Network access remains restricted to Anthropic/Claude endpoints. `Bash` remains available inside this filesystem/network sandbox because real DOCX, PPTX, XLSX, and PDF inputs may require local inspection or conversion; `WebFetch`, `WebSearch`, `Task`, and unrelated writes remain denied. The provider's `pathToClaudeCodeExecutable` must resolve the already installed and authenticated `claude` CLI, avoiding a bundled native-binary dependency in the compiled Pi release.

## Bun boundary

Development under Bun is viable but not an unconditional provider support promise. The Agent SDK auto-detects `bun` as an executable runtime, and it documents a specific supported extraction path for `bun build --compile` using `@anthropic-ai/claude-agent-sdk/extract` (available since 0.3.144, therefore present in the provider's pinned 0.3.205) ([Anthropic TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript#compile-to-a-single-executable)). The provider itself declares `node >=22`, ESM-only output, and its CI tests Node 22/24 rather than Bun ([provider manifest](https://github.com/ben-vargas/ai-sdk-provider-claude-code/blob/v4.0.1/package.json), [provider CI](https://github.com/ben-vargas/ai-sdk-provider-claude-code/blob/v4.0.1/.github/workflows/ci.yml)).

Decision: use Bun for install/dev/build as required by this repository, keep optional platform dependencies (the Agent SDK now ships a native Claude binary), and add an authenticated Bun smoke test. For compiled release binaries, extract the platform binary from BunFS and pass `pathToClaudeCodeExecutable`; do not assume ordinary `require.resolve` works inside BunFS ([provider native-binary note](https://github.com/ben-vargas/ai-sdk-provider-claude-code/blob/v4.0.1/README.md#per-platform-native-binaries), [Anthropic Bun compile instructions](https://code.claude.com/docs/en/agent-sdk/typescript#compile-to-a-single-executable)).

## What is obsolete in `16a31dc`

The commit's overall `useChat` + `DefaultChatTransport` + Hono `Response` shape remains current. Retire these details:

- Upgrade `ai` `7.0.28` -> `7.0.48` and `@ai-sdk/react` `4.0.30` -> `4.0.51`; keep provider `4.0.1`. The newer React package pins the newer core exactly (manifests linked in the version table).
- Do not run a second `persistSession: false` extraction call after every interview answer. Chat Capture V1 owns one resumable session and Claude writes the working JSON through its bounded filesystem tools.
- Do not leave `Write` and `Edit` disabled, and do not grant `Bash` merely to read documents. Use the explicit file-tool surface and `dontAsk` permission contract above.
- Use the standalone `createUIMessageStreamResponse` helper instead of deprecated result response helpers. Chat Capture consumes `result.stream` for provider completion and cancellation but deliberately does not merge it verbatim into the browser stream: Claude can emit internal pre-tool narration. The route publishes the accepted application transcript reply and typed understanding-state events instead.
- Do not rely only on `AbortSignal.timeout(...)`. Forward `c.req.raw.signal`, use the current `timeout` option, and configure UI-stream consumption so `stop()` reaches the Claude subprocess and cleanup runs.
- Do not ignore provider metadata or infer session creation only from an application flag. Persist/verify `finalStep.providerMetadata['claude-code'].sessionId`, use `{ resume }` on later calls, and use `deleteSession` for cleanup.
- Do not conflate browser stream reconnection with Claude conversation resumption. `useChat({ resume: true })` stays off; Claude continuity is the provider's `{ resume: sessionId }` setting.
- Do not treat a raw Claude file write as validated application state. The watcher/schema/last-valid-snapshot boundary is mandatory.
