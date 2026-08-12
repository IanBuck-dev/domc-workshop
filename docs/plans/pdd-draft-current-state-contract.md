# Preliminary PDD: current-state field contract

## Purpose

This document inventories `PDD_Draft.xlsx` and defines how the application should
capture, validate, and deterministically fill the preliminary PDD without an agent
editing Excel. It is a discovery contract, not an implementation plan.

The source workbook inspected on 2026-08-12 has SHA-256
`15cdc24c2152dd57820c318f712195696573aaebeb008f4cf6ef0f40df34f662`.
The workbook is preliminary; static wording and excluded sheets still require review by
the owning group.

## Locked scope

- One `Process Record` is the domain aggregate. It owns capture material, the Process
  Understanding, the Process Diagram, fixed current-state details, confirmation,
  provenance, and validation state. The parts may remain in multiple atomic files.
- The Process Understanding is one confirmed component of the Process Record, not the
  entire aggregate.
- Only `Deckblatt`, `01_Prozessdefinition`, and `02_Prozessschritte` are populated in this
  phase.
- Sheets 4–17 remain byte-for-byte template content and are not populated, cleared,
  validated, or used to decide PDD readiness.
- Populated content describes only the current `Ist-Zustand`.
- Target state, expected benefit, optimization focus, optimization potential, scoring,
  prioritization, economics, solution assessment, and delivery planning are excluded.
- Excluded fields on sheets 1–3 render `Nicht Bestandteil dieser Ausbaustufe – Fokus auf
Ist-Zustand.` They are `not_applicable` with reason `future_scope`, not knowledge gaps.
- Every required current-state fact is `known`, `unknown`, or `not_applicable`. An
  `unknown` fact creates a visible knowledge gap and requires the existing
  confirmation-with-gaps override. It does not prohibit confirmation or export.
- The workbook is a replaceable presentation contract. Domain objects never store sheet
  names, cell addresses, row numbers, formatting, or workbook formulas.
- Export contains no AI call. Capture AI may structure the user's process description;
  the user reviews and confirms the stored domain facts before export.

## Workbook inventory

The workbook contains 17 visible sheets, 16 Excel tables, 10 data-validation blocks,
comments, formulas, custom XML, and VML comment drawings. It has no macros, external
links, data connections, pivot tables, or sheet protection.

|    # | Sheet                  | Role in this phase           | Structural notes                                                                                                                |
| ---: | ---------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
|    1 | `Deckblatt`            | Populate                     | Direct input cells in `B5:B15`; comments on four blank inputs; no formulas                                                      |
|    2 | `01_Prozessdefinition` | Populate current-state cells | Fixed layout, merged value ranges, print area `A1:L24`, repeated print rows 1–3                                                 |
|    3 | `02_Prozessschritte`   | Populate current-state rows  | Eight process rows; four future optimization rows; validations in `H7:H14` and `F18:F21`; print area `A1:I23`                   |
| 4–17 | Project dossier        | Preserve unfilled            | Business case, architecture, KI scoring, compliance, RACI, milestones, risks, tests, change, decision paper, sources, dashboard |

The excluded dossier is not aligned with the active product boundary. It includes
financial values, scores, risks, prioritization inputs, milestones, implementation,
handover, and project-management content. Its dashboard also contains four pre-existing
`#REF!` formulas. These facts do not block the three-sheet current-state contract because
the excluded sheets are neither populated nor evaluated.

## Process Record shape

The names below are domain names. Exact Zod declarations and migration mechanics belong
in the later implementation plan.

```text
Process Record
├─ identity and capture metadata
├─ capture material
│  ├─ free-text answers or chat transcript
│  ├─ follow-up answers
│  └─ selected documents and coverage
├─ Process Understanding
│  ├─ confirmed narrative facts
│  ├─ typed Process Steps
│  ├─ typed Process Diagram
│  ├─ evidence, provenance, confidence, assumptions
│  └─ gaps and conflicts
├─ current-state details
│  ├─ current-state summary
│  ├─ process owner
│  ├─ confidentiality
│  ├─ system catalog
│  ├─ pain-point catalog
│  ├─ process variations
│  └─ operational context
├─ confirmation metadata
└─ derived PDD coverage report
```

### Qualified current-state value

