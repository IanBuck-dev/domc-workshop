# Repository Agent Instructions

## Product boundary

Build a local prototype that captures and confirms how a department process works today and, in separate downstream modules, discovers evidence-backed KI-potential hypotheses with three read-only human-oversight scenarios, assesses the completed agentic scenario once against a versioned criteria catalogue, and creates read-only Excel exports. Do not add solution approval, financial values, prioritization, handover, or general project-management features to the active flow.

## Runtime

- Use the user's `zsh` shell.
- Run terminal commands with a non-login shell so Node 22 from nvm is used.
- Use Bun for dependency installation, development scripts, bundling, and cross-platform prototype compilation.
- Use the locally authenticated `codex` CLI by default; `AI_PROVIDER=claude-cli` keeps the Claude CLI compatibility path.
- On macOS the dev server always starts without the AI sandbox (`scripts/dev.ts` auto-detects darwin); the sandbox is for Linux environments only.
- Keep all submitted content and generated artifacts in repository-local files. Never commit real insurance or personal data.

## Local credentials

The prototype's login is gated. Real or reusable credentials live in the user's password manager and must never be read, requested, entered, stored, logged, or committed by an agent. For browser E2E against the local prototype only, an agent may enter credentials for an explicitly identified synthetic demo account when the user supplies them directly for that test. Use them only in the browser login form, never persist them in repository files, environment files, shell commands, test output, or commit messages, and recommend rotation if they appear in conversation history.

## Implementation rules

- Use TypeScript with strict type checking.
- Keep domain logic independent of React and AI-provider adapters.
- Validate every file read and every AI response at runtime before using it.
- Write files atomically and preserve an append-only audit history for AI and manual changes.
- Preserve evidence, assumptions, confidence, and provenance for every structured process fact. Human corrections require a recorded reason.
- AI output is advisory. Only a user action can confirm the process understanding.
- AI prompts and structured response schemas are versioned repository files, not inline strings scattered through application code.
- Do not send unrelated repository content to Claude. Pass only the idea data required for the current operation.
- Avoid autonomous loops. Process capture actions trigger one bounded operation. The explicitly started opportunity-discovery job is the sole exception: it may perform exactly one bounded hypothesis call followed deterministically by exactly one bounded scenario call when at least one high-confidence hypothesis or the defined fallback of two to three medium-confidence hypotheses exists.
- Process confirmation additionally triggers exactly one bounded memory-distillation operation.
- Do not resume Claude sessions. Every follow-up, synthesis, hypothesis, and scenario operation uses a fresh session; autonomous follow-up loops remain prohibited.
- Chat Capture is the sole explicit exception: one persisted Claude session may be resumed only by a later user-initiated chat turn for the same process. Page loads never resume it.
- Keep editable product behavior in `defaults/process-capture-config.json` and versioned prompts and schemas; do not bury workshop policy in React components.
- Das Dokumentationskorpus unter `workspace/docs/` ist ein abgeleitetes Read Model in einem app-verwalteten Git-Repo. Es wird ausschließlich deterministisch aus bestätigten Prozessverständnissen gerendert und nie von Hand oder durch KI-Text direkt bearbeitet.
- `documentation-sync` und Korpus-Reconciliation sind deterministische bounded Operationen ohne Claude-Session; sie fallen nicht unter die KI-Operationsregeln.
- Keep automated testing lean for this prototype: cover domain rules, file/reset safety, and the Claude process contract.
- Keep the demo-data warning visible globally and at intake. Do not weaken the per-session confirmation without explicit user approval.
- Preserve `user_stated`, `file_evidence`, `ai_structured`, `ai_inferred`, `user_confirmed`, and `unknown` provenance in storage and UI.
- Use `./scripts/qa changed` during implementation and focused `./scripts/qa test <file>` while repairing failures. Use `./scripts/qa all` once before handoff. Read full `.local/validation-runs` logs only when the compact failure excerpt is insufficient.

## Demo-Daten (`demo-data/`)

