# Chat Capture V1 Implementation Plan

## Goal

Deliver one real end-to-end Chat Capture path as the default way to capture a current business process while preserving the existing Form Capture path as an immutable alternative. A Chat Capture accepts documents or a free-text description, uses one resumable Claude session to maintain a shared `ProcessUnderstanding`, renders its ordered steps as a live linear diagram, accepts diagram-scoped corrections through chat mentions, records an explicit human confirmation, and starts the existing Opportunity Discovery pipeline automatically.

The normal UI remains German. Code, schemas, prompts, tests, and implementation documentation remain English except for user-facing copy.

## Locked Product Decisions

- The setup page keeps the four current cover fields and adds two selectable mode cards. `Chat` is selected by default; `Formular` is the alternative. The choice is persisted with the process and cannot be changed later.
- Existing records without a stored mode migrate to `form`; their routes and behavior remain unchanged.
- A first-visit, three-step tutorial is stored only in browser storage. Completing or skipping it sets `claims-ai.chat-tutorial.completed.v1`; Settings can reset it.
- The first chat message is deterministic. Its document card blocks the composer until the user explicitly selects `Unterlagen auswerten` or `Ohne Unterlagen fortfahren`.
- One Claude session belongs to one Chat Capture. A subprocess exists only during an explicit document-analysis, message, or retry turn. Loading a page never resumes Claude.
- The browser does not resume interrupted SSE streams. A later explicit turn resumes the Claude session. If that fails, the server creates a replacement session from application-owned artifacts.
- V1 assumes one active client and turn for a process. The current UI disables its composer while active. No backend queue, distributed lock, or multi-tab coordination is added.
- Claude writes the process-scoped `process-understanding.json` directly. The file is always treated as untrusted working state; the application publishes only runtime-validated snapshots.
- The diagram is linear and read-only. It shows step number, name, and short activity only. Transitions are derived between adjacent steps.
- Steps and transitions can be mentioned from the diagram. Mentions are stored as typed references and rendered as `@Schritt-N` and `@Übergang-N-M` chips in chat.
- A valid snapshot is confirmable even when `knowledgeGaps` or `conflicts` remain. Those two arrays require one explicit override dialog and result in `confirmed_with_gaps`; assumptions alone do not trigger the override.
- Confirmed chat captures are read-only. Confirmation appends a deterministic thank-you message and starts Opportunity Discovery. A downstream start failure does not roll back the already durable confirmation.
- Chat Capture uses `claude-opus-4-8` with medium effort. Existing Form Capture stays medium; Opportunity Discovery stays high.
- V1 does not add branching, loops, graph editing, structured fields inside nodes, persistent comments, process scoring, financial values, scenario editing, or capture-mode switching.

## User Experience Contract

### 1. Setup page

Keep the existing heading and `Grunddaten` card. Add a full-width `Art der Erfassung` fieldset below the four inputs and above the submit action.

The cards are single-select radio cards:

- `Chat` — badge `Empfohlen`; copy: `Unterlagen hochladen, Rückfragen beantworten und das Prozessbild gemeinsam prüfen.`
- `Formular` — copy: `Den Prozess in festen Themenblöcken beschreiben und anschließend prüfen.`

The submit button stays `Weiter zu Schritt 2`. A chat record opens `/processes/:id/chat`; a form record opens `/processes/:id/capture`.

### 2. Tutorial

Present a modal before the chat workspace becomes interactive:

1. `Unterlagen bereitstellen` — `Arbeitsanweisungen, Präsentationen und Beispieldokumente geben den schnellsten Einstieg.`
2. `In Alltagssprache ergänzen` — `Beschreiben Sie die Arbeit so, wie Sie sie einer neuen Kollegin oder einem neuen Kollegen erklären würden.`
3. `Prozessbild prüfen` — `Verweisen Sie direkt auf Schritte oder Übergänge und bestätigen Sie das Bild erst, wenn der Hauptablauf stimmt.`

Actions are `Überspringen`, `Zurück`, `Weiter`, and on the final step `Chat starten`. Both completion and skip persist the browser-local flag. Settings exposes `Einführung beim nächsten Chat erneut anzeigen` and clears that flag.

### 3. Chat workspace

The route uses the available viewport below the global navigation.