Every new current-state value uses the same evidence-aware semantics as an existing
Process Understanding fact.

```ts
type CoverageState = "known" | "unknown" | "not_applicable";

type QualifiedCurrentStateValue<T> = {
  state: CoverageState;
  value: T | null; // present exactly when state === "known"
  reason: string | null; // required for unknown and not_applicable
  provenance:
    | "user_stated"
    | "file_evidence"
    | "ai_structured"
    | "ai_inferred"
    | "user_confirmed"
    | "unknown";
  evidenceIds: string[];
  confidence: number | null;
  assumptions: string[];
  confirmed: boolean;
};
```

Rules:

- `known` requires a non-null value.
- `unknown` requires a concrete gap statement and uses `provenance: unknown` until new
  evidence replaces it.
- `not_applicable` requires a reason. `future_scope` is the reason for the excluded
  future-state PDD fields.
- AI may create `ai_structured` values from supplied process material. It must not invent
  values or convert absent information into `known`.
- Human confirmation does not erase the original evidence chain.
- PDD coverage is computed from the confirmed source revision. It is not persisted as an
  independently editable truth that could become stale.

### New current-state details

```ts
type CurrentStateDetails = {
  schemaVersion: 1;
  currentStateSummary: QualifiedCurrentStateValue<string>; // AI-generated 2–3 sentences
  processOwner: QualifiedCurrentStateValue<{
    department: string;
    role: string;
  }>;
  confidentiality: QualifiedCurrentStateValue<
    "internal" | "confidential" | "strictly_confidential"
  >;
  systems: QualifiedCurrentStateValue<ProcessSystem[]>;
  painPoints: QualifiedCurrentStateValue<ProcessPainPoint[]>;
  variations: QualifiedCurrentStateValue<ProcessVariation[]>;
  operationalContext: {
    operationAndSupport: QualifiedCurrentStateValue<string>;
    accessAndProtection: QualifiedCurrentStateValue<string>;
    monitoringAndTraceability: QualifiedCurrentStateValue<string>;
    constraintsAndOpenQuestions: QualifiedCurrentStateValue<string[]>;
  };
};

type ProcessSystem = {
  id: string;
  name: string;
  kind:
    "application" | "repository" | "communication" | "manual_tool" | "other";
};

type ProcessPainPoint = {
  id: string;
  description: string;
};

type ProcessVariation = {
  id: string;
  name: string;
  kind: "flow_branch" | "step_exception";
  trigger: string;
  currentHandling: string;
  affectedStepIds: string[];
  gatewayId: string | null;
};
```

`currentStateSummary` is generated during the bounded Process Understanding synthesis
from the current process's captured evidence. It is `ai_structured`, never invented at
export time, and becomes exportable only after the user reviews and confirms it.

`confidentiality` defaults to `internal` for a new process but remains a stored,
confirmable fact. The process owner is an organizational department plus accountable
role; it never stores a person's name.

### Typed Process Step additions

```ts
type ProcessActor = {
  id: string;
  kind: "department" | "role" | "external_party";
  name: string;
  involvement: "performs" | "decides" | "approves" | "receives" | "supplies";
};

type StepPainPoint = {
  painPointRef: string;
  cause: string | null;
};

type StepDecision = {
  description: string;
  humanInvolvement: "yes" | "partial" | "no" | "unknown";
  decisionOwnerActorRef: string | null;
};

type ProcessStepCurrentState = {
  actors: ProcessActor[];
  systemRefs: string[];
  painPoints: StepPainPoint[];
  decisions: StepDecision[];
  exceptionRefs: string[]; // only step_exception variations
};
```

The existing step `name` is the diagram title and `activity` is its sublabel/description.
Neither is the process-level `currentStateSummary`.

The diagram shows a compact `n Ausnahmen` badge on a step when `exceptionRefs` is not
empty. Activating the badge opens the existing step-detail dialog at `Varianten und
Ausnahmen`; the diagram does not duplicate the exception text.

### Transition and gateway additions

```ts
type ProcessHandoff = {
  fromActorRef: string;
  toActorRef: string;
  transferredInformationIds: string[];
  channel: string;
  mediaBreak: "yes" | "no" | "unknown";
  note: string | null;
};

type TransitionCurrentState = {
  handoff: QualifiedCurrentStateValue<ProcessHandoff>;
};

type GatewayCurrentState = {
  variationRef: string; // flow_branch variation
  humanInvolvement: "yes" | "partial" | "no" | "unknown";
  decisionOwnerActorRef: string | null;
};
```

