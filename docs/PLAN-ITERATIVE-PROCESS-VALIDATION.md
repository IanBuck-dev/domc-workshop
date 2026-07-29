# Plan: Iterative Prozessvalidierung im Erfassungsformular

## Locked behaviour

- The five input blocks remain visible and editable after every validation.
- Desktop rows use the approved 8/4 layout; tablet/mobile stacks the feedback below its input.
- Claude feedback is read-only. Users answer by editing the original text.
- Every validation is one explicit user action and one fresh Claude session.
- No autonomous loop runs until all questions disappear.
- After the first validation, users can either check again or continue.
- Continuing with open questions uses `Trotz offener Rückfragen fortfahren`; unresolved points become knowledge gaps in the process picture.
- Existing captures, including legacy `follow-ups.json` data, remain readable and can enter the new flow.

## 1. Add validation-round domain records

In `packages/domain/src/process-understanding.ts`:

- Add `ValidationInputSnapshot` containing the five answers, four Arbeitsmerkmale, and selected upload IDs.
- Add `PreviousQuestionReview` with:
  - `questionId`
  - `topicId`
  - `outcome: "addressed" | "not_addressed"`
  - concise `rationale`
- Add `ValidationRun` containing:
  - sequential run number
  - completion timestamp
  - exact input snapshot checked by Claude
  - returned questions
  - reviews of the immediately preceding questions
  - AI trace; nullable only for migrated legacy data
- Add `validationRuns` to `ProcessCaptureRecord`.
- Preserve `followUps` as the latest questions and `followUpAnswers` only for reading existing records.
- Change state invariants:
  - `capture_in_progress`: no validation completed yet.
  - `follow_up_required`: latest validation returned questions.
  - `synthesis_ready`: latest validation returned no questions, or the user explicitly accepted remaining questions.
- Require unique questions per topic within each run and contiguous run numbers.

## 2. Persist append-only validation history

In `packages/storage/src/process-capture-repository.ts`:

- Extend `follow-ups.json` to:

```json
{
  "questions": [],
  "answers": [],
  "validationRuns": []
}
```

- Read existing files without `validationRuns`.
- Before editing a legacy capture with existing questions, materialize a baseline run from its current answers and questions.
- Replace `saveFollowUps` with `saveValidationRun`, which:
  - snapshots the exact checked inputs;
  - appends one completed run;
  - stores Claude's question reviews;
  - replaces only the current `questions`;
  - sets `follow_up_required` or `synthesis_ready`.
- Allow `saveMainAnswers` in all three pre-synthesis states.
- Add `acceptOpenQuestionsForSynthesis` to move from `follow_up_required` to `synthesis_ready`.
- Preserve the previous validation run if a new Claude operation fails.
- Add audit events:
  - `validation-run-completed`
  - `validation-input-updated`
  - `open-validation-questions-accepted`
- Record old and new input snapshots so the effect of each question remains inspectable.

## 3. Give every fresh Claude session comparison context

In the Claude contract and adapter:

- Extend `FollowUpRequest` with validation history.
- Send the fresh session:
  - current input;
  - immediately preceding checked input;
  - questions returned for that input;
  - all earlier question IDs and texts to avoid repetition.
- Do not send earlier full input snapshots beyond the immediately preceding run.
- Continue using `--no-session-persistence`; never pass a previous session ID.
- Extend the result to:

```ts
{
  previousQuestionReviews: PreviousQuestionReview[];
  followUps: FollowUpQuestion[];
}
```

- Validate that every question from the immediately preceding run is reviewed exactly once.
- Keep the existing maximum of one new question per topic and five total.
- Update the prompt to distinguish:
  - whether the changed text addresses the previous question;
  - whether a material gap remains;
  - whether a different new gap warrants a question.
- Pass validation history into synthesis as advisory context. Only current answers and selected files may become factual evidence; unanswered current questions become knowledge gaps.

## 4. Update the API flow

In `apps/server/src/routes/process-captures.ts`:

- Permit `PUT /answers` during `capture_in_progress`, `follow_up_required`, and `synthesis_ready`.
- Permit `POST /analyze` in those same states.
- Each analyze request still queues exactly one bounded operation.
- Remove the obsolete `PUT /follow-ups` answer route.
- Let `POST /synthesize` accept `follow_up_required`:
  - first record explicit acceptance of open questions;
  - then queue synthesis from the freshly saved canonical answers.
