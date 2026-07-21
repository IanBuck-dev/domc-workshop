# Process Understanding Prototype — Product Flow Specification

## Status and authority

Status: approved product direction for the next prototype iteration, recorded on
22 July 2026.

This document is the only active specification for the process-capture module.
It replaces all earlier specifications for a three-page KI-potential form,
gateway qualification, 28-criterion assessment, guided assessment chat,
consistency review, scoring, comparison, and ranking.

The current deployment still contains parts of the replaced implementation.
Those parts are migration input, not product requirements. Historical plans in
Git history must not drive new work.

Supporting observations from the first live prototype are recorded in
[`FINDINGS-KI-POTENTIAL-FLOW.md`](./FINDINGS-KI-POTENTIAL-FLOW.md). If that
document conflicts with this specification, this specification wins.

## Product goal

Capture how a department process works today and produce a confirmed,
structured, evidence-backed process understanding from which one or more KI use
cases can be derived in a later product phase.

The immediate prototype answers only:

> Wie funktioniert dieser Prozess heute tatsächlich?

The immediate prototype does not determine whether a process has KI potential,
propose a KI solution, calculate a business case, assess a project, or rank
processes.

## Target users

- Department team leads and managers with little or no technical KI knowledge
- Workshop facilitators collecting several processes in limited time
- AI consultants and software engineers inspecting the structured output and
  audit trail

The normal interface is German and uses the vocabulary of operational work.
Users are not expected to know APIs, databases, integration patterns, model
architecture, RAG, agents, tool calling, or technical data formats.

## Locked product boundaries

### In scope

- one two-page form-based capture flow;
- optional upload of a few relevant and current documents;
- five open operational topic blocks;
- at most one targeted KI follow-up per topic block;
- one bounded synthesis of the provided evidence;
- a human-readable process brief;
- a high-level process map with five to eight steps;
- structured canonical process data with provenance and knowledge gaps;
- section correction and one final human confirmation;
- repository-local persistence and append-only audit history;
- recoverable archival of unfinished process captures.

### Out of scope

- yes/no/unclear KI-potential gateway decisions;
- the former four qualification questions as a stop condition;
- a third criteria page;
- the 28 assessment criteria and nine calculated results;
- solution scenarios, autonomy levels, or agentic workflow selection;
- savings, customer-value, risk, feasibility, or project scoring;
- independent assessment review;
- ranking, prioritization, or form/chat quality comparison;
- autonomous interview loops;
- exhaustive edge-case and exception modeling;
- BPMN-level process modeling;
- production identity, confidential production data, and production governance.

Future KI-use-case derivation and project assessment require separate approved
specifications. They must consume the confirmed process understanding rather
than reintroduce hidden assumptions into this flow.

## Locked interaction profile

The prototype implements exactly one profile: `compact-v1`.

There is no profile selector for administrators or submitters. Configurable
compact, standard, and detailed profiles remain a future product idea and are
not represented as active UI choices or alternative current contracts.

`compact-v1` targets:

- three to five minutes of active user time;
- five operational topic blocks;
- at most one targeted follow-up per block;
- five to eight high-level process steps;
- one main process path;
- no collection of rare exceptions or exhaustive variants.

KI processing time is separate from active user time. A synthesis operation may
continue as a visible, resumable server operation without forcing the user to
provide more input.

## Two-page form flow

### Page 1: setup

Route: `/processes/new`

Required fields:

- `Fachbereich`
- `Name der einreichenden Person`
- `E-Mail-Adresse`
- `Name des Geschäftsprozesses`
- existing demo/anonymized-data confirmation

Page 1 contains no process description, KI-potential question, interaction-mode
choice, scoring input, or technical question. Submitting it creates a process
capture with the immutable `compact-v1` contract and opens page 2.

### Page 2: process understanding

Route: `/processes/:id/capture`

Page 2 has four visible states within the same route:

