# Live findings behind the process-understanding scope

## Status

This document contains observations that led to the active specification in
[`PRODUCT-FLOW-KI-POTENTIAL.md`](./PRODUCT-FLOW-KI-POTENTIAL.md). It is not a
second product specification and defines no additional behavior.

## Finding 1: qualification occurred before process understanding

The first live prototype asked four KI-potential questions and stopped the flow
when no internal answer was `yes`. That meant the system attempted to classify
a process before it had produced a reusable understanding of the process.

The active product direction removes this qualification gate. Every submitted
process proceeds to a confirmed process brief and high-level process map.

## Finding 2: `ASSESS-0009` exposed the premature classification

The form-mode test `ASSESS-0009`, `Retargeting Cold Leads`, supplied evidence
about:

- CRM and customer information;
- previous communication and product interests;
- contact-permission checks;
- selection of cold leads;
- template use and customer-specific email changes.

The first model call returned four `unclear` decisions. After one combined
follow-up, the second call returned four `no` decisions with confidence between
55 and 65. The stored record therefore ended as
`submitted_without_clear_ai_signal` and never reached detailed capture.

This result was too early and too dependent on the evaluator's interpretation.
The same process description supports both deterministic activities and
potential language-generation work, but neither conclusion substitutes for a
confirmed description of how the current process works.

`ASSESS-0009` remains unchanged as historical audit evidence. Its result is not
an active gateway rule or a regression target for the immediate two-page flow.

## Finding 3: assessment values require a defined solution

Savings, customer value, risk, effort, and feasibility cannot be assessed for an
abstract process. They depend on a concrete future solution and its scope,
responsibilities, human controls, and autonomy.

For Cold Leads, a writing assistant, a partially automated campaign, and an
autonomous outreach agent produce materially different values. Asking for one
set of assessment numbers before defining that target creates arbitrary output.

The active scope therefore ends at confirmed process understanding. KI-use-case
generation, solution definition, assessment, and prioritization require later,
separate product specifications.

## Finding 4: the department must describe work, not KI architecture

Department managers can describe:

- triggers, activities, roles, and results;
- information, documents, and visible systems;
- decisions, controls, and handovers;
- pain points and desired business improvements.

They must not be required to choose agents, RAG, tool calling, technical
integrations, model architecture, or autonomy patterns. Future KI-use-case work
must translate operational facts into technical possibilities without shifting
architecture responsibility to the submitter.

## Finding 5: prototype speed matters

Ten to fifteen minutes per process is too costly when one manager may submit
several processes. The agreed target is three to five minutes of active user
time with:

- one fixed `compact-v1` profile;
- five operational topic blocks;
- no more than one useful follow-up per block;
- five to eight high-level process steps;
- one main path and no rare-edge-case modeling;
- a small number of relevant and current documents.

The prototype assumes cooperative users who provide useful sentences or bullet
points. It does not optimize for deliberately uninformative or adversarial
answers.

## Finding 6: visualization improves validation

A concise process brief alone makes ordering and handover errors difficult to
spot. A deterministic high-level process map lets managers recognize whether
the KI misunderstood sequence, responsibility, or a material decision.

The map is therefore part of the output, but remains deliberately simpler than
BPMN: five to eight ordered business steps, optional role and system labels,
and only decisions required to understand the normal path.

## Operational follow-ups retained from the live prototype

- The setup page contains no voluntary process-description field.
- All records need a red, two-stage permanent delete action in the primary
  list. The prototype intentionally has no per-process archive or restore flow.
- Die Prozessaufnahme verwendet Claude Opus 4.8 mit `medium`; die getrennte
  Potenzialanalyse verwendet Claude Opus 4.8 mit `high`.
- Few relevant, current documents are the normal prototype assumption.