- At widths of at least 1100 px, render a 42/58 split: chat left, diagram right.
- Below 1100 px, render `Gespräch` and `Prozessbild` tabs. A diagram update adds an indicator to the inactive diagram tab. Selecting a diagram mention switches to the chat tab and focuses the composer.
- Each pane has its own sticky header and scroll area. The composer and confirmation bar remain visible without scrolling the whole page.

The deterministic initial assistant message is:

> Ich unterstütze Sie dabei, den heutigen Ablauf als verständliches Prozessbild festzuhalten. Am schnellsten geht das mit vorhandenen Arbeitsanweisungen, Präsentationen oder Beispieldokumenten. Laden Sie alle passenden Unterlagen gemeinsam hoch – oder fahren Sie ohne Unterlagen fort.

Its embedded document card reuses the existing file validation, preview, download, and removal behavior. Users may select up to the existing five-file/100-MB process limits. `Unterlagen auswerten` is primary and disabled without files; `Ohne Unterlagen fortfahren` is secondary. The card becomes a compact completed action after either choice.

After the gate, the composer contains a paperclip action, mention chips, a multiline input with placeholder `Antwort oder Korrektur beschreiben …`, `Senden`, and while active `Stoppen`. Enter sends; Shift+Enter inserts a line break. Assistant Markdown is rendered with the existing restricted renderer. Responses must be German, compact, and contain at most one material follow-up question.

If the user skips documents, the first Claude turn receives a fixed instruction to ask for the normal sequence, trigger, outcome, participants, systems/documents, and important decisions in one compact prompt. If documents are selected, the first turn reads all selected uploads, creates the best supported first snapshot, lists material assumptions as gaps where necessary, and asks only the highest-value remaining question.

### 4. Diagram pane

Use `@xyflow/react@12.11.2` with deterministic horizontal positions. Configure a controlled renderer with `nodesDraggable={false}`, `nodesConnectable={false}`, deletion disabled, pan/zoom enabled, and fit-to-view controls. Do not add a layout-engine dependency or minimap.

Visible states:

- `missing`: skeleton nodes and `Aus Ihren Angaben entsteht hier das erste Prozessbild.`
- `invalid` without a previous valid snapshot: keep the skeleton and show `Das Prozessbild wird noch aufgebaut …`.
- `invalid` with a previous valid snapshot: retain that diagram and show a non-blocking `Prozessbild wird aktualisiert …` status.
- `valid`: render the last validated revision and status `Aktueller Stand`.
- active turn: show a small live status in the pane header; never expose JSON/schema errors.
- confirmed: freeze the diagram and show the final confirmation state.

A custom node shows its order, name, and activity. Hover/focus reveals an accessible chat action. A custom edge supplies the same action at its midpoint. Selecting an action adds a typed mention chip and textual token to the composer. Step references store the stable `stepId`; transition references store both stable adjacent step IDs. The visible label is captured with the message, so later reordering does not rewrite historical chat.

### 5. Confirmation

The diagram footer shows `Prozessbild bestätigen`. Disable it when no valid snapshot exists, the current working file is invalid, or a turn is active.

- With empty `knowledgeGaps` and `conflicts`, confirmation completes immediately.
- Otherwise open `Trotz offener Punkte bestätigen?`, show the recorded gaps and conflicts, and offer `Weiter prüfen` and `Trotzdem bestätigen`.
- The override does not require a written reason.

After success, append this deterministic assistant message and lock the workspace:

> Vielen Dank. Der Prozess wurde übermittelt und fachlich bestätigt. Die Ermittlung möglicher KI-Potenziale startet im Hintergrund.

Show `Zum Prozess` and, once available, `KI-Potenziale ansehen`. If automatic discovery could not be started, retain the thank-you state and show a separate warning with `Zum Prozess`; the existing process detail module remains the recovery point.

## Domain Contracts

### Process record additions

Add these schemas to `packages/domain/src/process-understanding.ts`:

```ts
interactionModeSchema = z.enum(["chat", "form"]);
confirmationQualitySchema = z.enum(["complete", "with_gaps"]).nullable();
```

