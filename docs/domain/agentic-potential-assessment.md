# Agentic potential assessment

The assessment is a read-only advisory evaluation of the completed agentic scenario.
One explicitly started bounded Claude operation assesses the frozen scenario, included
hypotheses, evidence and 32 versioned criteria. The validated result is immutable.

Only 24 criteria can be scored. A score needs high confidence, an included hypothesis,
evidence and no assumption or open question. Eight policy-excluded criteria and nine
aggregate result rows are deliberately not calculated. No financial values, weighting,
prioritisation or implementation decision is introduced.

The review route is `/processes/:id/opportunities/agentic-assessment`. Its download is
deterministic: it reads the saved record only, patches the first sheet of the sanitized
five-sheet XLSX template, and keeps an export audit with hash and revisions.

## Where it lives

| Layer   | Path                                                                                                 |
| ------- | ---------------------------------------------------------------------------------------------------- |
| Domain  | `packages/domain/src/agentic-potential-assessment.ts`                                                |
| Storage | `packages/storage/src/agentic-potential-assessment-repository.ts`, `agentic-assessment-workbook.ts`  |
| Claude  | `packages/claude/src/agentic-potential-assessment-adapter.ts`                                        |
| Server  | `apps/server/src/agentic-potential-assessment-service.ts`, `routes/agentic-potential-assessments.ts` |
| Web     | `apps/web/src/pages/agentic-potential-assessment-page.tsx`                                           |

## Status

Implemented.