A system change may trigger a validation question but never proves a media break. A
gateway proves a branch but does not by itself prove that a human decides. Decision
ownership and human involvement are explicit facts.

## Exact workbook mapping

### Sheet 1: `Deckblatt`

| Cell  | Template label                      | Source                                        | Export rule                                             | PDD readiness          |
| ----- | ----------------------------------- | --------------------------------------------- | ------------------------------------------------------- | ---------------------- |
| `B5`  | Projektname                         | `record.cover.processName`                    | Exact confirmed process name                            | Required known         |
| `B6`  | Projekt-ID                          | `record.id`                                   | Exact stable process ID                                 | Required known         |
| `B7`  | Projektart                          | Mapping constant                              | `Prozessdokumentation – Ist-Zustand`                    | Fixed                  |
| `B8`  | Version                             | Export metadata                               | Template version plus confirmed source-revision prefix  | Derived                |
| `B9`  | Erstellt am                         | Export metadata                               | Export date in the workbook's date format               | Derived                |
| `B10` | Erstellt von                        | `record.cover.participantName`                | Captured participant display name; no inference         | Required known         |
| `B11` | Projektverantwortlicher Fachbereich | `currentStateDetails.processOwner.department` | Department only                                         | Required known/unknown |
| `B12` | IT-Ansprechpartner                  | Future scope                                  | Scope notice                                            | Not applicable         |
| `B13` | Status                              | `confirmationQuality`                         | `Fachlich bestätigt` or `Mit offenen Punkten bestätigt` | Derived                |
| `B14` | Entscheidung erforderlich bis       | Future scope                                  | Scope notice                                            | Not applicable         |
| `B15` | Vertraulichkeit                     | `currentStateDetails.confidentiality`         | German label; default `Intern`                          | Required known         |

Static text on the cover remains template-owned. The group should later decide whether
the automation/KI subtitle, project-oriented purpose paragraph, and scoring/dashboard
usage note still belong in a current-state-only PDD.

### Sheet 2: `01_Prozessdefinition`

