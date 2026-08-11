# Agent memory (the agent brain)

## Purpose

Each capture conversation starts from zero unless the system remembers something. The
agent memory is **one company-wide Markdown brain** that grows with every confirmed
process: what "Störfall" means at LifeCorp, which system is called what, who approves
what, which media breaks keep recurring, and which questions are still open across the
company.

The next capture conversation starts already knowing all of it, so the lead is not asked
again what a colleague already explained.

Scope is deliberately company-wide and single-tenant. There are no per-process, per-
department, or per-user memories, and there is no vector database.

## How it works

### Storage

`workspace/memory/`, plain Markdown, readable and auditable by a human:

```
workspace/memory/
  MEMORY.md            ← generated index over the five topics
  glossar.md           ← technical terms, abbreviations, internal names
  systeme.md           ← applications, interfaces, system roles
  zustaendigkeiten.md  ← stable roles, approvals, responsibilities
  muster.md            ← recurring process patterns and media breaks
  offene-fragen.md     ← company-wide open points and contradictions
  memory-history.jsonl ← append-only audit of every change
```

The five topics are fixed (`memoryTopicNames`). `MEMORY.md` is generated, never
hand-edited.

### An entry

Every fact carries its source: the `PROC-NNNN` process it came from and the date that
process was confirmed (`memorySourceSchema`, process ids match `/^PROC-\d{4}$/`).
`memorySourceTag` renders that as a visible tag on the bullet, so a fact in the prompt can
always be traced back to the conversation that produced it.

`normalizeMemoryFact` additionally screens candidate facts for prompt-injection
directives — "ignore all previous instructions", "system prompt", "verhalte dich als" and
their German equivalents — and rejects them. Uploaded documents are untrusted input, and
the memory is fed straight back into a system prompt.

### Distillation — how facts get in

After a **chat** capture is confirmed, one bounded `memory-distillation` operation runs.
It receives the transcript, the confirmed understanding, and the current topic files, and
returns a list of typed operations (`memoryOperationSchema`, a discriminated union on
`action`) that `applyMemoryOperations` applies. It never rewrites the files freely.

The operation is enqueued with `allowSameProcessFollowup: true` so it can run immediately
after confirmation without colliding with the confirmation itself. A failure is written to
the process history and does not invalidate the confirmation.

### Consolidation — keeping it small

Facts accumulate and start to duplicate or contradict each other. Consolidation is a
**manual** operation started from Settings (`POST /api/memory/consolidate`, 202, 409 if one
is already running). It reads the whole memory, proposes merges and deletions, and
validates them with `validateMemoryConsolidation` before anything is written. There is no
cron job and no automatic trigger — a human decides when the brain gets tidied.

### The prompt budget

The memory block injected into a chat capture is capped at **25 KB**
(`memoryPromptMaximumBytes`, `apps/server/src/chat-capture-service.ts:30`). When the
memory exceeds that, the block is trimmed **fact-aligned**: whole bullets are dropped by a
weighted round-robin across the five topics, never sliced mid-sentence. A single fact that
alone exceeds the budget is skipped rather than truncated.

### Reading it back

`GET /api/memory` returns an overview per topic with the origin of each fact resolved to a
readable process name, department, and participant. A deleted or unreadable process never
makes the view fail — the entry simply loses its resolved name.

`DELETE /api/memory` resets everything and records the reason *"manueller Reset"* in the
audit as a human correction.

Settings shows all of this under *Gelerntes Firmenwissen*
(`apps/web/src/components/company-knowledge-section.tsx`).

## Where it lives

| Layer | Path |
| --- | --- |
| Domain | `packages/domain/src/memory.ts` |
| Storage | `packages/storage/src/memory-repository.ts` |
| Claude | `packages/claude/src/memory-distillation-adapter.ts`, `memory-distillation-contracts.ts`, `memory-consolidation-adapter.ts`, `memory-consolidation-contracts.ts` |
| Prompts | `defaults/prompts/memory-distillation.md`, `memory-consolidation.md`; schemas `defaults/ai-schemas/memory-distillation.json`, `memory-consolidation.json` |
| Server | `apps/server/src/memory-distillation-service.ts`, `memory-distillation-defaults.ts`, `memory-consolidation-service.ts`, `memory-consolidation-defaults.ts`, `routes/memory.ts`; prompt assembly in `chat-capture-service.ts:30-150` |
| Web | `apps/web/src/components/company-knowledge-section.tsx`, `apps/web/src/pages/settings-page.tsx` |
| Tests | `tests/memory-domain.test.ts`, `memory-storage.test.ts`, `memory-api.test.ts`, `memory-ai-contract.test.ts`, `memory-consolidation-service.test.ts`, `memory-ui.test.ts` |

## Implementation status

**Implemented** for chat capture: the five topic files with generated index, sourced
facts, injection screening, bounded distillation after confirmation, manual consolidation
with validation, the 25 KB fact-aligned prompt budget, the Settings overview with resolved
origins, and reset. Six test files cover it.

**Partial** overall — the brain only learns from **chat** captures.
`MemoryDistillationService.distill` rejects anything else outright
(*"Nur ein bestätigter Chat-Prozess kann destilliert werden."*,
`apps/server/src/memory-distillation-service.ts:57`), and the form-mode confirm route at
`apps/server/src/routes/process-captures.ts:416` never enqueues it. This is structural —
distillation reads the chat transcript, which form captures do not have — but `AGENTS.md`
states the rule without that qualification. Recorded in [`../BACKLOG.md`](../BACKLOG.md).

Deliberately **not built**, and out of scope unless the product decision changes:
retrieval by index-plus-reload or grep, editing a single entry from the UI, scheduled
consolidation, per-process/department/user scopes, report-grade hardening, and a vector
database.

## Constraints

- One bounded distillation per confirmation. No autonomous loop.
- Consolidation is manual and validated before it writes.
- Every fact keeps its process origin and confirmation date.
- Candidate facts are screened for injected directives before they enter the memory.
- The injected prompt block never exceeds 25 KB and never cuts a fact in half.
- Files stay human-readable Markdown with an append-only history.

## Open items

See [`../BACKLOG.md`](../BACKLOG.md).