`ProcessCaptureRecord` gains required parsed fields `interactionMode` and `confirmationQuality`. Storage defaults missing legacy values to `form` and `null`. `confirmationQuality` must be null before `confirmed` and non-null after a Chat Capture is confirmed. Existing Form Captures may retain null because their existing confirmation contract is unchanged.

Extend evidence reference `kind` with `chat_message`. A chat reference is valid only when its `sourceId` belongs to the persisted transcript for that process. Form synthesis schemas remain restricted to their existing evidence kinds.

Chat Capture uses these process-level transitions only:

```text
create(chat) -> capture_in_progress
capture_in_progress -> confirmed
```

`follow_up_required`, `synthesis_ready`, and `review_required` remain Form Capture states. During Chat Capture, a last-valid understanding may exist while the process is still `capture_in_progress`; update cross-field validation accordingly. Confirmed Chat Capture requires a valid understanding and a confirmation quality.

### Chat state

Create `packages/domain/src/chat-capture.ts` with strict Zod schemas and exported types:

```ts
ChatDocumentGate = "pending" | "documents_selected" | "skipped";
ChatTurnOutcome = "completed" | "failed" | "aborted";
ChatUnderstandingStatus = "missing" | "invalid" | "valid";

ChatCaptureState = {
  schemaVersion: 1;
  documentGate: ChatDocumentGate;
  selectedUploadIds: string[];
  lastValidRevision: string | null;
  lastValidAt: string | null;
  lastTurnOutcome: ChatTurnOutcome | null;
  createdAt: string;
  updatedAt: string;
};

ChatMention =
  | { kind: "step"; stepId: string; label: string }
  | {
      kind: "transition";
      fromStepId: string;
      toStepId: string;
      label: string;
    };

ChatTranscriptEvent = {
  schemaVersion: 1;
  id: string;
  turnId: string | null;
  at: string;
  role: "user" | "assistant";
  status: "complete" | "aborted";
  text: string;
  mentions: ChatMention[];
  action: "initial" | "message" | "analyze_documents" | "skip_documents" | "confirmation";
};

ChatSessionRecord = {
  schemaVersion: 1;
  activeSessionId: string;
  activeSessionStarted: boolean;
  replacementCandidateId: string | null;
  replacedSessionIds: string[];
  lastTurnAt: string | null;
};
```

Limit a message to 20,000 characters, five unique mentions, and the transcript to repository file-size limits rather than an arbitrary question count. The server treats a repeated user message ID as a retry of the same turn and does not append it twice.

### Process directory

For Chat Capture, create:

```text
process-captures/PROC-xxxx/
  process-understanding.json                 # raw Claude working file; canonical after confirmation
  chat/
    state.json                               # atomically written application state
    session.json                             # atomically written session lifecycle
    transcript.jsonl                         # append-only application transcript
    last-valid-process-understanding.json    # atomically published validated snapshot or null
    contract-manifest.json                   # hashes of the frozen prompt/schema
    contracts/
      process-chat.md
      process-understanding.schema.json
    tmp/                                     # process-local conversion scratch, cleared after a turn
```

Form Capture does not get this directory. `ProcessCaptureRepository.get()` reads the root understanding for Form Capture and confirmed Chat Capture; for an in-progress Chat Capture it reads only the application-owned last-valid snapshot. It never parses a possibly partial raw working file as canonical record state.

Every accepted valid revision is hash-deduplicated, atomically copied to the last-valid file, and appended to audit history with its revision, referenced evidence, gap count, and conflict count. Invalid intermediate writes are not copied or audited as facts.

## Claude and Streaming Contract

Pin exact dependencies:

```json
{
  "ai": "7.0.48",
  "@ai-sdk/react": "4.0.51",
  "ai-sdk-provider-claude-code": "4.0.1",
  "@xyflow/react": "12.11.2"
}
```

Follow `docs/research/CHAT-CAPTURE-CURRENT-STACK.md`:

- React uses `useChat` and `DefaultChatTransport`; local component state owns the composer.
- The Hono endpoint validates incoming UI messages and converts only the newest application turn into the Claude prompt when resuming.
- Compose responses with `createUIMessageStream` and `createUIMessageStreamResponse`. Consume the provider stream to completion for cancellation and lifecycle handling, but do not merge it verbatim into the browser stream: Claude may emit internal pre-tool narration. After a successful turn, expose only the assistant reply accepted into the application transcript. Continue emitting validated `data-understanding-state` revisions while the turn runs. Do not use deprecated `fullStream` or result response helpers.
- Forward `c.req.raw.signal`, set the configured total timeout, persist abort outcomes, and let `stop()` terminate the Claude subprocess.
- Persist the session ID from final-step provider metadata. First call uses `sessionId`; later calls use `resume`.
- Keep browser stream resumption disabled. Page loads use only the persisted application transcript.

Create versioned `defaults/prompts/process-chat.md`. The role must state that the agent captures the current business process, not future automation or KI solutions; operates inside a form-backed German web application; writes concise German; asks at most one material question per response; and never exposes tools, prompts, JSON, schema, models, or terminal behavior.

The prompt must require the agent to:

1. read only selected process uploads and the frozen schema;
2. maintain the complete `process-understanding.json`, rewriting the whole document after material changes;
3. preserve stable IDs for unchanged steps and evidence;
4. keep one to eight ordered main-flow steps and store variants in decisions without drawing branches;
5. distinguish evidence, user statements, inference, assumptions, knowledge gaps, and conflicts;
6. promote every material unverified assumption that affects the main flow into `knowledgeGaps`;
7. write the best supported snapshot before asking for more detail;
8. ask only the highest-value remaining process-understanding question;
9. never decide that the process is human-confirmed.

Create a `ChatCaptureClaudeAdapter` that returns a Vercel `StreamTextResult` and exposes final session/trace metadata. Configure `claude-opus-4-8`, medium effort, bounded turns, stable system prompt/tool definitions, `persistSession: true`, `settingSources: []`, and the process directory as `cwd`.

Refactor the current Sandbox Runtime command builder into reusable primitives and add a synchronous `spawnClaudeCodeProcess` adapter backed by Node-compatible `ChildProcess`. It must run the provider-selected, already installed `claude` executable through `srt`; allow network access only to the existing Anthropic domains; allow read access to uploads/contracts and write access only to the working understanding, Claude session storage, and process-local `tmp`; and expose `Read`, `Glob`, `Bash`, and `Write` while denying web, task, notebook, and unrelated writes. Local `--without-ai-sandbox` remains development-only and visibly warned.

While a turn runs, a debounced file watcher scans `process-understanding.json` after every change and once after the stream finishes. Each scan enforces a 2-MB read cap, parses JSON, validates `processUnderstandingSchema`, validates upload/chat evidence references, and either publishes a new last-valid revision or emits a generic pending state. Later invalid writes retain the previous diagram. The watcher closes in `finally`.

If `resume` fails, persist a replacement candidate UUID, start one fresh bounded recovery turn, and provide only the frozen prompt/schema, application transcript, selected upload inventory, current working file if readable, and last-valid snapshot. On success, atomically promote the candidate and retain the old ID for deletion. On failure, clear/delete the failed candidate, record the failure, and expose the normal retry action. Do not silently start an empty conversation.

## API Contract

Extend `POST /api/processes` with `interactionMode: "chat" | "form"`.

Add `apps/server/src/routes/chat-captures.ts`:

- `GET /api/processes/:id/chat` returns the cover, immutable mode, chat state, application transcript converted to UI messages, uploads, last-valid understanding, working-file status, confirmation quality, and whether confirmation is currently allowed. It performs one reconciliation scan so a server restart after a completed raw write can recover the valid revision. It never starts Claude.
- `POST /api/processes/:id/chat` is the AI SDK transport. Its strict body adds `action`, `selectedUploadIds`, and typed mentions to validated UI messages. It rejects form records and confirmed records. `message` requires a completed document gate; `analyze_documents` requires at least one owned upload; `skip_documents` requires none. It persists the user action before the Claude call and the assistant text after the stream finishes.
- `POST /api/processes/:id/chat/confirm` accepts `{ override: boolean }`. Without override, gaps/conflicts return HTTP 409 with code `confirmation_override_required` and their lists. With a valid confirmation, it atomically rewrites the raw file from the last-valid snapshot, records `complete` or `with_gaps`, appends the deterministic final message, and invokes automatic Opportunity Discovery.

Custom stream data contains only typed `data-understanding-state` events with status, revision, and timestamp. It never returns raw validation failures or JSON.