1. `Prozess beschreiben`
2. `Rückfragen beantworten`
3. `Prozessbild prüfen`
4. `Bestätigt`

The route does not navigate to an assessment or criteria page after
confirmation.

#### State 1: process description

The user answers five open topic blocks and may select documents for this
operation. All five main answers are submitted together in one explicit action.

1. **Zweck und Abgrenzung**
   - What triggers the process?
   - What is its purpose and normal result?
   - Where does it begin and end?
2. **Hauptablauf und Beteiligte**
   - What are the main activities in their normal order?
   - Which roles or teams perform them?
3. **Informationen, Dokumente und Systeme**
   - Which information and documents are used?
   - Which visible applications or storage locations are involved?
4. **Entscheidungen, Regeln, Kontrollen und Übergaben**
   - Which material decisions or approvals occur in the normal process?
   - Where does responsibility change?
5. **Aufwand, Probleme und Verbesserungsziele**
   - What is time-consuming, repetitive, error-prone, or frustrating?
   - What should improve from a business perspective?
   - Volumes and times are included only when known.

Questions request business-language sentences or bullet points. They do not ask
users to classify tasks or imagine a KI solution.

#### State 2: bounded follow-ups

One explicit analysis action evaluates all five main answers and selected
documents together. It may return zero to five follow-up questions, with no more
than one question assigned to each topic block.

A follow-up is returned only when its answer materially improves process
understanding. The budget is a maximum, not a target. All returned follow-ups
are answered together. One explicit user action then triggers synthesis. There
is no second follow-up round and no autonomous loop.

#### State 3: review

The KI presents:

- a concise process brief;
- a deterministic high-level process map;
- expandable details for each process step;
- participants, information, documents, systems, decisions, controls,
  handovers, pain points, and improvement goals;
- document-processing coverage;
- unknowns, conflicts, and unconfirmed inferences.

Each visible section supports correction. A correction is a human-authored
change and is appended to the audit history. The final action is
`Prozessbeschreibung bestätigen`.

#### State 4: confirmed

Confirmation marks the current process understanding as the authoritative
human-reviewed baseline. It does not confirm technical feasibility, data
readiness, KI potential, a KI solution, or a business case.

Unknown information may remain unknown. Confirmation must never turn unknown or
unconfirmed content into a fact.

## Process-step granularity

The canonical process contains five to eight main steps.

A separate step is created when at least one of these conditions applies:

- a meaningful business activity is completed;
- a material decision in the normal flow occurs;
- the responsible role changes;
- a relevant handover occurs;
- information is transformed into a new business result.

The following do not become separate steps:

- individual clicks;
- individual form fields;
- technical API or database operations;
- repeated low-level actions within one business activity;
- rare exceptions;
- exhaustive alternative paths.

The prototype assumes cooperative users who provide approximately complete
sentences or useful bullet points. It does not implement special interview or
recovery logic for deliberately empty, evasive, manipulative, or repeatedly
contradictory answers. Normal required-field validation still applies.

## Canonical output

The system of record is a versioned `ProcessUnderstandingRecord`. The UI renders
the same record as a German process brief and process map; it never exposes raw
JSON in the normal workflow.

