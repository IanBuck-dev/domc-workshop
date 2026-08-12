# Process understanding

## Purpose

The canonical structured record of how one process works today. Both capture modes write
it, the lead reviews and corrects it, and confirming it is the act that unlocks everything
downstream. It is the contract that keeps AI output honest: every fact carries where it
came from, what it rests on, and how sure the system is.

## How it works

### Shape

`processUnderstandingSchema` (`schemaVersion: 3`,
`packages/domain/src/process-understanding.ts:925`) holds twelve narrative facts —
`purpose`, `trigger`, `outcome`, `boundaries`, `participants`, `informationSources`,
`systems`, `controls`, `handoffs`, `volumeAndTime`, `painPoints`, `improvementGoals` —
plus:

- `steps`: 1–8 process steps, contiguously ordered, each with `name`, `activity`,
  `inputs`, `outputs`, `informationItems`, and free `miscellaneous` text;
- `flow`: the typed graph described in [process-diagram.md](process-diagram.md);
- `evidence`: the referenceable sources;
- `documentCoverage`: per upload, whether it was read completely, partially, or not at
  all;
- `knowledgeGaps` and `conflicts`: what is still unknown or contradictory.

Information items are typed: `system_field`, `email`, `spreadsheet`, `document`,
`image_or_scan`, `free_text`, `database_or_report`, `other`, `unknown`. Only `other` may
carry a free-text `typeDetail`.

### Every fact is qualified

Each narrative fact and each step carries the same five attributes (`factBase`):

| Attribute     | Meaning                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `provenance`  | one of `user_stated`, `file_evidence`, `ai_structured`, `ai_inferred`, `user_confirmed`, `unknown` |
| `evidenceIds` | references into `evidence[]`; unknown ids fail validation                                          |
| `confidence`  | 0–100, or `null`                                                                                   |
| `assumptions` | what the statement rests on, up to 20 entries                                                      |
| `confirmed`   | whether a human has signed off on this specific fact                                               |

Evidence itself records `kind` (`main_answer`, `follow_up_answer`, `upload`,
`human_correction`, `chat_message`), the `sourceId`, and a verbatim `excerpt`. The schema
enforces referential integrity in both directions: unique ids, unique information ids,
unique coverage upload ids, and no dangling evidence reference. `assertUnderstandingReferences`
makes the same guarantee outside the parse path.

Provenance is preserved in storage **and** shown in the UI
(`apps/web/src/lib/process-provenance.ts`) — the lead can always see whether a sentence is
something they said, something a document showed, or something the model inferred.

### Reviewing and correcting

The understanding is presented as a brief (`apps/web/src/components/process-brief.tsx`)
split into six sections (`understandingSectionSchema`): overview, participants, flow,
decisions, problems, open points. Each is editable in place:

- `PATCH /api/processes/:id/understanding/:sectionId` writes a section correction;
- `PATCH /api/processes/:id/work-characteristics` corrects the closed answers.

A human correction requires a recorded reason, sets provenance to `user_confirmed`, and
appends evidence of kind `human_correction`. Steps can be inserted, moved, and removed
through the pure helpers in `packages/domain/src/process-understanding-editing.ts`, which
also rewrite the flow graph's references (`referencesToStep`) so the diagram never
dangles.

Editing is available in **form** mode. Confirmed chat captures are read-only.

### Confirmation

Only a user action confirms. AI output is advisory throughout — there is no automatic
promotion to confirmed.

`POST /api/processes/:id/confirm` (form) or `POST /api/processes/:id/chat/confirm` (chat)
moves the record to `confirmed` and records `confirmationQuality`:

- `complete` — no open points;
- `with_gaps` — knowledge gaps or conflicts remain and the lead explicitly overrode a
  second dialog.

Assumptions alone never trigger the override dialog.

### Audit

Every change — AI operation, human correction, confirmation, documentation sync, deletion
— is appended to an append-only process history (`processHistoryEventNames` in
`packages/domain/src/process-events.ts`) and surfaced at
`GET /api/processes/:id/history`. Writes go through `atomicWrite`
(`packages/storage/src/atomic-write.ts`) so a crashed operation can never leave a
half-written understanding on disk.

## Where it lives

| Layer   | Path                                                                                                                                                                                                                                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain  | `packages/domain/src/process-understanding.ts`, `process-understanding-editing.ts`, `process-events.ts`                                                                                                                                                                                                                      |
| Storage | `packages/storage/src/process-capture-repository.ts`, `atomic-write.ts`, `audit-log.ts`                                                                                                                                                                                                                                      |
| Claude  | `packages/claude/src/process-synthesis-adapter.ts`, `process-response-schemas.ts`; schema `defaults/ai-schemas/process-understanding.json`; prompt `defaults/prompts/process-synthesis.md`                                                                                                                                   |
| Server  | `apps/server/src/routes/process-captures.ts`                                                                                                                                                                                                                                                                                 |
| Web     | `apps/web/src/pages/process-detail-page.tsx`; components `process-brief.tsx`, `process-step-card.tsx`, `process-step-information.tsx`, `process-step-decisions.tsx`, `process-step-details.tsx`, `process-unknowns.tsx`, `process-confirmation-actions.tsx`, `process-tracker.tsx`; `apps/web/src/lib/process-provenance.ts` |
| Tests   | `tests/process-domain.test.ts`, `process-api.test.ts`, `process-storage.test.ts`, `process-events.test.ts`, `process-navigation-model.test.ts`                                                                                                                                                                               |

## Implementation status

**Implemented.** Schema version 3 with the typed flow graph is the only stored version;
`processUnderstandingV3Schema` and `processUnderstandingStorageSchema` are aliases of the
same schema, and `packages/storage/src/process-flow-migration.ts` upgrades older records
on read.

Section editing, step insertion/move/removal, work-characteristic correction, the
confirmation override, and the full provenance chain are all built and tested.

## Constraints

- AI output is advisory. Only a user action confirms.
- Evidence, assumptions, confidence, and provenance are preserved for every structured
  fact, in storage **and** in the UI.
- Human corrections require a recorded reason.
- Validate every file read and every AI response at runtime before use.
- Atomic writes; append-only audit history.

## Open items

See [`../BACKLOG.md`](../BACKLOG.md).
