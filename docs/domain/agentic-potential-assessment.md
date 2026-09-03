# Agentic potential assessment

The assessment is a read-only advisory evaluation of the completed agentic scenario.
One explicitly started bounded provider operation assesses the frozen scenario, included
hypotheses, evidence and 32 versioned criteria. The validated result is immutable.

Only 24 criteria can be scored. A score needs high confidence, an included hypothesis,
evidence and no assumption or open question. Eight policy-excluded criteria and nine
aggregate result rows are deliberately not calculated. No financial values, automatic
prioritisation or implementation decision is introduced.

The process portfolio derives a read-only **KI-Potenzial-Score** from a current,
completed assessment. It normalises each high-confidence criterion from 0–2 to
0–100 and combines three category averages: qualitative benefit 50%, feasibility
30%, and technical AI suitability 20%. Each category must have at least 50%
high-confidence criterion coverage; otherwise the list displays `–`. The score is
a directional comparison aid, not ROI, a savings estimate, or an implementation
decision. Calculation and list rendering do not call AI.

The review route is `/processes/:id/opportunities/agentic-assessment`. Its download is
deterministic: it reads the saved record only, patches the first sheet of the sanitized
five-sheet XLSX template, and keeps an export audit with hash and revisions. Its download name
is derived from the frozen business process name, for example
`Agentische-Potenzialbewertung_FIN-03_Nicht-zuordenbare-Zahlungseingaenge-klaeren.xlsx`; the
technical `PROC-NNNN` remains only in internal route, storage, and audit references.

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
