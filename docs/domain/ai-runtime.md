# AI runtime

## Purpose

How Claude is actually called. Every AI feature in the prototype goes through the same
narrow path: a versioned prompt plus a versioned JSON schema, one bounded call, a
validated response, a recorded trace. Nothing in this repository calls a model ad hoc.

The locally authenticated `claude` CLI is the only AI provider.

## How it works

### Bounded operations

There are exactly five operation names (`processOperationNames`,
`packages/domain/src/process-events.ts:37`):

| Operation | Uses Claude | Triggered by |
| --- | --- | --- |
| `process-follow-ups` | yes | the lead pressing validate |
| `process-synthesis` | yes | the lead pressing synthesise |
| `opportunity-discovery` | yes — one hypothesis call, then at most one scenario call | job start |
| `memory-distillation` | yes | chat confirmation |
| `documentation-sync` | **no** — deterministic rendering | any confirmation |

The rules that hold across all of them:

- one user action triggers one bounded operation; no autonomous loops;
- no session is resumed. Chat capture is the single documented exception
  ([chat-capture.md](chat-capture.md));
- only the data the current operation needs is sent — the selected uploads and that
  process's own content. No unrelated repository content ever goes to Claude.

`documentation-sync` and corpus reconciliation are deterministic bounded operations
without a Claude session, so the AI rules above do not constrain them.

### The operation queue

`apps/server/src/process-operation-manager.ts` is the single gate. It enforces one active
operation per process (`hasActiveProcessOperation`), distinguishes write operations
(`hasActiveWriteOperation`, so a process cannot be deleted mid-write), supports
cancellation (`DELETE /api/ai-operations/:operationId`), and lets a failed operation be
dismissed. `allowSameProcessFollowup` is the narrow exemption that lets memory
distillation start immediately after the confirmation it follows.

Memory consolidation runs as a global operation (`runGlobalOperation`) and rejects a
second start with `MemoryConsolidationConflictError` → 409.

The floating queue in the UI is `apps/web/src/components/ai-operation-queue.tsx`.

### Progress: server-sent events

`GET /api/events` is one SSE stream for the whole app
(`apps/server/src/routes/events.ts`). It emits the operations list and the memory
consolidation status immediately on connect — so a reconnect resynchronises — then every
change, with a `ping` heartbeat every 25 s to keep quiet connections open. Writes are
serialised through a promise queue because events arrive synchronously while stream writes
are async.

The browser side is `apps/web/src/lib/process-events.tsx`.

### Model configuration

`AiRuntimeModelConfig` (`packages/claude/src/ai-runtime-contracts.ts`) is the shared
budget every call carries: `model` (`claude-opus-4-8`), `effort` (`medium` | `high`),
`timeoutMs`, `maxOutputTokens`, `maxInputCharacters`, and `maxBudgetUsd`. The values come
from `defaults/process-capture-config.json` and
`defaults/opportunity-discovery-config.json` and are **frozen per record** at creation
(`configSnapshot`, `configHash`), which is what makes prompt-tuning rounds reproducible:
changing a prompt only affects processes created afterwards.

### Prompts and schemas are files

`defaults/prompts/*.md` and `defaults/ai-schemas/*.json`, versioned in the repository —
never inline strings scattered through application code:

```
prompts/                       ai-schemas/
  process-base.md                process-understanding.json
  process-follow-ups.md          process-follow-ups.json
  process-synthesis.md           opportunity-hypotheses.json
  process-chat.md                opportunity-scenarios.json
  opportunity-base.md            memory-distillation.json
  opportunity-hypotheses.md      memory-consolidation.json
  opportunity-scenarios.md
  memory-distillation.md
  memory-consolidation.md
```

`GET /api/config/defaults` exposes the effective configuration and
`POST /api/config/instruction-preview` renders the instructions a given operation would
send, shown in `apps/web/src/components/instruction-preview-dialog.tsx` — a deliberate
transparency surface, kept out of the normal capture flow.

### Validation on both edges

Every AI response is parsed against its Zod schema before anything is stored, and every
file read is parsed before use. `AiStructuredResult<T>` pairs the validated value with an
`AiTrace`: `operationId`, `sessionId`, `model`, `durationMs`, input and output tokens, and
whether the call was sandboxed. Traces are stored with the record they produced.

### Sandbox

`packages/claude/src/sandbox-runner.ts` runs the Claude subprocess with a process-local
working directory and a network allow-list restricted to
`api.anthropic.com`, `*.anthropic.com`, `claude.ai`, `*.claude.ai`, and
`platform.claude.com`. Tools are either `none` or `workspace`-scoped per operation.

On Linux the sandbox requires `bwrap` and `socat`. **On macOS the dev server always starts
without the sandbox** — `scripts/dev.ts` detects darwin and disables it; the sandbox is a
Linux-only mechanism.

### Error handling

`apps/server/src/index.ts` maps internal failures — syntax errors, Claude/sandbox/schema
messages, `ENOENT`, `EACCES` — onto one German sentence: *"Die Aktion konnte nicht
abgeschlossen werden. Ihre bisherigen Angaben bleiben erhalten."* Stack traces and
provider messages never reach the browser.

### Audit

Twenty-eight append-only history event names (`processHistoryEventNames`) record what
happened to a process, including the AI-adjacent ones: `validation-run-completed`,
`understanding-synthesized`, `memory-distilled`, `memory-distillation-failed`,
`memory-prompt-truncated`, `memory-prompt-skipped`, `documentation-synced`,
`opportunity-auto-start-failed`.

## Where it lives

| Layer | Path |
| --- | --- |
| Contracts | `packages/claude/src/ai-runtime-contracts.ts`, `process-ai-contracts.ts`, `opportunity-ai-contracts.ts`, `chat-capture-contracts.ts`, `memory-*-contracts.ts` |
| Adapters | `packages/claude/src/*-adapter.ts` |
| Sandbox | `packages/claude/src/sandbox-runner.ts`, `chat-sandbox-spawn.ts` |
| Queue and events | `apps/server/src/process-operation-manager.ts`, `process-events.ts`, `routes/events.ts`, `routes/ai-operations.ts`, `routes/config.ts` |
| Web | `apps/web/src/lib/process-events.tsx`, `components/ai-operation-queue.tsx`, `instruction-preview-dialog.tsx` |
| Config | `defaults/prompts/`, `defaults/ai-schemas/`, `defaults/*.json` |
| Tests | `tests/process-ai-contract.test.ts`, `opportunity-ai-contract.test.ts`, `chat-ai-contract.test.ts`, `memory-ai-contract.test.ts`, `process-operation-manager.test.ts`, `process-events.test.ts`, `config-api.test.ts` |

## Implementation status

**Implemented.** All five operations, the per-process queue with cancellation and
dismissal, the global consolidation lock, the SSE stream with heartbeat and reconnect
resync, frozen per-record contracts, schema validation on both edges, trace recording, the
instruction preview, and the sandbox with its network allow-list.

## Constraints

- The locally authenticated `claude` CLI is the only provider.
- Prompts and response schemas are versioned repository files.
- Validate every file read and every AI response at runtime before use.
- No autonomous loops; no session resumption outside chat capture.
- Send only the data the current operation needs.
- Never expose prompt text, model terminology, stack traces, or raw JSON in the normal UI.

## Open items

See [`../BACKLOG.md`](../BACKLOG.md).
