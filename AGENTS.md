# Repository Agent Instructions

## Product boundary

Build a local prototype that captures and confirms how a department process works today and, in a separate downstream module, discovers evidence-backed KI-potential hypotheses and three read-only human-oversight scenarios for confirmed processes. Do not add solution assessment, financial values, scoring, prioritization, handover, or general project-management features to the active flow.

## Runtime

- Use the user's `zsh` shell.
- Run terminal commands with a non-login shell so Node 22 from nvm is used.
- Use Bun for dependency installation, development scripts, bundling, and cross-platform prototype compilation.
- Treat the locally authenticated `claude` CLI as the only AI provider in the first prototype.
- On macOS the dev server always starts without the AI sandbox (`scripts/dev.ts` auto-detects darwin); the sandbox is for Linux environments only.
- Keep all submitted content and generated artifacts in repository-local files. Never commit real insurance or personal data.

## Local credentials

The prototype's login is gated. Credentials live in the user's 1Password in the item named **claims demo account** — never in the repository, environment files, or commit messages. Agents must not read, request, or type the password: ask the user to sign in themselves in the browser, then continue from the authenticated session.

## Implementation rules

- Use TypeScript with strict type checking.
- Keep domain logic independent of React and the Claude adapter.
- Validate every file read and every AI response at runtime before using it.
- Write files atomically and preserve an append-only audit history for AI and manual changes.
- Preserve evidence, assumptions, confidence, and provenance for every structured process fact. Human corrections require a recorded reason.
- AI output is advisory. Only a user action can confirm the process understanding.
- Claude prompts and structured response schemas are versioned repository files, not inline strings scattered through application code.
- Do not send unrelated repository content to Claude. Pass only the idea data required for the current operation.
- Avoid autonomous loops. Process capture actions trigger one bounded operation. The explicitly started opportunity-discovery job is the sole exception: it may perform exactly one bounded hypothesis call followed deterministically by exactly one bounded scenario call when at least one high-confidence hypothesis or the defined fallback of two to three medium-confidence hypotheses exists.
- Do not resume Claude sessions. Every follow-up, synthesis, hypothesis, and scenario operation uses a fresh session; autonomous follow-up loops remain prohibited.
- Chat Capture is the sole explicit exception: one persisted Claude session may be resumed only by a later user-initiated chat turn for the same process. Page loads never resume it.
- Keep editable product behavior in `defaults/process-capture-config.json` and versioned prompts and schemas; do not bury workshop policy in React components.
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
- `tests/demo-data.test.ts` hält die Szenarien konsistent — Schema, Dokumentenlisten,
  Fachbereiche, Formularfelder.
- Systemnamen und Personas kommen aus `demo-data/UNTERNEHMEN.md` und müssen über alle
  Szenarien hinweg konsistent bleiben.

## UX rules

- Write German interface copy for an insurance manager, not a developer.
- Show the current state, the next required action, and why a recommendation was made.
- Use a restrained, accessible desktop-first UI that remains usable on tablets.
- No darkmode. The app is light mode only. Do not add `dark:` variants, a `.dark` token block, a `@custom-variant dark`, `prefers-color-scheme` rules, or a theme toggle. The shadcn CLI emits `dark:` classes when adding a component — strip them before committing.
- Do not expose raw JSON, terminal commands, prompt text, stack traces, or model terminology in the normal UI.

## Verification

Before considering an implementation task complete, run `./scripts/qa all` and the required release build. Verify UI workflows through Chrome DevTools MCP at desktop and tablet widths, including filtered console and failed-network inspection. Prefer accessibility snapshots over screenshots except when judging visual layout.

## Planning source

Follow `docs/PRODUCT-FLOW-KI-POTENTIAL.md` for process capture and `docs/PLAN-KI-POTENTIAL-SCENARIOS.md` for opportunity discovery. Preserve their domain states and acceptance criteria unless the user explicitly changes them.