| Cell/range | Template label                   | Source                                                      | Export rule                                                                                    | PDD readiness                                        |
| ---------- | -------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `B6:D6`    | Prozess / Use Case               | `record.cover.processName`                                  | Exact name                                                                                     | Required known                                       |
| `G6:H6`    | Prozesseigner                    | `processOwner`                                              | `role — department`                                                                            | Required known/unknown                               |
| `K6:L6`    | Stand / Version                  | Confirmation and export metadata                            | Confirmation date plus template/source revision                                                | Derived                                              |
| `B7:H7`    | Kurzbeschreibung                 | `currentStateSummary`                                       | AI-generated and human-confirmed 2–3 sentence description of how the whole process works today | Required known/unknown                               |
| `K7:L7`    | Betroffene Bereiche              | `processOwner` + `steps[].actors`                           | Unique deterministic aggregation of departments, roles, and external parties                   | Derived; at least one actor required                 |
| `B8:H8`    | Ausgangslage / Problem           | `currentStateDetails.painPoints`                            | At most three confirmed current pain points, no severity or recommendation                     | Required known/unknown                               |
| `K8:L8`    | Zielbild                         | Future scope                                                | Scope notice                                                                                   | Not applicable                                       |
| `B9:H9`    | Prozessziel                      | `understanding.outcome`                                     | Current process's intended business result, not a future solution target                       | Required known/unknown                               |
| `K9:L9`    | Abgrenzung                       | `understanding.boundaries`                                  | Confirmed in-scope/out-of-scope boundary                                                       | Required known/unknown                               |
| `B12:D12`  | Start-Ereignis                   | `understanding.trigger`                                     | Exact current trigger                                                                          | Required known/unknown                               |
| `G12:H12`  | End-Ereignis                     | `understanding.outcome`                                     | Exact current business outcome                                                                 | Required known/unknown                               |
| `K12:L12`  | Volumen / Frequenz               | `understanding.volumeAndTime`                               | Confirmed values; unknown parts remain explicit                                                | Required known/unknown                               |
| `B13:D13`  | Inputs / Kanäle                  | `understanding.informationSources` + step information items | Unique current inputs and ingress channels; no technical inference                             | Required known/unknown                               |
| `G13:H13`  | Outputs                          | final reachable steps' outputs + `understanding.outcome`    | Unique current outputs; branching outcomes remain distinguishable                              | Derived from required facts                          |
| `K13:L13`  | Varianten / Ausnahmen            | `currentStateDetails.variations`                            | Names plus triggers; `flow_branch` and `step_exception` remain identifiable                    | Required known/not applicable/unknown                |
| `B14:D14`  | Beteiligte Rollen                | `steps[].actors`                                            | Unique actors with involvement; no personal names                                              | Derived; every step requires an actor                |
| `G14:H14`  | Aktuelle Systeme                 | referenced `currentStateDetails.systems`                    | Unique systems actually referenced by confirmed steps                                          | Derived; unreferenced catalog entries omitted        |
| `K14:L14`  | Medienbrüche                     | transitions' confirmed handoffs                             | Only handoffs with `mediaBreak: yes`; `unknown` handoffs create a gap                          | Derived from required facts                          |
| `B17:H17`  | Erwarteter Nutzen                | Future scope                                                | Scope notice                                                                                   | Not applicable                                       |
| `K17:L17`  | Erfolg erkennbar an              | Future scope                                                | Scope notice                                                                                   | Not applicable                                       |
| `B18:H18`  | Größte Pain Points               | `currentStateDetails.painPoints`                            | Same canonical pain points as `B8:H8`; no duplicate storage                                    | Required known/unknown                               |
| `K18:L18`  | Optimierungsfokus                | Future scope                                                | Scope notice                                                                                   | Not applicable                                       |
| `B21:D21`  | Betroffene Systeme               | referenced systems                                          | Same deterministic current-system set as `G14:H14`                                             | Derived                                              |
| `G21:H21`  | Schnittstellen / Datenflüsse     | transitions' handoffs                                       | `from → to: information via channel`; current state only                                       | Required known/not applicable/unknown per transition |
| `K21:L21`  | Betrieb / Support                | `operationalContext.operationAndSupport`                    | Current operational ownership and fallback                                                     | Required known/not applicable/unknown                |
| `B22:D22`  | Berechtigung / Schutzbedarf      | `operationalContext.accessAndProtection`                    | Current access and protection context                                                          | Required known/not applicable/unknown                |
| `G22:H22`  | Monitoring / Nachvollziehbarkeit | `operationalContext.monitoringAndTraceability`              | Current logging, control, and traceability                                                     | Required known/not applicable/unknown                |
| `K22:L22`  | Offene Leitplanken               | `operationalContext.constraintsAndOpenQuestions`            | Only unresolved current-state constraints/questions; future design questions are excluded      | Required known/not applicable/unknown                |

Repeated values in Excel always originate from one canonical fact. The mapping repeats
them for document readability; storage does not duplicate them.

### Sheet 3: `02_Prozessschritte`

The eight process rows in `A7:I14` align with the existing Process Understanding limit
of eight steps. Rows are populated in confirmed step order.

| Column | Template label            | Source                                     | Export rule                                                                | Validation                                        |
| ------ | ------------------------- | ------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------- |
| `A`    | Nr.                       | `step.order`                               | 1–8                                                                        | Existing contiguous-order validation              |
| `B`    | Prozessschritt            | `step.name` + `step.activity`              | Name followed by activity when activity adds information                   | Both required known                               |
| `C`    | Rolle / System heute      | `step.actors` + `step.systemRefs`          | Actors with involvement, then referenced systems                           | At least one actor; all refs resolve              |
| `D`    | Input                     | `step.inputs` + `step.informationItems`    | Unique current inputs; preserve meaningful item names                      | Required known/unknown                            |
| `E`    | Output                    | `step.outputs`                             | Unique current outputs                                                     | Required known/unknown                            |
| `F`    | Pain Point / Ursache      | `step.painPoints`                          | Canonical pain-point description plus optional step-specific cause         | `not_applicable` allowed; dangling refs forbidden |
| `G`    | Optimierungspotenzial     | Future scope                               | Scope notice                                                               | Not applicable                                    |
| `H`    | Menschliche Entscheidung? | step decisions + adjacent gateway metadata | Exactly one existing dropdown value: `Ja`, `Teilweise`, `Nein`, or `Offen` | Unknown involvement/owner creates gap             |
| `I`    | Hinweis / Abhängigkeit    | handoffs + step exceptions                 | Current handoff, decision owner, dependency, and exception summary         | Required known/not applicable/unknown             |

