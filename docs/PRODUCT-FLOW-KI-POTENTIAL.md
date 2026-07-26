# Implementation Plan — Two-Page Process Understanding Prototype

## Status, objective, and cleanup decision

Status: implementation plan approved for the current repository iteration.

Objective: replace the current assessment prototype and the older discovery/PDD
prototype with one compact two-page form that captures how a department process
works today and produces a confirmed, structured, evidence-backed process
understanding.

Cleanup is mandatory and belongs to this implementation. Keeping gateway,
criteria, scoring, ranking, comparison, PDD, idea-portfolio, and legacy chat
code would leave parallel domain models and unsupported routes that appear to
remain valid. The implementation therefore removes them after the replacement
process flow passes its focused tests.

The cleanup applies to repository code, defaults, dependencies, active routes,
UI, and tests. It must not delete or rewrite existing data under a deployed
`workspace/assessments/` or legacy `workspace/processes/` directory. Git history
and the reference commit `58ff74f` preserve the removed implementation.

## Required outcome

The completed process-capture module has one active product journey:

1. `/processes/new` — setup only;
2. `/processes/:id/capture` — five topic answers, at most one follow-up per
   topic, bounded synthesis, review, correction, and final confirmation.

The canonical result is a `ProcessUnderstandingRecord` containing five to eight
high-level business steps, evidence and provenance, document coverage, conflicts,
and visible knowledge gaps. The UI renders the record as a German process brief
and a deterministic high-level process map.

The process-capture journey does not classify KI potential, generate KI use
cases, define a solution, assess business value, calculate scores, review an
assessment, compare interaction modes, or rank projects. After confirmation, a
separate read-only Opportunity-Discovery module may consume only the confirmed
snapshot. Its two-phase behavior and additional files are governed exclusively
by [PLAN-KI-POTENTIAL-SCENARIOS.md](PLAN-KI-POTENTIAL-SCENARIOS.md); it does not
change the capture states or the confirmed process record.

## Locked product behavior

### Page 1 — setup

Required inputs:

- `Fachbereich`
- `Name der einreichenden Person`
- `E-Mail-Adresse`
- `Name des Geschäftsprozesses`
- demo/anonymized-data confirmation

There is no process-description field and no interaction-mode selector. Submit
creates a process capture with a validated immutable `compact-v1` configuration
snapshot and routes to page 2.

### Page 2 — capture and review

Page 2 remains one route and presents these states:

1. `capture_in_progress`
2. `follow_up_required` or `synthesis_ready`
3. `review_required`
4. `confirmed`

The five fixed topic IDs are:

1. `purpose-scope`
2. `flow-roles`
3. `information-systems`
4. `decisions-controls-handoffs`
5. `effort-pain-goals`

The initial UI shows one open question and help text for every topic. The user
submits all five answers together and may select up to five uploaded files for
analysis.

One explicit `analyze` action returns zero to five follow-up cards. A response
may contain no more than one follow-up for each configured topic ID. The user
answers all returned cards together. There is no second analysis round.

One explicit `synthesize` action generates the canonical process record. It
does not generate prose and structured data in separate model calls: one
structured result contains both the brief fields and step data. The UI derives
all visible text and the map from that validated result.

Review allows correction of:

- purpose, trigger, outcome, and boundaries;
- participant, information-source, system, decision, control, handoff,
  pain-point, and improvement-goal lists;
- every process step and its order;
- knowledge gaps and conflicts.

The final button `Prozessbeschreibung bestätigen` sets only the record-level
confirmation timestamp. It does not silently change fact provenance or mark
`ai_inferred` and `unknown` facts as confirmed.

The result section `Unterlagen und offene Punkte` retains each document's
coverage status and offers an authenticated preview dialog. PDF, PNG, JPEG,
TXT, Markdown, and CSV are shown in the browser; text is rendered as escaped
plain text. DOCX and XLSX show file metadata and a clear preview-unavailable
message. Every format can be downloaded with its safe original filename. The
prototype performs no document conversion and uses no external viewer.

### Fixed prototype constraints

- profile ID: `compact-v1`, active version `2`; version `1` remains readable
  only for existing captures;