- Zweck: realistische Testdaten für reproduzierbare Tuningrunden. `freezeContracts()`
  friert Prompt und Schema pro Prozess ein, also wirkt jede Promptänderung nur auf neu
  angelegte Prozesse — jede Tuningrunde braucht deshalb einen frischen Prozess mit
  identischem Ausgangsmaterial.
- Ausschließlich erfundene Daten der fiktiven **LifeCorp Versicherung** unter der Domain
  `lifecorp.example`. Niemals reale Kunden-, Vertrags- oder Schadendaten in `demo-data/`
  ablegen.
- Ausschließlich Deutsch.
- `bun run seed <slug>|--alle|--list` seedet über die Repository-Schicht direkt (kein
  HTTP, keine Zugangsdaten nötig). Der Dev-Start seedet einen leeren Workspace
  automatisch; `DEMO_SEED=0` schaltet das ab.
- Der Demo-Sidecar in der Web-App speist sich aus `GET /api/demo/szenarien`.
- Der Präsentationsfall `leitungswasserschaden-wohngebaeude` deckt die reale
  Claude-Strecke von der Chat-Aufnahme bis zu beiden Excel-Exporten ab.
- `tests/demo-data.test.ts` hält die Szenarien konsistent — Schema, Dokumentenlisten,
  Fachbereiche, Formularfelder.
- Systemnamen und Personas kommen aus `demo-data/UNTERNEHMEN.md` und müssen über alle
  Szenarien hinweg konsistent bleiben.
- `bun run seed:docs [--list]` füllt die lebende Prozessdokumentation aus
  `demo-data/dokumentation/` — acht Prozesse über sechs Fachbereiche samt Revisionen und
  einer Rücknahme. Der Seed ist additiv, überspringt vorhandene Prozesstitel und erzeugt
  jeden Archiveintrag über die produktiven Pfade (`finalizeChatCapture`,
  `correctUnderstanding`/`confirm`, `syncProcess`, `revert`); in `workspace/docs` wird
  nichts von Hand geschrieben. Für den Leitungswasser-Präsentationsfall erzeugt er über
  die Repository-Pfade zusätzlich vier Potenzialhypothesen, drei Szenarien und eine
  abgeschlossene Bewertung mit klarer Demo-Seed-Trace, ohne KI-Aufruf. Format und erzählte
  Geschichte stehen in `demo-data/dokumentation/README.md`, geprüft von
  `tests/documentation-seed.test.ts`.

## UX rules

- Write German interface copy for an insurance manager, not a developer.
- Show the current state, the next required action, and why a recommendation was made.
- Use a restrained, accessible desktop-first UI that remains usable on tablets.
- No darkmode. The app is light mode only. Do not add `dark:` variants, a `.dark` token block, a `@custom-variant dark`, `prefers-color-scheme` rules, or a theme toggle. The shadcn CLI emits `dark:` classes when adding a component — strip them before committing.
- Do not expose raw JSON, terminal commands, prompt text, stack traces, or model terminology in the normal UI.

## Verification

Before considering an implementation task complete, run `./scripts/qa all` and the required release build. Verify UI workflows through Chrome DevTools MCP at desktop and tablet widths, including filtered console and failed-network inspection. Prefer accessibility snapshots over screenshots except when judging visual layout.

## Planning source

Start at `docs/domain/README.md`. It documents every feature — what it does, where its code lives, and its verified implementation status — and is the entry point for both humans and agents.

The superseded specifications in `docs/archive/` remain binding for detail: `PRODUCT-FLOW-KI-POTENTIAL.md` for process capture, `PLAN-KI-POTENTIAL-SCENARIOS.md` and `DISCOVERY-KI-POTENTIAL-SCENARIOS.md` for opportunity discovery, `PLAN-LEBENDE-PROZESSDOKU.md` for the living process documentation corpus. Preserve their domain states and acceptance criteria unless the user explicitly changes them.

Known gaps and guardrail divergences are recorded in `docs/BACKLOG.md`. Architecture decisions are in `docs/decisions/`, operator-facing German material in `docs/operations/`.