The workbook provides exactly eight process rows. A Process Record already permits at
most eight steps, so export must never truncate or append rows silently.

Section 6 (`A16:I21`) is future scope. Populate `B18` with the scope notice and leave the
remaining reserved optimization cells empty. Do not create optimization IDs, criticality,
effects, prerequisites, or next-step recommendations.

## Deterministic PDD readiness

PDD readiness is a pure validation over one confirmed Process Record and one template
contract version.

```text
known facts ───────────────┐
not_applicable + reason ───┼─► covered
unknown + gap reason ──────┴─► covered_with_gap
missing state / bad ref ─────► invalid
```

### Invalid before confirmation

- A required field has no coverage state.
- A `known` field has no value.
- An `unknown` or `not_applicable` field has no reason.
- A new fact lacks provenance, confirmation state, or valid evidence references.
- A step has no actor.
- A step references an unknown actor, system, pain point, or exception.
- A `flow_branch` variation lacks a gateway, or a `step_exception` lacks affected steps.
- A gateway's variation reference does not resolve.
- A human decision is present but human involvement is unknown or its required owner is
  absent.
- A handoff references unknown actors/information or does not state media-break coverage.
- More than eight process steps exist.

### Confirmation quality

- `complete`: every required current-state fact is known or explicitly not applicable;
  no knowledge gaps or conflicts remain.
- `with_gaps`: every field has a coverage state, but at least one required current-state
  fact is `unknown`, a handoff/decision remains unknown, or an existing conflict remains.
- Future-scope fields never lower confirmation quality.
- The user sees every gap and explicitly confirms with the existing override dialog.

### Export validation

- Source Process Record is confirmed.
- Coverage report matches the confirmed source revision.
- Template id/version/hash match the versioned mapping contract.
- All mapped rows and merged ranges exist as expected. Blank target cells may be absent
  from worksheet XML and are inserted in column order with their template style.
- Sheets 4–17 and all non-target parts are unchanged.
- No placeholder text remains in target current-state cells.
- Formula-like process text is written as literal text.
- Output reopens as OOXML; macros and external links remain absent.
- Export audit includes template hash, mapping version, source revision, output hash,
  confirmation timestamp, export timestamp, and initiating user.

## Process Erfassen checklist

The checklist is a validation view over the Process Record, not a second questionnaire
and not a manually maintained checklist object.

### Process creation

- [ ] Process name captured.
- [ ] Department captured.
- [ ] Participant identity captured for audit and later `Erstellt von`.
- [ ] Confidentiality initialized to `Intern` and shown for confirmation later.
- [ ] Process owner is intentionally deferred from this first page.

### `purpose-scope`

- [ ] Current trigger captured.
- [ ] Current business outcome/process goal captured.
- [ ] Current boundaries captured.
- [ ] Volume/frequency and timing captured or explicitly unknown.
- [ ] AI generates the current-state summary in 2–3 sentences from supplied evidence
      during the bounded Process Understanding synthesis.
- [ ] Summary contains no target state, solution recommendation, or invented fact.

### `flow-roles`

- [ ] Process owner department and accountable role captured; no personal name.
- [ ] One to eight ordered steps captured with name and activity.
- [ ] Every step has at least one structured actor and involvement.
- [ ] Step actors distinguish department, role, and external party.
- [ ] Material variations identified.
- [ ] Path-changing variations are represented once as `flow_branch` and linked to an
      XOR gateway.
- [ ] Small handling differences are represented once as `step_exception` and linked to
      affected steps.
- [ ] Step-exception counts can be shown on diagram nodes without duplicating details.

### `information-systems`

- [ ] Process-level system catalog captured.
- [ ] Every step references the systems it actually uses.
- [ ] Inputs, outputs, information items, sources, and channels captured per step.
- [ ] Current operation/support ownership and fallback captured or explicitly not
      applicable/unknown.