- target active user time: three to five minutes;
- exactly five initial topic answers;
- exactly four required structured work-characteristic answers for active
  version-2 captures;
- at most one follow-up per topic;
- no second follow-up round;
- five to eight high-level process steps;
- one normal main path;
- no rare-edge-case or exhaustive variant modeling;
- maximum five selected documents;
- maximum 20 MB per file and 100 MB per process capture;
- Claude model `sonnet`, reasoning effort `medium`;
- one global AI operation at a time;
- no web tools or autonomous loops.

The prototype assumes cooperative users who provide useful sentences or bullet
points. It implements normal required-field validation but no special recovery
interview for deliberately empty, evasive, adversarial, or repeatedly
contradictory input.

## Target domain contracts

Create `packages/domain/src/process-understanding.ts` as the only process domain
module. It owns all Zod schemas, inferred TypeScript types, state transitions,
topic constants, completeness rules, and cross-record validation.

```ts
type ProcessCaptureState =
  | "capture_in_progress"
  | "follow_up_required"
  | "synthesis_ready"
  | "review_required"
  | "confirmed";

type TopicId =
  | "purpose-scope"
  | "flow-roles"
  | "information-systems"
  | "decisions-controls-handoffs"
  | "effort-pain-goals";

type FactProvenance =
  | "user_stated"
  | "file_evidence"
  | "ai_structured"
  | "ai_inferred"
  | "user_confirmed"
  | "unknown";

interface TopicAnswer {
  topicId: TopicId;
  text: string;
  answeredAt: string;
}

type WorkCharacteristicId =
  | "combined-information-sources"
  | "content-types"
  | "case-specific-recognition"
  | "uncertain-decisions";

interface WorkCharacteristicAnswer {
  characteristicId: WorkCharacteristicId;
  selectedOptionIds: string[];
  answeredAt: string;
}

interface FollowUpQuestion {
  id: string;
  topicId: TopicId;
  question: string;
  rationale: string;
}

interface FollowUpAnswer {
  questionId: string;
  topicId: TopicId;
  text: string;
  answeredAt: string;
}

interface EvidenceReference {
  id: string;
  kind: "main_answer" | "follow_up_answer" | "upload" | "human_correction";
  sourceId: string;
  excerpt: string;
}

interface ProcessFact<T> {
  value: T | null;
  provenance: FactProvenance;
  evidenceIds: string[];
  confidence: number | null;
  assumptions: string[];
  confirmed: boolean;
}

interface ProcessStep {
  id: string;
  order: number;
  name: string;
  trigger: string | null;
  responsibleRoles: string[];
  activity: string;
  information: string[];
  output: string | null;
  systems: string[];
  decision: string | null;
  ruleOrJudgement: string | null;
  handover: string | null;
  controls: string[];
  painPoints: string[];
  provenance: FactProvenance;
  evidenceIds: string[];
  confidence: number | null;
  assumptions: string[];
  confirmed: boolean;
}

Brief fields carry provenance and evidence individually. A high-level process
step carries them once for the step as a coherent fachliche unit; its detail
fields do not repeat identical metadata. This preserves traceability while
keeping the single bounded synthesis operation viable on the prototype host.

interface DocumentCoverage {
  uploadId: string;
  name: string;
  status: "complete" | "partial" | "failed";
  processedCharacters: number | null;
  limitation: string | null;
}

interface ProcessUnderstanding {
  purpose: ProcessFact<string>;
  trigger: ProcessFact<string>;
  outcome: ProcessFact<string>;
  boundaries: ProcessFact<string>;
  participants: ProcessFact<string[]>;
  informationSources: ProcessFact<string[]>;
  systems: ProcessFact<string[]>;
  decisions: ProcessFact<string[]>;
  controls: ProcessFact<string[]>;
  handoffs: ProcessFact<string[]>;
  volumeAndTime: ProcessFact<string[]>;
  painPoints: ProcessFact<string[]>;
  improvementGoals: ProcessFact<string[]>;
  steps: ProcessStep[];
  evidence: EvidenceReference[];
  documentCoverage: DocumentCoverage[];
  knowledgeGaps: string[];
  conflicts: string[];
}

interface ProcessCaptureRecord {
  schemaVersion: 1;
  id: string;
  state: ProcessCaptureState;
  profile: { id: "compact-v1"; version: 1 };
  configHash: string;
  cover: {
    department: string;
    participantName: string;
    participantEmail: string;
    processName: string;
  };
  configSnapshot: ProcessCaptureConfig;
  mainAnswers: TopicAnswer[];
  workCharacteristicAnswers: WorkCharacteristicAnswer[];
  followUps: FollowUpQuestion[];
  followUpAnswers: FollowUpAnswer[];
  selectedUploadIds: string[];
  understanding: ProcessUnderstanding | null;
  uploads: UploadRecord[];
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Domain invariants

- Topic IDs are unique and exactly match the five `compact-v1` IDs.
- Main answers contain exactly one non-empty answer per topic before analysis.
- Active version-2 captures contain exactly one valid answer for each of the
  four work characteristics before analysis. `none` and `unsure` are exclusive
  selections; no option is preselected.
- Follow-ups contain at most one item per topic and at most five items total.
- Follow-up answers exactly match the generated follow-up IDs and topic IDs.
- `synthesize` is permitted only after analysis and after all generated
  follow-ups are answered.
- A synthesized understanding contains five to eight uniquely identified steps
  ordered contiguously from `1`.
- Every evidence ID referenced by a fact exists in `understanding.evidence`.
- Every upload evidence reference and document-coverage entry belongs to the
  current process and selected upload set.
- `confirmed` is reachable only from `review_required` through an explicit
  confirm operation.
- Human correction invalidates `confirmedAt`, remains in `review_required`,
  records the previous value, and marks changed facts `user_confirmed`.
- Unknown facts remain `unknown`; record-level confirmation does not rewrite
  their provenance.

## Configuration and versioned AI contracts

Replace the assessment and workshop defaults with:

- `defaults/process-capture-config.json`
- `defaults/prompts/process-base.md`
- `defaults/prompts/process-follow-ups.md`
- `defaults/prompts/process-synthesis.md`
- `defaults/ai-schemas/process-follow-ups.json`
- `defaults/ai-schemas/process-understanding.json`

`ProcessCaptureConfig` contains:

- schema version;
- profile ID locked to `compact-v1`; active version locked to `2`;
- editable German departments;
- exactly five topic definitions with immutable IDs, visible question, help
  text, and display order;
- exactly four work-characteristic definitions with immutable IDs, topic
  assignments, selection kinds, option IDs, and option labels; only their
  question and help text are editable;
- separate follow-up and synthesis instruction fields;
- supported upload types and size/count limits;
- `sonnet`, `medium`, timeout, input limit, output limit, and budget.

The settings page may edit departments, visible topic wording, help text, and
the two instruction fields through browser-local overrides. It may also edit
the visible question and help text of each work characteristic, but not its
semantic contract. It does not expose
profile selection, topic count, follow-up budget, step-count limits, upload
limits, model, or reasoning effort in this iteration. Export, import, and reset
preserve the full validated config. Page 1 sends the effective config when it
creates a process; the backend validates, hashes, and freezes it.

An info action in `Hinweise für die KI-Unterstützung` opens a read-only dialog
with the effective instruction building blocks: the global versioned role once,
then the operation-specific Markdown prompt plus current configurable
instruction for follow-ups and synthesis. Unsaved field changes are included.
The same composition functions assemble these blocks into the two complete
Claude system prompts. The global role defines the form context, German `Sie`
communication, compact user-visible text, evidence discipline, and the boundary
that KI-potential identification happens only later. Markdown is rendered
without raw HTML. The dialog does not expose response schemas, process data,
model settings, or editing controls.

The follow-up result schema returns only:

```ts
{ followUps: FollowUpQuestion[] }
```

The synthesis result schema returns one complete `ProcessUnderstanding`.
Prompts prohibit KI-use-case suggestions, scoring, process classification,
technical architecture questions, and invented filler steps.

Follow-up generation passes the compact response schema through Claude CLI's
constrained `--json-schema` mode. The larger synthesis schema is embedded as a
versioned, binding prompt contract and the returned JSON is validated against
the same Zod schema before any write. This keeps one bounded synthesis call and
strict runtime validation while avoiding the repeatable timeout observed when
the full synthesis schema was passed through constrained CLI decoding.

## Storage design and expected artifacts

Create `packages/storage/src/process-capture-repository.ts`. Reuse
`atomic-write.ts` and `audit-log.ts`; remove both previous process repositories.

New data root:

```text
workspace/process-captures/PROC-0001/
  metadata.yaml
  cover.yaml
  config-snapshot.json
  answers.json
  follow-ups.json
  process-understanding.json
  uploads/
    <uuid>-<safe-name>
    <uuid>.meta.json
  operations.jsonl
  history.jsonl
