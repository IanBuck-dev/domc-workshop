# Process capture

## Purpose

A department lead describes one of their processes as it works **today**. Capture is
deliberately not an interview about systems or interfaces — it asks five open questions in
the lead's own language, plus four short mandatory multiple-choice questions that pin down
the properties an AI-potential assessment later depends on.

Two interaction modes produce the same output: **form capture** (this document) and
**chat capture** ([chat-capture.md](chat-capture.md)). The mode is fixed per process at
creation time (`interactionMode: "chat" | "form"`) and every route refuses work in the
wrong mode — `POST /api/processes/:id/analyze` answers _"Dieser Prozess wird im Chat
erfasst."_ with 409.

## How it works

### The five topics

Fixed identifiers, defined in `packages/domain/src/process-understanding.ts` and given
their German wording in `defaults/process-capture-config.json`:

| Topic id                      | Question (abridged)                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `purpose-scope`               | What triggers the process, what result should it deliver, where does it start and end?     |
| `flow-roles`                  | Which main steps in which order, and which roles or teams are involved?                    |
| `information-systems`         | Which information and documents are needed, and in which visible applications?             |
| `decisions-controls-handoffs` | Which decisions, approvals, or controls exist, and where does responsibility change hands? |
| `effort-pain-goals`           | What costs time, repeats, causes errors, or should get better?                             |

Exactly five answers are required — `assertExactlyFiveAnswers` enforces it in the domain
layer, not the UI.

### The four work characteristics

Short, mandatory, closed questions that the open text cannot be relied on to answer. Each
one hangs off a topic and is answered on the same page as that topic:

| Characteristic                 | Attached to                   | Selection                                                                                    |
| ------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------- |
| `combined-information-sources` | `information-systems`         | single (`yes` / `no` / `unsure`)                                                             |
| `content-types`                | `information-systems`         | multiple — free text, speech/audio, images/scans, video, other free-form files, none, unsure |
| `case-specific-recognition`    | `flow-roles`                  | multiple — unusual cases, recurring connections, per-case flow adaptation, none, unsure      |
| `uncertain-decisions`          | `decisions-controls-handoffs` | multiple — estimating future outcomes/risks, deciding under incomplete rules, none, unsure   |

The option sets are frozen in `workCharacteristicContracts`
(`packages/domain/src/process-understanding.ts:19`) and validated by
`assertWorkCharacteristicAnswers`. `none` and `unsure` are exclusive: selecting either
clears the rest. These answers are what
[opportunity-discovery.md](opportunity-discovery.md) reasons over, which is why they are
mandatory rather than optional.

### Departments

Seven fixed values in `defaults/process-capture-config.json`: Schaden, Vertrieb, Vertrag,
Finanzen, IT, Personal, Sonstiger Fachbereich.

### Uploads

Documents can be attached per process (`POST /api/processes/:id/uploads`), previewed,
selected or deselected for AI use (`selectedUploadIds`), and deleted. Only _selected_
uploads are passed to Claude — see `selectedUploads()` in
`apps/server/src/routes/process-captures.ts`. Nothing else from the repository is ever
sent.

### Iterative validation

The lead does not fill a form and submit once. `POST /api/processes/:id/analyze` runs one
bounded `process-follow-ups` operation that returns, per topic:

- a **review of the previous questions** (`previousQuestionReviews`) — whether the last
  round's gaps are now closed, so the same question is not asked twice;
- new **follow-up questions** (`followUps`).

Each run is stored as a `ValidationRun` together with an input snapshot
(`validationInputSnapshotSchema`: the answers and selected uploads it saw) and the AI
trace. The five input blocks stay visible and editable throughout; validation comments
appear beside them (`apps/web/src/components/process-validation-comment.tsx`). The lead
can run validation as often as they like, then move on.

### State machine

`processStateSchema` (`packages/domain/src/process-understanding.ts:100`):

```
capture_in_progress ──► follow_up_required ──► synthesis_ready ──► review_required ──► confirmed
```

`POST /:id/synthesize` is only accepted from `follow_up_required` or `synthesis_ready`;
`POST /:id/analyze` from the first three. Confirmation is described in
[process-understanding.md](process-understanding.md).

### The process list

`/` renders every capture as a client-side filterable and sortable table
(`apps/web/src/components/process-list-table.tsx`, model in
`apps/web/src/lib/process-list-model.ts`, `@tanstack/react-table`). It replaced an earlier
card list entirely. Filtering has no debounce — the corpus and process counts are small
enough that filtering on each keystroke is the simpler correct behaviour.

Near-duplicate names are caught at creation: `GET /api/processes/similar` compares against
`normalizedProcessName`.

## Where it lives

| Layer   | Path                                                                                                                                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain  | `packages/domain/src/process-understanding.ts` (topics, characteristics, states, records)                                                                                                                                                                     |
| Storage | `packages/storage/src/process-capture-repository.ts`                                                                                                                                                                                                          |
| Claude  | `packages/claude/src/process-follow-up-adapter.ts`, `process-ai-contracts.ts`, `process-ai-utils.ts`                                                                                                                                                          |
| Prompts | `defaults/prompts/process-base.md`, `defaults/prompts/process-follow-ups.md`; schema `defaults/ai-schemas/process-follow-ups.json`                                                                                                                            |
| Server  | `apps/server/src/routes/process-captures.ts`, `apps/server/src/process-operation-manager.ts`                                                                                                                                                                  |
| Web     | `apps/web/src/pages/process-start-page.tsx`, `process-capture-page.tsx`, `process-list-page.tsx`; components `process-topic-card.tsx`, `process-validation-comment.tsx`, `process-upload-picker.tsx`, `document-preview-dialog.tsx`, `process-list-table.tsx` |
| Config  | `defaults/process-capture-config.json`                                                                                                                                                                                                                        |
| Tests   | `tests/process-domain.test.ts`, `process-api.test.ts`, `process-storage.test.ts`, `process-ai-contract.test.ts`, `process-list-model.test.ts`, `process-list-ui.test.ts`, `process-operation-manager.test.ts`                                                 |

## Implementation status

**Implemented.** All five topics, the four work characteristics with their exclusivity
rules, uploads with per-document AI selection, iterative validation with previous-question
review, the state machine, and the filterable process table are built and covered by
tests.

Configuration is frozen per process at creation (`configSnapshot`, `configHash`,
`profile.version`), so changing `defaults/process-capture-config.json` affects only new
processes. Version 2 of the profile is the one that requires work characteristics; the
guard at `apps/server/src/routes/process-captures.ts:266` still tolerates version-1
records without them.

## Constraints

- German interface copy for an insurance manager, not a developer.
- No raw JSON, terminal commands, prompt text, stack traces, model terminology, or Git
  vocabulary in the normal UI.
- Workshop policy — topics, questions, option labels — belongs in
  `defaults/process-capture-config.json`, never inside React components.
- One user action triggers exactly one bounded AI operation. No autonomous loops.
- Only selected uploads and the current process's own data go to Claude.

## Open items

See [`../BACKLOG.md`](../BACKLOG.md) — in particular that form-mode confirmation does not
trigger memory distillation, unlike chat-mode confirmation.
