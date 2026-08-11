# Chat capture

## Purpose

The default way to record a process: a German conversation with Claude instead of a form.
The lead uploads documents, answers questions in everyday professional language, and
watches a process diagram assemble itself beside the chat. It produces exactly the same
confirmed `ProcessUnderstanding` as [form capture](process-capture.md) — the downstream
modules cannot tell the two apart.

The interaction mode is chosen once on the setup page and is then immutable. There is no
mode switching and no duplication into the other mode.

## How it works

### One continuous session

Each chat capture owns **one resumable Claude CLI session** for the lifetime of the
process. This is the single exception to the repository-wide rule that AI operations never
resume a session — recorded in
[`../decisions/0001-continuous-chat-capture-session.md`](../decisions/0001-continuous-chat-capture-session.md).

- A Claude subprocess runs **only** for an explicit message, retry, or the initial
  document-analysis action. Opening the page, viewing the transcript, or looking at the
  diagram never resumes it.
- The session is resumed by its captured session id. If resumption fails, the server
  mints a `replacementCandidateId` and starts a **fresh** session seeded from the
  application's own state — persisted transcript, uploads, working JSON, last valid
  understanding. Replaced ids are tracked (`replacedSessionIds`) so process deletion can
  clean up every transcript Claude wrote.
- Model, system instructions, working directory, and tool set stay stable inside a
  session so provider-side prompt caching keeps repeat turns cheap.
- V1 assumes **one** active client and one active turn per process. The composer disables
  itself while a turn runs; there is no backend lock or queue, and concurrent tabs are
  unsupported.

### The working file

Claude writes `process-understanding.json` in the process directory directly, using
filesystem tools. The server polls that file while a turn runs
(`apps/server/src/chat-turn-runner.ts:198`, a 350 ms interval) and reconciles it:

- valid → written atomically to `chat/last-valid-process-understanding.json` with a
  SHA-256 `lastValidRevision`, and published to the diagram;
- invalid → the **last valid** snapshot stays on screen, the UI shows an updating state,
  and confirmation is disabled until a new valid snapshot arrives.

So the diagram updates _during_ a turn, while the assistant's reply only appears once the
turn has completed and been persisted.

### What reaches the browser

Provider output is consumed to completion but never forwarded verbatim. Claude's internal
pre-tool narration is not product copy. The server publishes:

- the successfully completed, persisted assistant reply, and
- a fixed set of transient **chat activities** (`chatActivityKindSchema`) with
  product-safe German labels — reading documents, updating the process diagram, checking
  open points.

Raw reasoning, tool inputs and outputs, file paths, shell output, and compaction details
stay server-side.

### Document gate

The conversation starts blocked. A fixed upload card collects files; the lead then
explicitly chooses _Unterlagen auswerten_ or _Ohne Unterlagen fortfahren_
(`POST /:id/chat/skip-documents`). `chatDocumentGateSchema` carries that state. Coverage
of the uploaded documents is shown separately
(`apps/web/src/components/document-coverage.tsx`).

### Mentions

Hovering a process step or transition in the diagram exposes a chat icon; selecting it
inserts a typed mention that renders as `@Schritt-N` or `@Übergang-N-M`
(`chatMentionSchema`, `apps/web/src/components/chat-mention.tsx`). This is how a
correction is tied to a specific part of the process rather than described in prose.

### Layout and tutorial

Desktop and tablet landscape use a roughly 42/58 chat/diagram split. Narrow screens fall
back to _Gespräch_ and _Prozessbild_ tabs with update indicators, switching automatically
when a mention is inserted. A three-step tutorial (documents, everyday professional
language, diagram review) runs once; completion and skip are remembered in browser
storage (`apps/web/src/lib/chat-tutorial-preference.ts`) and can be reset from Settings.

### Confirmation

Confirmation is human-owned. `POST /:id/chat/confirm` finalises the last valid
understanding. If it carries `knowledgeGaps` or `conflicts`, the server answers 409 with
`code: "confirmation_override_required"` and the UI asks a second time; assumptions alone
do not trigger this, and no written reason is required. The recorded
`confirmationQuality` is `complete` or `with_gaps`.

A confirmed chat capture is read-only. Confirmation then fires three background
follow-ups, in this order and independently of each other's failure:

1. opportunity discovery starts automatically ([opportunity-discovery.md](opportunity-discovery.md));
2. one bounded memory distillation is enqueued ([agent-memory.md](agent-memory.md));
3. one `documentation-sync` operation renders the process into the corpus
   ([process-documentation.md](process-documentation.md)).

If any enqueue fails, the confirmation still stands and the failure is written to the
process history; Settings offers a reconciliation to catch up.

### Files on disk

```
workspace/process-captures/<id>/
  process-understanding.json                 ← Claude writes this directly
  chat/
    transcript.jsonl                         ← append-only, the app's own record
    last-valid-process-understanding.json    ← atomic snapshot the UI renders
    …session state, frozen prompt and schema
```

## Where it lives

| Layer   | Path                                                                                                                                                                                                                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain  | `packages/domain/src/chat-capture.ts`                                                                                                                                                                                                                                                    |
| Storage | `packages/storage/src/chat-capture-repository.ts`                                                                                                                                                                                                                                        |
| Claude  | `packages/claude/src/chat-capture-adapter.ts`, `chat-capture-contracts.ts`, `chat-sandbox-spawn.ts`                                                                                                                                                                                      |
| Prompt  | `defaults/prompts/process-chat.md`; schema `defaults/ai-schemas/process-understanding.json`                                                                                                                                                                                              |
| Server  | `apps/server/src/chat-capture-service.ts`, `chat-turn-runner.ts`, `routes/chat-captures.ts`                                                                                                                                                                                              |
| Web     | `apps/web/src/pages/process-chat-page.tsx`; components `process-chat-transcript.tsx`, `process-chat-composer.tsx`, `process-chat-milestone-card.tsx`, `chat-document-gate.tsx`, `chat-capture-tutorial.tsx`, `chat-mention.tsx`, `document-coverage.tsx`, `document-attachment-list.tsx` |
| Tests   | `tests/chat-domain.test.ts`, `chat-storage.test.ts`, `chat-api.test.ts`, `chat-ai-contract.test.ts`, `chat-ui.test.ts`, `chat-presentation.test.ts`                                                                                                                                      |

## Implementation status

**Implemented** as V1, end to end: tutorial, upload gate, document analysis, persistent
transcript, live diagram, typed mentions, confirmation with override, and the three
background follow-ups.

Known deliberate V1 limits, carried over from the original specification and still true of
the code:

- The diagram renders step order, name, short activity, and derived linear transitions
  only. Inputs, outputs, information items, decisions, provenance, and evidence are not
  drawn. Manual graph editing is disabled. See [process-diagram.md](process-diagram.md).
- Claude writes the understanding file with **raw filesystem tools**. The originally
  planned V2 replacement — an application-owned structured write tool that validates
  before the file changes — has not been built. Listed in [`../BACKLOG.md`](../BACKLOG.md).
- Confirmed chat captures cannot be reopened.
- No backend concurrency lock; a second tab on the same process is unsupported rather than
  rejected.

## Constraints

- The resumed session is an optimisation, never the only record. Transcript, uploads, and
  the last valid understanding must always be sufficient to rebuild the capture.
- Never forward raw provider output, tool arguments, file paths, or shell output to the
  browser.
- German UI copy; no model terminology, no JSON, no Git vocabulary on screen.
- Only this process's own data goes to Claude.

## Open items

See [`../BACKLOG.md`](../BACKLOG.md).