```

Expected initial values:

- `answers.json`: `{ "mainAnswers": [], "selectedUploadIds": [] }`; the five
  visible empty answer slots are derived from the immutable topic snapshot and
  become evidence records only when the user submits them;
- `follow-ups.json`: `{ "questions": [], "answers": [] }`;
- `process-understanding.json`: `null`;
- `history.jsonl`: first event `process-created` with profile and config hash.

Repository operations:

- `create`
- `list`
- `get` / `required`
- `saveMainAnswers`
- `saveUpload`
- `readUpload`
- `selectUploads`
- `saveFollowUps`
- `saveFollowUpAnswers`
- `saveUnderstanding`
- `correctUnderstandingSection`
- `confirmUnderstanding`
- `recordAiOperation`
- `history`
- `deleteCapture`

All canonical writes are atomic. Audit and operation logs are append-only.
Uploads use UUID-backed names, extension/MIME validation, SHA-256 metadata, and
per-file/per-process limits. Every preview or download revalidates the stored
byte count and SHA-256 before returning content. An explicitly confirmed delete
removes the complete process directory recursively. Confirmed and unfinished
records can both be deleted. Deletion is rejected while an AI operation for the
process is queued or running. There is no per-process archive or restore flow.

Existing `workspace/assessments/` and legacy `workspace/processes/` directories
are never scanned, migrated, moved, or deleted. Before and after Pi deployment,
their file counts and checksums must remain identical.

## AI adapter and background-operation design

Keep and rename the hardened structured sandbox infrastructure as shared
infrastructure. Replace all assessment/discovery adapters with:

- `packages/claude/src/process-follow-up-adapter.ts`
- `packages/claude/src/process-synthesis-adapter.ts`
- `packages/claude/src/process-ai-contracts.ts`
- `packages/claude/src/process-response-schemas.ts`
- `packages/claude/src/sandbox-runner.ts`

Both adapters use the same immutable config snapshot, only the current process
answers, and only selected uploads. They use new Claude sessions with
`--no-session-persistence`; no prior conversation is resumed.

Follow-up generation uses no tools when no files are selected and workspace-only
tools when files are selected. Synthesis follows the same rule. Web, task,
network, and unrelated filesystem access remain blocked.

Refactor the operation manager so AI work is detached from the initiating HTTP
request:

1. POST validates the transition and queues one operation.
2. API returns `202` with `{ operationId, state: "queued" }`.
3. The singleton worker runs at global concurrency `1`.
4. Success validates and persists the result, audits it, and advances state.
5. Failure records a sanitized error and leaves the record in its retryable
   pre-operation state.
6. The page polls operation and process state and may be left and reopened.
7. A service restart discards in-memory queued/running work but leaves canonical
   data unchanged; the user sees a retry action.

Operation status exposes only ID, process ID, operation name, queue position,
state, and sanitized failure text. It never exposes prompts, commands, raw JSON,
stack traces, or credentials.

## Backend API

Mount only authentication, config, process, health, and operation APIs.

| Method   | Route                                             | Expected success                        |
| -------- | ------------------------------------------------- | --------------------------------------- |
| `GET`    | `/api/health`                                     | `200 { ok, instanceId }`                |
| `GET`    | `/api/processes`                                  | `200 ProcessCaptureRecord[]`            |
| `POST`   | `/api/processes`                                  | `201 ProcessCaptureRecord`              |
| `GET`    | `/api/processes/:id`                              | `200 ProcessCaptureRecord`              |
| `GET`    | `/api/processes/:id/history`                      | `200 AuditEntry[]`                      |
| `PUT`    | `/api/processes/:id/answers`                      | `200 ProcessCaptureRecord`              |
| `POST`   | `/api/processes/:id/uploads`                      | `201 UploadRecord`                      |
| `GET`    | `/api/processes/:id/uploads/:uploadId`            | validated inline original               |
| `GET`    | `/api/processes/:id/uploads/:uploadId?download=1` | validated attachment                    |
| `DELETE` | `/api/processes/:id/uploads/:uploadId`            | `200 { removed: true }` before analysis |
| `POST`   | `/api/processes/:id/analyze`                      | `202 { operationId, state }`            |
| `PUT`    | `/api/processes/:id/follow-ups`                   | `200 ProcessCaptureRecord`              |
| `POST`   | `/api/processes/:id/synthesize`                   | `202 { operationId, state }`            |
| `PATCH`  | `/api/processes/:id/understanding/:sectionId`     | `200 ProcessCaptureRecord`              |
| `POST`   | `/api/processes/:id/confirm`                      | `200 ProcessCaptureRecord`              |
| `DELETE` | `/api/processes/:id`                              | `200 { id, deleted: true }`             |
| `GET`    | `/api/ai-operations`                              | active operations only                  |
| `DELETE` | `/api/ai-operations/:operationId`                 | `200 { cancelled: true }`               |
| `GET`    | `/api/config/defaults`                            | validated process config                |
| `POST`   | `/api/config/instruction-preview`                 | complete read-only instruction Markdown |

All application routes except health and auth login/session require the signed
session. Invalid state transitions return `409`, missing records `404`, invalid
input `400`, unsupported media `415`, per-file overflow `413`, and total/count
overflow `409`.

Removed APIs `/api/assessments`, `/api/ranking`, `/api/comparisons`, legacy idea
APIs, and old process interview/PDD endpoints return the generic authenticated
`404` response. No compatibility API is retained.

## Frontend implementation

### Navigation and routes

Active routes:

- `/` — process list
- `/processes/new` — page 1
- `/processes/:id/capture` — page 2
- `/settings` — compact process-capture configuration

Navigation labels:

- `Prozesse`
- `Prozess erfassen`
- `Einstellungen`

Old assessment, comparison, ranking, idea, matrix, handover, showcase, interview,
PDD, and legacy process-detail browser routes redirect to `/` without rendering
old components.

### Process list

Each row shows process name, department, ID, current German state, updated time,
and the next action. It does not show a score, rank, KI signal, or classification.

All rows expose a red trash icon on hover and focus and permanently on
coarse-pointer devices. First activation shows inline `Prozess löschen` and
`Abbrechen`; confirmation permanently deletes the complete process directory
and removes the row.

### Page 2 capture UI

- persistent progress indicator for the four page states;
- five topic cards, all visible in initial capture;
- four required `Arbeitsmerkmale` selection groups embedded below their
  related free-text fields; user-facing copy avoids technical KI terminology;
- optional upload picker showing selected/processed status;
- one submit action for main answers;
- zero to five follow-up cards grouped by topic;
- queue/running status that survives navigation and polling;
- explicit retry after failure;
- process brief with six review sections;
- a separately reviewable and auditable `Arbeitsmerkmale` section containing
  the direct user selections without score or interpretation;
- deterministic process map;
- expandable step detail cards;
- visible provenance, document coverage, conflicts, and knowledge gaps;
- section edit actions;
- one final confirmation action.

### Process map

Create `process-map.tsx` without a graph dependency. Render the ordered steps as
CSS/SVG-connected cards horizontally on desktop and vertically at tablet width.
Each node shows step number, name, optional role, and optional system. Decision
text may appear inside the relevant node; no exception tree is rendered.

The same steps are available as an ordered semantic list. Keyboard access and
screen-reader understanding must not depend on the SVG connectors.

## Mandatory cleanup

Perform cleanup only after the new focused domain, storage, AI, and API tests are
green. Delete rather than leave dead adapters or hidden routes.

### Remove the replaced assessment implementation

- server routes: `assessments.ts`, `comparisons.ts`, `ranking.ts`;
- web pages: `assessment-start-page.tsx`, `gateway-page.tsx`,
  `form-assessment-page.tsx`, `chat-assessment-page.tsx`,
  `comparison-page.tsx`, `ranking-page.tsx`;
- assessment UI components: upload picker, gateway form, criterion inputs/cards/
  table/sidebar, calculated-results panel, review panel/findings;
- assessment web types and gateway/local-config compatibility transforms;
- Claude assessment, gateway, form-prefill, chat, and reviewer adapters;
- assessment AI contracts and response schemas;
- `packages/domain/src/assessment.ts` and `scoring.ts`;
- `packages/storage/src/assessment-repository.ts`;
- `defaults/assessment-config.json`, all current `defaults/prompts/*`, and all
  current `defaults/ai-schemas/*` before adding the process replacements;
- all six `tests/assessment-*.test.ts` after equivalent auth coverage is moved;
- `KI-Potentiale_Abfragekriterien.xlsx` because the active flow no longer uses
  the rubric; Git history retains it.

### Remove the older idea-portfolio and PDD discovery implementation

- server routes: `claude.ts`, `exports.ts`, `ideas.ts`, old `processes.ts`, and
  `settings.ts`;
- web pages: handover, idea detail, intake, matrix, portfolio, old process chat/
  detail/overview, and showcase;
- web components and helpers used only by those pages: evidence badge,
  first-run, idea card, matrix, priority badge, review flags, German-copy and
  showcase-data helpers;
- Claude CLI adapter, discovery adapter, and old request builder;
- domain discovery, handover, matrix, priority, ranking, and state modules;
- old discovery/process types in `packages/domain/src/schemas.ts`;
- storage backup, Markdown idea repository, old process repository, and seed;
- `defaults/CLAUDE.md`, `defaults/CLAUDE-discovery.md`, `defaults/workshop.yaml`,
  and `defaults/templates/`;
- legacy Claude/domain/storage tests after replacement coverage exists.

### Dependency and style cleanup

Remove `@ai-sdk/react`, `ai-sdk-provider-claude-code`, and `ai` if the final
import scan confirms no remaining use. Retain `react-markdown` exclusively for
the authenticated read-only instruction preview, `fflate` for validated Office
file inspection, and the hardened sandbox dependency. Regenerate `bun.lock`
with Bun.

Prune `styles.css` to selectors used by login, shell, warning, process list,
two-page capture, process map, settings, queue, and responsive layouts. Remove
assessment, ranking, comparison, matrix, PDD, idea, and handover selectors.

## Files to add

### Domain, storage, and AI

- `packages/domain/src/process-understanding.ts`
- `packages/storage/src/process-capture-repository.ts`
- `packages/claude/src/process-ai-contracts.ts`
- `packages/claude/src/process-follow-up-adapter.ts`
- `packages/claude/src/process-synthesis-adapter.ts`
- `packages/claude/src/process-response-schemas.ts`

### Defaults

- `defaults/process-capture-config.json`
- `defaults/prompts/process-base.md`
- `defaults/prompts/process-follow-ups.md`
- `defaults/prompts/process-synthesis.md`
- `defaults/ai-schemas/process-follow-ups.json`
- `defaults/ai-schemas/process-understanding.json`

### Backend and frontend

- `apps/server/src/routes/process-captures.ts`
- `apps/server/src/process-operation-manager.ts`
- `apps/web/src/pages/process-list-page.tsx`
- `apps/web/src/pages/process-start-page.tsx`
- `apps/web/src/pages/process-capture-page.tsx`
- `apps/web/src/components/process-topic-card.tsx`
- `apps/web/src/components/process-follow-up-card.tsx`
- `apps/web/src/components/process-brief.tsx`
- `apps/web/src/components/process-map.tsx`
- `apps/web/src/components/process-step-card.tsx`
- `apps/web/src/components/document-coverage.tsx`
- `apps/web/src/components/document-preview-dialog.tsx`
- `apps/web/src/components/instruction-preview-dialog.tsx`
- `apps/web/src/lib/process-types.ts`

### Tests

- `tests/process-domain.test.ts`
- `tests/process-storage.test.ts`
- `tests/process-ai-contract.test.ts`
- `tests/process-api.test.ts`
- `tests/auth.test.ts`

## Files to rewrite

- `apps/server/src/index.ts`
- `apps/server/src/launcher.ts`
- `apps/server/src/routes/config.ts`
- `apps/server/src/routes/ai-operations.ts`
- `apps/web/src/app.tsx`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/components/ai-operation-queue.tsx`
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/lib/local-config.ts`
- `apps/web/src/pages/settings-page.tsx`
- `apps/web/src/styles.css`
- `packages/claude/src/sandbox-runner.ts`
- `packages/domain/src/schemas.ts`
- `packages/storage/src/workspace-repository.ts`
- `scripts/check-environment.ts`
- `scripts/build-release.ts`
- `scripts/dev.ts`
- `deploy/pi/claims-ai-portfolio.service`
- `README.md`
- `docs/OPERATOR_GUIDE.de.md`
- `docs/PRIVACY_NOTICE.de.md`
- `package.json`
- `bun.lock`

Authentication, launcher, atomic-write, audit-log, Pi service/tunnel, build
script, demo warning, logo/font assets, and release targets remain unless a
focused import or runtime check proves a required adjustment.

## Implementation sequence and hard gates

### Phase 1 — canonical domain and storage

Implement config schemas, state transitions, record schemas, repository files,
upload limits, audit events, correction behavior, confirmation, and permanent
deletion.

Expected outputs:

- a created `PROC-0001` directory with exactly the canonical files listed above;
- five topic slots and immutable config hash;
- atomic state transitions;
- explicit permanent deletion with an active-operation guard;
- no read or write to legacy data roots.

Hard gate:

```zsh
./scripts/qa test tests/process-domain.test.ts
./scripts/qa test tests/process-storage.test.ts
```

Both must pass before routes or UI depend on the repository.

### Phase 2 — bounded KI contracts

Implement follow-up and synthesis schemas, prompts, adapters, selected-file
staging, operation detachment, response validation, and sanitized error traces.

Expected outputs:

- zero to five unique-topic follow-ups;
- one valid process understanding with five to eight steps;
- exact evidence/upload referential integrity;
- `--model sonnet --effort medium --no-session-persistence` in the Claude
  command contract;
- no tools without selected files and workspace-only tools with selected files;
- retryable canonical state after timeout, cancellation, malformed output, or
  process restart.

Hard gate:

```zsh
./scripts/qa test tests/process-ai-contract.test.ts
```

The test must reject duplicate-topic follow-ups, nine steps, unknown evidence
IDs, foreign uploads, unsupported tools, and unbounded sessions.

### Phase 3 — authenticated API and background jobs

Mount the new routes, implement all transition guards and status codes, and
detach queued work from request lifetime.

Expected outputs:

- exact API surface in this plan;
- one global worker;
- `202` for queued KI operations;
- safe retry after failure;
- generic `404` for every removed API;
- anonymous process requests return `401`.

Hard gate:

```zsh
./scripts/qa test tests/process-api.test.ts
./scripts/qa test tests/auth.test.ts
```

### Phase 4 — two-page UI and process map

Implement list, page 1, page 2 states, upload selection, progress, polling,
review/correction, map, confirmation, settings, and delete confirmation.

Expected outputs:

- only the four active browser routes;
- no visible KI-potential, score, criteria, rank, mode, or PDD terminology;
- process map and accessible ordered list contain the same five to eight steps;
- selected-document coverage and unknowns remain visible;
- one final confirmation produces the confirmed list state.

Hard gate:

```zsh
./scripts/qa changed
bun run build
```

Then verify with Chrome DevTools at `1440x900` and `1024x768`:

1. login and logout;
2. page 1 has exactly the setup fields and no description or mode selection;
3. all five topic blocks are keyboard reachable;
4. uploads enforce count/type/size limits;
5. operation progress survives navigation away and back;
6. follow-ups never exceed one per topic;
7. brief, map, step details, coverage, gaps, and conflicts render;
8. a correction updates provenance and audit history;
9. confirmation locks the record-level baseline;
10. permanent deletion requires inline confirmation;
11. no console errors, warnings, accessibility issues, or failed unexpected
    network requests.

### Phase 5 — remove replaced implementations

Delete all files listed under mandatory cleanup, remove imports and dependencies,
regenerate the lockfile, and prune styles.

Expected outputs:

- no compiled or source reference to assessment, gateway, criteria, review,
  ranking, comparison, PDD, idea portfolio, matrix, or old discovery chat;
- no old route is mounted;
- no dead AI SDK dependency remains;
- no legacy data directory was changed.

Hard gate:

```zsh
! rg -n "AssessmentRepository|GatewayClaudeAdapter|criteria_in_progress|RankingPage|ComparisonPage|Process Definition Document|Interview läuft|ai-sdk-provider-claude-code|@ai-sdk/react" apps packages defaults tests
! rg -n 'from "ai"' apps packages tests
bun install --frozen-lockfile
./scripts/qa all
```

The two negative searches must return no matches. Historical documentation is
excluded from these scans.

### Phase 6 — release, deploy, and live acceptance

Before deployment:

```zsh
./scripts/qa all
bun run build:release
git diff --check
```

Record file counts and checksums for existing Pi legacy roots, deploy the new
release without copying workspace data, restart the service, then compare the
same counts and checksums.

Required live evidence at `https://claims-ai.ian-buck.dev`:

- health `200` and anonymous private API `401`;
- systemd service active and listening only on `127.0.0.1:3210`;
- one fictional no-document process completes end to end;
- one fictional process with a small TXT and one current PDF completes end to
  end and shows document coverage;
- both outputs contain five to eight steps and a matching map/list;
- a draft can be permanently deleted and disappears from the list;
- a confirmed process can be permanently deleted after inline confirmation;
- old APIs return authenticated `404`;
- sandbox probe permits only the current disposable process workspace and
  denies another process, repository, SSH, secrets, and Agent Manager;
- desktop and tablet console/network checks remain clean;
- legacy Pi workspace checksums are unchanged.

## Test scenarios

### Domain

- exactly five topic IDs and no duplicates;
- valid and invalid state transitions;
- zero, one, and five follow-ups;
- duplicate follow-up topic rejected;
- four and nine synthesis steps rejected;
- step ordering and unique IDs enforced;
- dangling evidence and upload references rejected;
- final confirmation preserves `unknown` and `ai_inferred` provenance;
- human correction records `user_confirmed` and invalidates prior confirmation.

### Storage

- clean create/read/restart round trip;
- corrupt YAML/JSON rejected without partial repair;
- atomic write failure leaves previous canonical file intact;
- every manual and AI change appends history;
- MIME/extension mismatch rejected;
- sixth selected file and size limits rejected;
- foreign upload selection rejected;
- deletion removes the complete process directory and is disallowed during an
  active operation;
- legacy roots remain unread and unchanged by list/create/delete operations.

### AI contract

- command uses Sonnet and medium effort;
- no upload means no workspace tools;
- selected upload enables only sandboxed workspace tools;
- no session continuation or web tools;
- follow-up schema uniqueness enforced;
- synthesis schema and referential integrity enforced;
- prompt treats files as untrusted evidence;
- malformed, oversized, timed-out, cancelled, and mid-response failures do not
  mutate canonical output.

### API

- authentication and eight-hour expiry;
- complete happy path with and without follow-ups;
- retry after failed analysis and synthesis;
- rejected duplicate active operation;
- correction and confirmation guards;
- all upload status codes;
- deletion guards;
- all removed APIs return `404` after authentication.

### UI

- setup-only page 1;
- five-block page 2 at desktop and tablet widths;
- German state and next-action copy;
- queue, failure, and retry display;
- process map/list equivalence;
- visible provenance, coverage, gaps, and conflicts;
- keyboard-accessible correction and delete confirmation;
- no raw JSON, prompt text, model terminology, commands, or stack traces.

## Final definition of done

Implementation is complete only when:

1. the two-page flow produces and confirms a canonical process understanding;
2. every generated result has five to eight evidence-backed high-level steps;
3. users can validate the same steps in a brief, map, and accessible list;
4. follow-ups are bounded to one per topic and one round;
5. document coverage and limitations are explicit;
6. old assessment, ranking, PDD, idea, and discovery implementations are absent
   from active code and dependencies;
7. all automated, release, browser, sandbox, auth, and Pi gates pass;
8. pre-existing workspace data remains byte-for-byte unchanged;
9. documentation describes only the implemented two-page process-understanding
   product.
