# Process diagram (Prozessbild)

## Purpose

The picture the lead actually reacts to. A process understanding read as prose is hard to
check; the same process drawn as a graph makes a missing step or a wrong branch obvious at
a glance. The diagram is also the anchor for corrections — a step or transition can be
mentioned into the chat instead of described.

## How it works

### A typed graph, not a rendering hint

`flow` is part of the stored understanding, not something the UI derives. Its schema
(`processFlowSchema`, `packages/domain/src/process-understanding.ts:489`) allows 3–64
nodes and 2–128 edges over four node kinds:

| Kind         | Id pattern | Carries                                                                              |
| ------------ | ---------- | ------------------------------------------------------------------------------------ |
| `startEvent` | `start`    | —                                                                                    |
| `step`       | `step-<n>` | `stepId`, referencing an entry in `steps[]`                                          |
| `gateway`    | `xor-<n>`  | `question` and a `mode` (`rule_based`, `professional_judgement`, `mixed`, `unknown`) |
| `endEvent`   | `end`      | —                                                                                    |

Edges are `edge-<n>` and may carry a `label`, plus `determination` and `consequence` —
the latter two only on gateway branches.

### The rules that make it a process

`validateProcessFlow` runs as part of parsing the understanding, so an invalid graph can
never reach storage. It enforces:

- exactly one start event and exactly one end event;
- unique ids across nodes _and_ edges, with each id matching its node kind;
- the start event has no incoming and exactly one outgoing edge, leading to a step;
- a step has exactly one outgoing edge, leading to a step, a gateway, or the end event;
- a gateway has exactly one incoming edge from a step and **at least two** outgoing
  branches, each with an answer label, each leading to a step or the end event;
- the end event has no outgoing edges;
- every `stepId` exists, every step has exactly one flow node, and no step is referenced
  twice.

`determination` and `consequence` are rejected anywhere but a gateway edge.

Only XOR gateways exist. Parallel paths, loops, and transition metadata beyond these
fields are deliberately out of scope.

### Migration

Older records that predate the typed graph are upgraded on read by
`packages/storage/src/process-flow-migration.ts` (686 lines, covered by
`tests/process-flow-migration.test.ts`). `scripts/migrate-process-flow-storage.ts` /
`bun run migrate:process-flow` performs the same upgrade in place for an existing
workspace.

### Verification during a chat turn

While Claude edits the working file, `verifyProcessFlowFile`
(`apps/server/src/process-flow-verification.ts`) parses and validates it **without
publishing it**, capping the read at 2 MB. Valid revisions become the new last-valid
snapshot; invalid ones leave the previous diagram on screen and return structured
`FlowIssue`s the agent can act on.

### Rendering

Rendered with `@xyflow/react` as a **controlled, read-only** view, laid out with
`@dagrejs/dagre` — the decision is recorded in
[`../decisions/0002-use-react-flow-for-process-diagrams.md`](../decisions/0002-use-react-flow-for-process-diagrams.md).
Pan, zoom, focus, and mention targeting are enabled; manual graph editing is not. Step
detail opens in a dialog rather than on the node
(`apps/web/src/components/process-step-details.tsx`).

Before the first valid understanding exists, a data-free placeholder shows the _shape_ of
a possible diagram (`process-flow-placeholder.tsx`) — it is hidden from screen readers
because it contains no process information.

## Where it lives

| Layer   | Path                                                                                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain  | `packages/domain/src/process-understanding.ts` (`processFlowSchema`, `validateProcessFlow`), `process-understanding-editing.ts` (keeps the graph consistent when steps move) |
| Storage | `packages/storage/src/process-flow-migration.ts`                                                                                                                             |
| Server  | `apps/server/src/process-flow-verification.ts`                                                                                                                               |
| Web     | `apps/web/src/components/process-flow-diagram.tsx`, `process-flow-placeholder.tsx`, `process-step-details.tsx`, `chat-mention.tsx`; form-mode strip in `process-map.tsx`     |
| Script  | `scripts/migrate-process-flow-storage.ts`                                                                                                                                    |
| Tests   | `tests/process-flow-migration.test.ts`, `process-flow-verification.test.ts`, `process-domain.test.ts`                                                                        |

## Implementation status

**Implemented** for chat capture: the typed graph is stored, validated, migrated,
verified per turn, and rendered with gateways and labelled branches.

**Partial** for form capture. The process detail page renders the linear, editable step
strip in `apps/web/src/components/process-map.tsx`, not the flow graph — so a form-mode
lead never sees the gateways their understanding contains. `ProcessFlowDiagram` is
imported only by `apps/web/src/pages/process-chat-page.tsx`. Recorded in
[`../BACKLOG.md`](../BACKLOG.md).

## Constraints

- The graph is domain data validated in `packages/domain`, never a UI-side derivation.
- Read-only rendering: no graph authoring, no manual node editing.
- XOR gateways only — no parallel paths, no loops.
- No Git or model vocabulary in the diagram UI.

## Open items

See [`../BACKLOG.md`](../BACKLOG.md).