Extend the web API client with a typed `ApiError` so the confirmation dialog can distinguish the override-required 409 from ordinary failures without matching German strings.

## Automatic Opportunity Discovery

Extract the existing queue/start orchestration from `apps/server/src/routes/opportunities.ts` into `apps/server/src/opportunity-discovery-service.ts`. Both the existing manual route and Chat Capture confirmation call the same service. Preserve exactly one bounded hypothesis call followed by one bounded scenario call and all existing storage/contracts.

Confirmation order is:

1. validate the current last-valid understanding;
2. durably finalize the Chat Capture and audit the confirmation quality;
3. append the deterministic final chat message;
4. create the immutable Opportunity Discovery snapshot if none exists;
5. enqueue the existing discovery operation;
6. publish `process-changed`.

Steps 1-3 form the confirmation boundary. If steps 4-5 fail, do not undo confirmation. Audit `opportunity-auto-start-failed`, return a successful confirmation with `opportunityStart: "failed"`, and leave the existing process detail action available for recovery. If an opportunity record was created but remains `hypotheses_queued`, the shared service must allow an explicit retry to enqueue that existing record instead of creating a duplicate.

Both `complete` and `with_gaps` confirmation qualities are eligible for discovery. The immutable source snapshot carries the quality marker so downstream UI and later assessment work can identify an incomplete source without changing current hypothesis/scenario contracts.

## Deletion and Retention

Deleting a Chat Capture first reads all active, candidate, and replaced Claude session IDs and calls the provider's `deleteSession` helper with the process directory. A missing session is treated as already deleted. Any other session-deletion failure keeps the process record intact and returns a retryable error; successful cleanup is followed by the existing permanent process-directory deletion. This prevents locally persisted Claude transcripts from outliving the process record.

Stopping a turn does not delete the session. Confirming a process does not delete it immediately because the read-only transcript remains part of the process until the whole process is deleted.

## Files To Change

### Dependencies and repository guidance

- `package.json` — pin the four chat/diagram dependencies.
- `bun.lock` — record resolved packages and Agent SDK optional dependencies.
- `AGENTS.md` — document Chat Capture as the explicit exception to the fresh-session rule; keep every other operation fresh and bounded.

### Versioned product contracts

- `defaults/prompts/process-chat.md` — fixed Chat Capture role and behavior.
- `defaults/ai-schemas/process-understanding.json` — add `chat_message` evidence support and keep it aligned with Zod.
- `docs/PRODUCT-FLOW-KI-POTENTIAL.md` — make Chat Capture primary, Form Capture alternative, and document the shared output/confirmation boundary.
- `docs/PI-DEPLOYMENT.md` — add Claude-session cleanup and one Chat Capture release smoke path.
- `CONTEXT.md`, `docs/adr/0001-continuous-chat-capture-session.md`, `docs/adr/0002-use-react-flow-for-process-diagrams.md` — retain as the domain/architecture decisions; update only if implementation names differ.

### Domain

- `packages/domain/src/chat-capture.ts` — new strict chat state, transcript, mention, session, request, and view schemas.
- `packages/domain/src/process-understanding.ts` — interaction mode, confirmation quality, chat evidence, and mode-aware state invariants.
- `packages/domain/src/schemas.ts` — export chat contracts.
- `packages/domain/src/opportunity-discovery.ts` — carry source confirmation quality in the immutable process snapshot without changing scenarios.

### Storage

- `packages/storage/src/chat-capture-repository.ts` — initialize chat artifacts, append transcript events, manage session lifecycle, reconcile raw writes, publish last-valid revisions, and expose deletion IDs.
- `packages/storage/src/process-capture-repository.ts` — persist/migrate mode and quality, create mode-aware records, read last-valid chat understanding safely, validate chat evidence, and finalize Chat Capture.
- `packages/storage/src/opportunity-discovery-repository.ts` — accept the enriched immutable source snapshot and support enqueueing an already-created queued record.

### Claude runtime