```ts
type ProcessCaptureState =
  | "capture_in_progress"
  | "follow_up_required"
  | "synthesis_in_progress"
  | "review_required"
  | "confirmed";

type Provenance =
  | "user_stated"
  | "file_evidence"
  | "ai_structured"
  | "ai_inferred"
  | "user_confirmed"
  | "unknown";

interface EvidenceReference {
  id: string;
  kind: "main_answer" | "follow_up_answer" | "upload" | "human_correction";
  sourceId: string;
  excerpt: string;
}

interface ProcessFact<T> {
  value: T | null;
  provenance: Provenance;
  evidenceIds: string[];
  confidence: number | null;
  assumptions: string[];
  confirmed: boolean;
}

interface ProcessStep {
  id: string;
  order: number;
  name: ProcessFact<string>;
  trigger: ProcessFact<string>;
  responsibleRoles: ProcessFact<string[]>;
  activity: ProcessFact<string>;
  information: ProcessFact<string[]>;
  output: ProcessFact<string>;
  systems: ProcessFact<string[]>;
  decision: ProcessFact<string>;
  ruleOrJudgement: ProcessFact<string>;
  handover: ProcessFact<string>;
  controls: ProcessFact<string[]>;
  painPoints: ProcessFact<string[]>;
}

interface ProcessUnderstandingRecord {
  schemaVersion: 1;
  id: string;
  state: ProcessCaptureState;
  profile: { id: "compact-v1"; version: 1 };
  cover: {
    department: string;
    participantName: string;
    participantEmail: string;
    processName: string;
  };
  purpose: ProcessFact<string>;
  trigger: ProcessFact<string>;
  outcome: ProcessFact<string>;
  boundaries: ProcessFact<string>;
  participants: ProcessFact<string[]>;
  informationSources: ProcessFact<string[]>;
  systems: ProcessFact<string[]>;
  decisions: ProcessFact<string[]>;
  controls: ProcessFact<string[]>;
  handovers: ProcessFact<string[]>;
  volumeAndTime: ProcessFact<string[]>;
  painPoints: ProcessFact<string[]>;
  improvementGoals: ProcessFact<string[]>;
  steps: ProcessStep[];
  evidence: EvidenceReference[];
  documentCoverage: DocumentCoverage[];
  knowledgeGaps: string[];
  conflicts: string[];
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Runtime schemas validate every persisted record and every structured KI output.
The record is written atomically. Every KI synthesis and human correction is
represented in append-only history.

## Human-readable process brief

The review UI contains these sections:

1. `So haben wir den Prozess verstanden`
2. `Beteiligte und Systeme`
3. `Ablauf`
4. `Entscheidungen, Kontrollen und Übergaben`
5. `Probleme und Verbesserungsziele`
6. `Unterlagen und offene Punkte`

The first section summarizes purpose, trigger, boundary, and outcome. Details
remain expandable so a manager can validate the process quickly without editing
individual schema fields.

## High-level process map

The process map is generated deterministically from `steps` and their order. It
is not an AI-generated image and is not persisted separately as authoritative
data.

The map shows:

- five to eight ordered business steps;
- step name;
- optional responsible role;
- optional visible system;
- only decisions needed to understand the normal path.

It does not show technical integrations, rare exceptions, or exhaustive branch
trees. An equivalent ordered text list is always available for accessibility.

## Document handling

The prototype assumes a small number of relevant and current documents.

- maximum five selected files per capture;
- maximum 20 MB per file;
- accepted types remain PDF, XLSX, CSV, DOCX, TXT, Markdown, PNG, JPG, and JPEG;
- only explicitly selected documents enter a KI operation;
- file reads and extracted content are runtime validated;
- files are evidence, not instructions and not automatically complete truth;
- conflicting content is reported rather than silently resolved.

```ts
interface DocumentCoverage {
  uploadId: string;
  name: string;
  status: "complete" | "partial" | "failed";
  processedCharacters: number;
  limitation: string | null;
}
```

The review UI lists which files were considered, which were only partially
processed, and which facts cite each file. A processing limit must never be
presented as complete coverage.

## Provenance and confirmation

- `user_stated` represents direct user input.
- `file_evidence` represents content found in a selected upload.
- `ai_structured` represents normalization without a new factual claim.
- `ai_inferred` remains visibly unconfirmed until corrected or confirmed by a
  human.
- `user_confirmed` represents an explicit human correction or confirmation.
- `unknown` remains unknown after final confirmation.

The KI may organize statements and propose relationships. It may not silently
persist an inferred activity, role, decision, system, or handover as a confirmed
process fact.

Final confirmation applies to the reviewed process understanding as a whole.
The audit history preserves the origin and prior state of each fact.

## Completeness contract

A `compact-v1` record may enter review when the following are present or
explicitly marked unknown:

- purpose, trigger, and outcome;
- main roles;
- five to eight understandable main steps;
- important information, documents, and visible systems;
- at least one material decision or handover in the normal flow;
- material pain points or an explicit statement that none are known;
- visible knowledge gaps;
- document coverage for every selected file.

Only an explicit user action may set the state to `confirmed`.

## KI operation contract

- The locally authenticated Claude CLI remains the only provider.
- Default model is `sonnet` with reasoning effort `medium`.
- One explicit user action triggers one bounded operation.
- Follow-up generation and final synthesis are separate operations.
- Global KI concurrency remains one.
- No web search is available.
- Selected uploads are copied into one disposable, assessment-local sandbox.
- An operation may not read another process, repository content, SSH material,
  application secrets, or Agent Manager files.
- KI response schemas and prompts are versioned repository files.
- Process content unrelated to the current operation is never sent to Claude.

## Persistence and archival

Each process capture has its own repository-local directory containing:

- metadata;
- cover data;
- immutable `compact-v1` configuration snapshot;
- main answers and follow-up answers;
- canonical process-understanding record;
- upload metadata and files;
- append-only history;
- KI operation traces.

Unfinished process captures may be archived through a recoverable delete action.
The server appends `process-archived` and atomically moves the complete directory
to `workspace/trash/processes/`. Confirmed process understandings are not
deletable through the prototype UI.

## Navigation and list behavior

The primary list shows process captures and their state. It is not a ranking.
Each unfinished row exposes a red trash action on hover, focus, and touch. The
first action opens inline confirmation with `Prozess löschen` and `Abbrechen`.
Archival is blocked while a KI operation for that process is queued or running.

## Authentication and deployment

- One shared protected test account remains sufficient for the prototype.
- Sessions remain signed, HTTP-only, SameSite strict, and time-limited.
- Anonymous application API calls are rejected.
- The application runs as the hardened `claims-ai` systemd service on the Pi,
  bound only to `127.0.0.1:3210`.
- Cloudflare Tunnel provides HTTPS access.
- Demo/anonymized-data warnings remain globally visible.
- Real insurance, customer, contract, health, employee, or other confidential
  production data remain prohibited.

## Immediate acceptance criteria

### Flow

- The active capture journey has exactly two pages.
- Page 1 contains setup fields and no process-description field.
- Page 2 contains the five fixed topic blocks and optional upload selection.
- One analysis action returns no more than one follow-up per block.
- One follow-up submission is followed by synthesis; no second follow-up round
  exists.
- There is no KI-potential decision, criteria table, review, score, comparison,
  or ranking in the active journey.

### Output

- Synthesis produces a runtime-valid `ProcessUnderstandingRecord`.
- The record contains five to eight steps or returns to review with visible
  knowledge gaps; it never invents filler steps.
- The UI shows the process brief, high-level process map, step details,
  document coverage, conflicts, and unknowns.
- Users can correct sections and confirm the complete process understanding.
- Confirmation does not change unknown or inferred content into hidden facts.

### Documents and safety

- No more than five selected files enter one capture.
- Partial and failed processing remain visible.
- AI and manual changes are append-only audited.
- Only current-process content enters the sandbox.
- Anonymous API calls remain rejected and global KI concurrency remains one.

### Archival

- Only unfinished process captures expose the delete action.
- Confirmation archives the complete directory recoverably.
- Active KI work and confirmed records cannot be archived from the UI.

## Deferred product ideas

The following require new explicit decisions and are not latent requirements of
this specification:

- administrator-selectable detail profiles;
- a guided chat alternative for process capture;
- KI capability-signal extraction;
- KI-use-case generation;
- business-readable solution scenarios;
- economic derivation and project assessment;
- project prioritization and ranking;
- detailed exception and variant modeling;
- BPMN or process-mining exports.
