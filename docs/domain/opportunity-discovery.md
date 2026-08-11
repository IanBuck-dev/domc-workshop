# Opportunity discovery

## Purpose

Once a process understanding is confirmed, this separate downstream module asks a single
question: **where in this process could AI plausibly contribute, and what would human
oversight look like?** It produces evidence-backed hypotheses per process step and three
read-only oversight scenarios at increasing levels of delegation.

It deliberately does **not** assess feasibility, cost, or benefit, does not score, does not
prioritise, and does not hand anything over to a project. The product boundary in
`AGENTS.md` rules all of that out.

## How it works

### One job, exactly two bounded calls

Discovery is the sole exception to "one user action, one bounded AI operation". An
explicitly started job may perform:

1. exactly one bounded **hypothesis** call, then deterministically
2. exactly one bounded **scenario** call —

and only when the hypothesis result supports it. There is no loop, no retry cascade, and
no third call.

### Which hypotheses reach the scenario call

`selectScenarioHypotheses` (`packages/domain/src/opportunity-discovery.ts:371`) is pure
and deterministic:

- if **any** hypothesis has `confidenceLevel: "high"`, all high-confidence hypotheses go
  forward with `basis: "high"`;
- otherwise the medium-confidence hypotheses are sorted by potential level, then step
  order, then title (German collation), the top three are taken, and if **at least two**
  remain the job proceeds with `basis: "medium_fallback"`;
- otherwise the job ends in `no_supported_hypotheses` and no scenarios are generated.

### State machine

`opportunityDiscoveryStates`, with transitions asserted by
`assertOpportunityDiscoveryTransition`:

```
hypotheses_queued ──► hypotheses_running ─┬─► no_supported_hypotheses
                            ▲             ├─► hypotheses_failed ──┐
                            └─────────────┴──────────────────────-┘  (retry)
                                          └─► scenarios_running ─┬─► completed
                                                    ▲            └─► scenarios_failed
                                                    └────────────────┘  (retry)
```

Retries re-enter the failed phase only; a completed job is terminal.

### The three scenarios

Fixed levels (`scenarioLevels`): `assistive`, `delegated`, `agentic` — increasing AI
autonomy, decreasing human involvement. Every scenario id must match its level. Each one
records, among ~20 required fields:

- what changes from today, and which process steps it touches;
- the split of responsibilities: `aiResponsibilities`, `deterministicAutomation`,
  `orchestration`, `humanResponsibilities`;
- `humanOversight` — never empty;
- `actions`, each with an `executionMode`;
- `systemAccess`, each entry typed by mode (`read`, `write`, `observe`, `act`), timing
  (`manual`, `on_demand`, `event_driven`), and mechanism;
- `prerequisites`, `risksAndFailureModes`, `assumptions`, `openQuestions`;
- `includedHypothesisIds` and `excludedHypotheses` — a hypothesis may not be both;
- `evidenceIds` (1–250) and a `confidenceLevel` with a written `confidenceRationale`.

Scenarios are `provenance: "ai_inferred"` by schema — they are always advisory, and they
are read-only in the UI. `assertOpportunityScenarioReferences` rejects any scenario that
cites a step or hypothesis that does not exist.

### Frozen contracts

`createOpportunityProcessSnapshot` freezes the confirmed process, the prompt, and the
response schema into the discovery record (`opportunityContractManifestSchema`,
`opportunityScenarioContractVersion`). Changing a prompt therefore affects only new jobs —
which is what makes prompt tuning rounds reproducible.

### API

| Endpoint                                    | Purpose                |
| ------------------------------------------- | ---------------------- |
| `GET /api/opportunities`                    | all discovery records  |
| `GET /api/opportunities/:processId`         | one record             |
| `GET /api/opportunities/:processId/history` | its audit trail        |
| `POST /api/opportunities/:processId`        | start the job          |
| `POST /api/opportunities/:processId/retry`  | retry the failed phase |

Chat-mode confirmation calls `start` automatically; form mode is started explicitly from
the process detail page.

Progress reaches the browser over server-sent events
(`apps/web/src/components/opportunity-progress.tsx`).

### Configuration

`defaults/opportunity-discovery-config.json` holds the German instructions for both calls
plus the AI budget: model, reasoning effort, a 300 s timeout, 12 000 output tokens,
200 000 input characters, and a 1 USD ceiling.

## Where it lives

| Layer   | Path                                                                                                                                                                                                     |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain  | `packages/domain/src/opportunity-discovery.ts`                                                                                                                                                           |
| Storage | `packages/storage/src/opportunity-discovery-repository.ts`                                                                                                                                               |
| Claude  | `packages/claude/src/opportunity-hypothesis-adapter.ts`, `opportunity-scenario-adapter.ts`, `opportunity-ai-adapter.ts`, `opportunity-ai-contracts.ts`, `opportunity-response-schemas.ts`                |
| Prompts | `defaults/prompts/opportunity-base.md`, `opportunity-hypotheses.md`, `opportunity-scenarios.md`; schemas `defaults/ai-schemas/opportunity-hypotheses.json`, `opportunity-scenarios.json`                 |
| Server  | `apps/server/src/opportunity-discovery-service.ts`, `opportunity-defaults.ts`, `routes/opportunities.ts`                                                                                                 |
| Web     | `apps/web/src/pages/opportunity-discovery-page.tsx`; components `opportunity-hypotheses-view.tsx`, `opportunity-scenarios-view.tsx`, `opportunity-progress.tsx`; `apps/web/src/lib/opportunity-types.ts` |
| Routes  | `/processes/:id/opportunities/hypotheses`, `/processes/:id/opportunities/scenarios`                                                                                                                      |
| Tests   | `tests/opportunity-domain.test.ts`, `opportunity-api.test.ts`, `opportunity-storage.test.ts`, `opportunity-ai-contract.test.ts`, `opportunity-fixtures.ts`                                               |

## Implementation status

**Implemented.** The two-call job, the deterministic selection rule with its
medium-confidence fallback, the seven-state machine with phase-scoped retry, the three
scenario levels with reference integrity, contract freezing, and SSE progress are all
built and covered by four test files.

## Constraints

- Exactly one hypothesis call followed by at most one scenario call. No other loop.
- No solution assessment, no financial values, no scoring, no prioritisation, no handover.
- Scenarios are read-only and always `ai_inferred`.
- Every scenario must name human oversight; a scenario without it fails validation.
- Prompts and response schemas are versioned repository files.

## Open items

See [`../BACKLOG.md`](../BACKLOG.md).