- `packages/claude/src/chat-capture-contracts.ts` — provider-independent request/result interfaces.
- `packages/claude/src/chat-capture-adapter.ts` — AI SDK 7 streaming, session ID capture, resume, and recovery prompts.
- `packages/claude/src/chat-sandbox-spawn.ts` — provider process spawn through existing Sandbox Runtime boundaries.
- `packages/claude/src/sandbox-runner.ts` — extract shared sandbox environment/settings/command construction without changing structured operations.
- `packages/claude/src/process-ai-utils.ts` — load the versioned Chat Capture prompt/schema snapshot.

### Server

- `apps/server/src/chat-capture-service.ts` — coordinate transcript persistence, watcher events, Claude turns, replacement sessions, and confirmation.
- `apps/server/src/opportunity-discovery-service.ts` — shared start/enqueue/retry orchestration.
- `apps/server/src/routes/chat-captures.ts` — Chat Capture GET, streaming POST, and confirmation endpoints.
- `apps/server/src/routes/process-captures.ts` — accept mode, initialize/rollback chat artifacts, route mode-safe uploads/deletion, and use the chat cleanup service.
- `apps/server/src/routes/opportunities.ts` — delegate start/retry to the shared service.
- `apps/server/src/index.ts` — construct services and mount chat routes.

### Web

- `apps/web/src/app.tsx` — register `/processes/:id/chat`.
- `apps/web/src/pages/process-start-page.tsx` — add the default mode-card selector and mode-aware navigation.
- `apps/web/src/pages/process-chat-page.tsx` — load and own the complete Chat Capture workspace.
- `apps/web/src/pages/process-detail-page.tsx` — route the capture module by immutable mode and show confirmation quality when applicable.
- `apps/web/src/pages/settings-page.tsx` — reset the browser-local tutorial preference.
- `apps/web/src/components/chat-capture-tutorial.tsx` — exact three-step modal.
- `apps/web/src/components/chat-document-gate.tsx` — blocking batched upload action.
- `apps/web/src/components/chat-message-list.tsx` — persisted/streamed message rendering and retry state.
- `apps/web/src/components/chat-composer.tsx` — text, uploads, mentions, send, and stop.
- `apps/web/src/components/process-flow-diagram.tsx` — React Flow adapter, custom nodes/edges, pending states, and mentions.
- `apps/web/src/components/chat-confirmation-dialog.tsx` — normal/override confirmation and final state.
- `apps/web/src/components/ui/tabs.tsx`, `apps/web/src/components/ui/scroll-area.tsx`, `apps/web/src/components/ui/tooltip.tsx` — add the needed shadcn primitives using the current theme.
- `apps/web/src/lib/api-client.ts` — typed chat endpoints and `ApiError`.
- `apps/web/src/lib/chat-types.ts` — UI message/data-part types derived from domain contracts.
- `apps/web/src/lib/chat-tutorial-preference.ts` — local tutorial flag.
- `apps/web/src/lib/process-list-model.ts`, `apps/web/src/lib/process-navigation-model.ts` — mode-aware routes and statuses; in-progress chat displays `In Erfassung` and confirmed-with-gaps remains visibly marked on the detail page.
- `apps/web/src/main.tsx` — import React Flow base styles once.

### Tests

- `tests/chat-domain.test.ts` — schemas, state invariants, evidence, mentions, confirmation quality, and legacy form migration.
- `tests/chat-storage.test.ts` — file layout, append-only transcript, invalid/valid/last-valid behavior, restart reconciliation, finalization, and session ID retention.
- `tests/chat-ai-contract.test.ts` — exact package/API adapter behavior with a fake provider stream, first/resumed/replacement session settings, abort propagation, and sandbox spawn command.
- `tests/chat-api.test.ts` — document gate, idempotent turn persistence, custom data parts, mode guards, normal/override confirmation, automatic handoff success/failure, retry, and deletion cleanup.
- `tests/chat-ui.test.ts` — setup selector, tutorial copy, blocking gate, responsive tabs, mention labels, diagram states, override dialog, and read-only final state.
- `tests/process-domain.test.ts`, `tests/process-storage.test.ts`, `tests/process-api.test.ts`, `tests/process-list-model.test.ts`, `tests/process-navigation-model.test.ts`, `tests/opportunity-api.test.ts`, `tests/opportunity-storage.test.ts` — update existing fixtures and assert unchanged Form Capture plus enriched source snapshots.

## Implementation Order