- Keep active-operation conflict protection and sanitized failures unchanged.

## 5. Integrate the approved layout into the prototype UI

In the capture page:

- Render one unified editable form for all three pre-synthesis states.
- Wrap every existing `ProcessTopicCard` in a desktop `2fr 1fr` row.
- Keep the current prototype cards, colors, typography, spacing, numbering, Arbeitsmerkmale, upload picker, and sticky action bar.
- Replace the separate follow-up stage with a read-only side panel:
  - `Offene Rückfrage`
  - generated question
  - generated rationale
  - `Ergänzen Sie Ihre Angabe links.`
- For a topic without feedback, show `Keine offene Rückfrage`.
- Keep the form visible but disabled while validation runs; show the operation status above it.
- Initial state has only `Angaben prüfen lassen`.
- After at least one run, show:
  - `Erneut prüfen`
  - `Mit Prozessbild fortfahren`
- With open questions, change the primary label to `Trotz offener Rückfragen fortfahren`.
- Preserve timestamps for unchanged answers; only edited topics receive a new `answeredAt`.

## 6. Update navigation and documentation

Update state labels:

- `follow_up_required`: `Angaben ergänzen`
- `synthesis_ready`: `Angaben geprüft`
- Process-list actions: `Ergänzen` and `Fortfahren`

Update the product flow and operator guide to replace the single separate follow-up round with user-triggered validation rounds and fresh Claude sessions.

## Files To Change

- `packages/domain/src/process-understanding.ts`
- `packages/storage/src/process-capture-repository.ts`
- `packages/claude/src/process-ai-contracts.ts`
- `packages/claude/src/process-follow-up-adapter.ts`
- `packages/claude/src/process-response-schemas.ts`
- `packages/claude/src/process-synthesis-adapter.ts`
- `defaults/ai-schemas/process-follow-ups.json`
- `defaults/prompts/process-follow-ups.md`
- `defaults/prompts/process-synthesis.md`
- `defaults/process-capture-config.json`
- `apps/server/src/routes/process-captures.ts`
- `apps/web/src/lib/process-types.ts`
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/lib/process-navigation-model.ts`
- `apps/web/src/pages/process-list-page.tsx`
- `apps/web/src/pages/process-capture-page.tsx`
- `apps/web/src/components/process-topic-card.tsx`
- Replace `apps/web/src/components/process-follow-up-card.tsx` with `process-validation-comment.tsx`
- `apps/web/src/styles/capture.css`
- `apps/web/src/styles/responsive.css`
- `docs/PRODUCT-FLOW-KI-POTENTIAL.md`
- `docs/OPERATOR_GUIDE.de.md`
- `tests/process-fixtures.ts`
- `tests/process-domain.test.ts`
- `tests/process-storage.test.ts`
- `tests/process-api.test.ts`
- `tests/process-ai-contract.test.ts`
- `tests/process-navigation-model.test.ts`

## Test scenarios

- First validation stores input snapshot A and questions A.
- Edited input B plus questions A reaches a new Claude session.
- Every question A receives an `addressed` or `not_addressed` review.
- The second run appends history without overwriting run one.
- No second Claude call occurs without another user click.
- Questions can disappear, remain, or be replaced after revalidation.
- Continuing with open questions records acceptance and carries them into `knowledgeGaps`.
- A failed revalidation leaves canonical input and the last successful questions intact.
- Existing legacy follow-up captures migrate without data loss.
- Selected files remain process-scoped and are freshly staged for every session.
- Desktop `1440x900` uses 8/4 rows; `1024x768` remains usable; narrower widths stack.
- Console and failed-network inspection remain clean.

## Validation commands

```zsh
./scripts/qa test tests/process-domain.test.ts
./scripts/qa test tests/process-storage.test.ts
./scripts/qa test tests/process-ai-contract.test.ts
./scripts/qa test tests/process-api.test.ts
./scripts/qa test tests/process-navigation-model.test.ts
./scripts/qa changed
./scripts/qa all
./scripts/qa release
```

Final UI verification uses Chrome DevTools at `1440x900` and `1024x768`, covering first validation, editing, revalidation, continuation with open questions, zero-question completion, refresh persistence, and failed-operation retry.