- [ ] Current access and protection context captured or explicitly not
      applicable/unknown.
- [ ] Current monitoring and traceability captured or explicitly not
      applicable/unknown.
- [ ] Current constraints/open technical questions captured separately from future
      solution-design questions.

### `decisions-controls-handoffs`

- [ ] Current decisions, approvals, and controls captured.
- [ ] Human involvement is explicit for each decision/gateway.
- [ ] Human decision owner references a confirmed step actor where required.
- [ ] Every responsibility/information handoff states source actor, target actor,
      transferred information, and current channel.
- [ ] Every handoff explicitly states media break `yes`, `no`, or `unknown`.
- [ ] A system change triggers a question but never automatically creates a media break.
- [ ] Gateway branches retain their rule/judgement mode, determination, consequence, and
      linked `flow_branch` variation.

### `effort-pain-goals`

- [ ] Canonical current pain points captured without severity, scoring, or priority.
- [ ] Pain points are linked to affected steps with an optional current cause.
- [ ] Unlinked global pain points are surfaced for review.
- [ ] Improvement goals may remain part of the broader Process Understanding but do not
      populate the three-sheet current-state PDD.
- [ ] No optimization potential, expected future effect, target state, or solution
      recommendation is generated for this PDD phase.

### Review and confirmation

- [ ] Every required PDD current-state field is known, not applicable with reason, or
      unknown with a visible gap.
- [ ] Derived actor, system, output, media-break, and handoff lists can be computed with
      no unresolved references.
- [ ] Provenance, evidence, confidence, assumptions, and human confirmation remain
      inspectable for every stored fact.
- [ ] The process diagram and detailed step cards show the same canonical facts.
- [ ] The lead reviews all unknowns/conflicts and uses the explicit override when gaps
      remain.
- [ ] Confirmation freezes the source revision used by PDD export.

## Template adapter strategy

The real-template adapter should copy the original workbook and perform bounded OOXML
updates rather than regenerate the workbook from scratch.

1. Store the sanitized template as a versioned repository asset only after the group
   approves its content and removes personal/default project data.
2. Store a versioned mapping contract containing template id, template version, template
   SHA-256, mapping version, expected sheet order, exact target cells/ranges, and scope
   constants.
3. Parse and validate the confirmed Process Record and derive a typed PDD view model.
4. Validate PDD coverage and target-template structure before writing.
5. Copy the template package; replace only the top-left cells of mapped merged ranges and
   the cells in step rows `7:14` plus the single section-level scope notice.
6. Preserve styles, merges, comments, validations, print areas, print titles, tables,
   formulas, custom XML, and excluded sheet XML.
7. Compare every non-target ZIP entry and every non-target worksheet byte-for-byte with
   the source template.
8. Reopen and validate the result, then atomically persist it and append the export audit
   event before returning the download.

The current synthetic seven-sheet generator remains test evidence but is not the writer
for this template. The real adapter needs a template-preservation contract and fixture
tests.

## Group alignment items

These are template decisions, not missing Process Record facts:

- Decide whether the cover's automation/KI subtitle and project-oriented purpose remain
  appropriate for a current-state-only PDD.
- Decide whether the cover note about scoring/dashboard sheets should remain visible.
- Decide whether sheet 2's note about later assessment belongs in the compact PDD.
- Rename sheet 3 or its section 6 if optimization content remains deferred long term.
- Decide whether sheets 4–17 stay in the distributed workbook, move into a separate
  downstream project dossier, or are removed.
- Repair or remove the excluded dashboard's four broken business-case references before
  that dossier is activated.
- Remove pre-filled personal/default project metadata before the template becomes a
  repository asset.

None of these decisions blocks capturing the current-state domain facts or implementing
the three-sheet mapping behind a feature flag.

## Future extension: optimization potential

A later, separately approved phase may introduce human-confirmed, problem-oriented
improvement hypotheses and populate the excluded future-state cells on sheets 2–3. That
phase must define its own domain schema, evidence requirements, human confirmation,
product boundary, and relationship to Opportunity Discovery. It must not silently derive
recommendations during PDD export and must not add scoring, prioritization, financial
values, or solution decisions without an explicit product-boundary change.