1. Add dependencies, domain schemas, legacy defaults, and tests for mode/quality/chat records.
2. Add Chat Capture storage artifacts and safe last-valid reconciliation; verify raw invalid JSON never breaks `GET /processes/:id`.
3. Refactor the sandbox builder and implement the AI SDK Claude adapter with fake-stream contract tests before calling a real model.
4. Add the chat service/routes and streamed understanding events; then extract the shared Opportunity Discovery service and implement confirmation handoff.
5. Add the setup selector, tutorial, workspace shell, document gate, chat rendering/composer, and responsive behavior.
6. Add React Flow rendering and typed step/transition mentions.
7. Add confirmation override/final state, mode-aware detail/list navigation, tutorial reset, and deletion cleanup.
8. Update product/deployment docs and run the complete verification matrix.

## Hard Verification Goals

### Automated

Run focused tests while editing, then:

```zsh
./scripts/qa all
./scripts/qa release
```

Required assertions:

1. Creating without an explicit mode is rejected by the current create API, while reading every legacy record yields `interactionMode: "form"`.
2. Chat and Form records cannot call each other's mutation endpoints.
3. A chat page GET performs zero Claude calls.
4. The initial document gate prevents ordinary messages until one explicit choice is stored.
5. Partial, oversized, malformed, reference-invalid, and schema-invalid working JSON never replaces the last-valid snapshot or breaks process reads.
6. A later valid file revision updates the snapshot exactly once and survives server restart.
7. A repeated client message ID does not duplicate transcript evidence.
8. First turn uses `sessionId`; later turn uses `resume`; failed resume performs one explicit replacement with application context.
9. Request abort reaches the provider subprocess and records an aborted turn without deleting the session.
10. Normal confirmation rejects an invalid current working state; gaps/conflicts require override; override records `with_gaps`.
11. Both confirmation outcomes start the same existing hypothesis/scenario pipeline. A start failure leaves confirmation durable and recoverable.
12. Process deletion removes all process files and every tracked Claude session; a non-missing cleanup failure prevents orphaning by retaining the process.
13. Existing Form Capture happy-path, editing, confirmation, process list, opportunity, and deletion tests remain green.
14. The Bun web build and all three compiled release targets succeed with the provider dependency while using the installed Claude executable.

### Chrome DevTools MCP

Use a fake deterministic chat adapter first, then one authenticated real-Claude smoke. Verify at 1440×900 and 768×1024:

1. setup defaults to `Chat`, keyboard selection and validation work, and `Formular` still opens the old page;
2. tutorial focus is trapped, skip/completion persists, and Settings reset shows it again;
3. document upload/preview/removal works, the gate blocks correctly, and both gate paths stream a first response;
4. chat scrolling, Enter/Shift+Enter, stop, error/retry, and reload from persisted transcript work;
5. missing/invalid/valid/updating diagram states are understandable without technical text;
6. diagram pan/zoom works without editing; keyboard and hover mention actions create correct chips and focus the composer;
7. normal confirmation and override confirmation produce the locked thank-you state;
8. process detail/list status changes and Opportunity Discovery progress appears without a manual start;
9. filtered console errors and failed network requests are empty throughout.

### Real smoke expected output

Use one anonymized, realistic insurance-process document set. The first Claude turn must create at least one schema-valid ordered step, cite uploaded or chat evidence, render a diagram before asking more than one question, preserve stable IDs after one referenced correction, and produce a confirmable final snapshot. Confirm it once and verify that hypotheses start automatically and three scenarios appear when the existing evidence threshold is met. Do not tune the prompt to the smoke fixture; only correct generic contract, parsing, sandbox, or UX failures.

## Completion Output

The implementation is complete only when the repository contains:

- both immutable capture modes with Chat selected by default;
- a persisted, resumable, sandboxed chat with application-owned recovery artifacts;
- a dynamically updating read-only linear diagram sourced only from validated JSON;
- typed diagram mentions and one-turn-at-a-time correction behavior;
- normal and with-gaps human confirmation;
- automatic reuse of the existing Opportunity Discovery pipeline;
- permanent cleanup of process and Claude-session data;
- updated product/deployment documentation;
- passing full QA, release builds, fake-adapter UI verification, and one real authenticated smoke.
