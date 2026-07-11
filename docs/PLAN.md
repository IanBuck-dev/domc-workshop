# Prototype Implementation Plan

## Current status — 11 July 2026

The macOS development prototype is implemented and running locally. The current repository includes:

- all twelve provenance-labeled demo projects with repository-local Markdown/YAML storage and append-only history;
- German intake, portfolio, project detail, impact/effort matrix, IT handover, settings, first-run warning, and hidden demo-creation timeline views;
- bounded Claude CLI integration with versioned prompts and schemas, selectable configured model and reasoning effort, plus one low-effort live smoke example;
- transparent 1–5 priority, 1–10 impact/effort, confidence, score components, evidence, assumptions, review flags, override reasons, and human-controlled handover state;
- an interactive matrix with smart point-anchored previews and direct detail navigation;
- direct handover selection, clearing, persisted preselection, readiness warnings, and Markdown/CSV export;
- a non-technical project-brief reader and section-based editor that keeps Markdown syntax out of the normal interface;
- DOMCURA-inspired responsive styling, the public colored logo, locally bundled Open Sans, compact cards, desktop navigation, and tablet icon navigation;
- guarded reset with backup, automatic migration of older workshop settings, single-instance protection, and concise German error states;
- token-efficient QA wrappers, focused domain/storage/Claude contract tests, production web build, and non-technical operating/privacy documentation.

Latest validation passed: formatting, linting, strict TypeScript checking, all tests, and the production build. Chrome DevTools verification passed on desktop and tablet for settings loading, project-brief view/edit toggling, card spacing, matrix interaction, handover selection persistence, network requests, and a console without warnings or errors.

Remaining before a distributable workshop handoff: run the release packaging command, smoke-test the macOS executable, cross-build and ZIP-validate the Windows x64 executable. Execution on a real Windows machine, SmartScreen behavior, and Windows persistence/browser-opening workflows remain explicitly deferred.

## Outcome

Deliver a German-language, local workshop prototype that turns loosely written claims-project ideas into transparent assessments and an IT-ready ranked portfolio. Markdown files are the system of record. Claude CLI reads one explicit instruction file and performs one bounded operation per user action. A fresh DOMCURA-inspired interface makes the files usable for a non-technical claims leader.

## Locked assumptions

- The target user runs Windows x64; development happens on this Apple Silicon Mac.
- Distribution is one ZIP per operating system. The user double-clicks one executable; on first start it creates the editable workspace beside itself and opens the local web app in the default browser.
- The Windows executable is cross-built on macOS with Bun. It is unsigned, so Windows SmartScreen may warn during the prototype. Production signing is deferred.
- Claude Code must be installed and authenticated separately on the target computer.
- German is the UI, generated-content, demo-data, and handover language. Code and technical documentation remain English.
- Only fictional or anonymized workshop content may be entered. The prototype is not approved for claims files, customer data, special-category data, trade secrets, or production decisions.
- One user and local files are sufficient. Authentication, concurrency, a database, cloud hosting, and enterprise integrations are excluded.
- AI relevance is a visible classification, never a deletion rule. A valuable non-AI idea remains in the portfolio with a conventional implementation recommendation.
- Business priority, implementation effort, and AI suitability remain separate. There is no opaque combined AI score.

## Product shape

### Views

1. **Ideen erfassen** — title and large free-text field, followed by extraction and at most three clarification questions.
2. **Portfolio** — sortable cards/table with status, 1–5 priority, AI relevance, impact, effort, confidence, and next action.
3. **Ideendetail** — original text, derived brief, Claude rationale, editable scores, manual override reason, history, and handover readiness.
4. **Impact-/Aufwand-Matrix** — interactive 10×10 scatter plot; impact increases upward, effort increases rightward; clicking a point opens its idea.
5. **IT-Übergabe** — selected project briefs, readiness warnings, ordered list, Markdown export, and CSV summary.
6. **Workshop-Einstellungen** — model, reasoning effort, scoring guidance, workshop labels, and reset controls.
7. **Entstehung der Demo** — only linked from Workshop-Einstellungen; shows a restrained prompt/result timeline through the fixed implementation cutoff, measured Codex session usage, clearly labeled API-equivalent pricing, and the separate GPT-5.6 Sol extra-high DOMCURA research prompt. Follow-up work on this page is excluded from the timeline.

### Lifecycle

`Entwurf -> Klärung nötig -> Bewertungsbereit -> Bewertet -> Für Übergabe ausgewählt -> Übergeben`

`Archiviert` is a reversible manual state after `Entwurf`.

### Claude operations

- `structure`: derive the brief and clarification questions from the immutable raw submission.
- `assess`: classify AI relevance and propose priority, impact, effort, suitability, evidence, assumptions, risks, and confidence.
- `refresh`: repeat assessment after facts or workshop guidance change while retaining history.
- `prepare-handover`: create an IT brief only after explicit user selection.

Each click starts one new `claude -p` process with tools disabled, JSON Schema output, a timeout, and capped output. No conversation is resumed and no autonomous loop runs.

## Markdown workspace

The executable creates this human-readable structure on first launch:

```text
workspace/
  CLAUDE.md
  workshop.yaml
  ideas/
    IDEA-0001/
      raw.md
      brief.md
      assessment.md
      metadata.yaml
      history.jsonl
  exports/
  templates/
    brief.md
    assessment.md
    handover.md
  defaults/
    CLAUDE.md
    workshop.yaml
    demo-ideas/
```

- `raw.md` is the original submission and is never rewritten.
- `brief.md` contains the editable structured project brief and clarification answers.
- `assessment.md` contains human-readable Claude recommendations, evidence, assumptions, and warnings.
- `metadata.yaml` contains schema-versioned machine fields for state, scores, overrides, model settings, timestamps, and export readiness.
- `history.jsonl` is append-only and records generated and manual changes.
- `workspace/CLAUDE.md` is the main behavior contract and is deliberately editable for workshop experiments.
- `workshop.yaml` exposes labels, score weights, model choices, default model, effort level, and matrix quadrant thresholds without requiring code changes.
- Reset first writes a timestamped backup ZIP, then restores `CLAUDE.md`, `workshop.yaml`, and fictional demo ideas from embedded defaults. It requires typing `ZURÜCKSETZEN` and never deletes exports or backups.

## Demo-data warning and provenance

A compact warning banner is shown below the application header on every view:

> **Nur Demo-Daten verwenden.** Keine echten Schaden-, Kunden-, Vertrags-, Gesundheits- oder Beschäftigtendaten eingeben. Inhalte werden lokal gespeichert und zur Analyse an die konfigurierte Claude-CLI übergeben.

The same warning appears directly above the intake field and in the first-run screen. It is visually noticeable without blocking the workshop. The user may dismiss it for the current browser session, but it returns after application restart. The intake form requires a one-time checkbox confirmation per session: `Ich verwende ausschließlich freigegebene Demo- oder anonymisierte Daten.`

Every seeded and user-created idea has an `evidenceLevel`:

- `PUBLIC` — publicly confirmed initiative; show `Öffentlich bestätigt` in green.
- `INFERRED` — plausible initiative derived from public statements; show `Aus öffentlichen Angaben abgeleitet` in blue.
- `FICTIONAL` — realistic workshop example with no claim of real DOMCURA activity; show `Fiktives Demo-Beispiel` in grey.

The detail page displays the label beside the title and explains it. `PUBLIC` and `INFERRED` records include source title, publisher, and URL in `metadata.yaml`. The IT export repeats the evidence label and never presents `INFERRED` or `FICTIONAL` content as a company commitment.

## Default demo portfolio

Seed all twelve projects below. Priority values are translated into the prototype convention where `5` is highest and `1` is lowest. Impact and effort retain the supplied 1–10 values. Descriptions and derived assessments are clearly marked as demo content.

| ID          | Project                                           | Evidence    | Priority | Impact | Effort |
| ----------- | ------------------------------------------------- | ----------- | -------: | -----: | -----: |
| `IDEA-0001` | KIM – automatisierte Schadenbearbeitung           | `PUBLIC`    |        5 |     10 |      9 |
| `IDEA-0002` | KIM Partner Rollout                               | `PUBLIC`    |        5 |      9 |      8 |
| `IDEA-0003` | AI Governance & Audit Cockpit                     | `INFERRED`  |        5 |      9 |      6 |
| `IDEA-0004` | KI-Eingangspost und Schaden-Triage                | `FICTIONAL` |        5 |      8 |      4 |
| `IDEA-0005` | Unwetter- und Massenschadenmodus                  | `FICTIONAL` |        4 |      9 |      7 |
| `IDEA-0006` | Vermittler-Copilot                                | `FICTIONAL` |        4 |      8 |      7 |
| `IDEA-0007` | KI-Dokumentenprüfung im Underwriting              | `FICTIONAL` |        4 |      7 |      6 |
| `IDEA-0008` | Automatisierte Kundenkommunikation                | `FICTIONAL` |        4 |      6 |      3 |
| `IDEA-0009` | Betrugs- und Anomalieerkennung                    | `FICTIONAL` |        3 |      8 |      9 |
| `IDEA-0010` | Interner Wissensassistent                         | `FICTIONAL` |        3 |      5 |      4 |
| `IDEA-0011` | KI-Zusammenfassung für Tickets und Meetings       | `FICTIONAL` |        2 |      3 |      2 |
| `IDEA-0012` | Eigenes Versicherungs-Foundation-Model trainieren | `FICTIONAL` |        1 |      4 |     10 |

`IDEA-0001` cites DOMCURA's article `Innovationspreis der Assekuranz`. `IDEA-0002` cites the AssCompact article `DOMCURA-KI unterstützt nun auch andere Firmen`. `IDEA-0003` cites the Cash.-Online interview `Unser Vorsprung ist heute doppelt – DOMCURA setzt auf KI mit menschlichem Kern` and explicitly states that the project itself is inferred. The nine fictional records contain no external source claim.

The defaults intentionally cover every priority level, all four matrix quadrants, public/inferred/fictional provenance, low- and high-effort work, a non-AI-alternative discussion, governance concerns, customer communication, employee-facing assistance, fraud indicators, and an intentionally unattractive foundation-model proposal.

## Claude instruction contract

`workspace/CLAUDE.md` will instruct Claude to:

- respond in plain German for an insurance management and IT audience;
- separate observed facts, user statements, assumptions, and recommendations;
- ask at most three decision-relevant clarification questions and accept `unbekannt` as an answer;
- retain non-AI ideas and state when rules, workflow redesign, analytics, integration, or conventional software is more suitable;
- never invent business values, data availability, legal conclusions, savings, or implementation facts;
- identify affected claims processes, users, systems, data classes, decision consequences, dependencies, risks, measurable outcomes, and a smallest discovery step;
- flag personal data, sensitive claims content, automated decisions affecting people, fraud indicators, employee monitoring, external model transfer, and unclear hosting as mandatory review topics;
- treat every legal and regulatory note as a review flag for Datenschutz, Informationssicherheit, Compliance, Betriebsrat, and the accountable business owner—not as legal advice;
- produce only the supplied JSON Schema and never edit files or invoke tools.

The app passes only the current idea files plus `CLAUDE.md` and the scoring section of `workshop.yaml`. It never grants Claude repository or shell tools.

## German insurance guidance

Every assessment records these review flags:

- purpose and accountable business owner;
- data categories, personal-data involvement, minimization, retention, and intended hosting/transfer;
- whether output influences claim acceptance, denial, payment, reserve, fraud handling, customer communication, employee assessment, or another consequential decision;
- required human review, contestability, auditability, and fallback process;
- bias/discrimination risk and groups potentially affected;
- information security, provider dependency, operational resilience, and integration ownership;
- required involvement of Datenschutz, Informationssicherheit, Compliance/Recht, Betriebsrat, Fachbereich, and IT.

The prototype does not determine GDPR, EU AI Act, DORA, VAG, or BaFin compliance. It flags the need for specialist review. Ideas involving individual life/health insurance risk assessment or pricing receive a prominent potential-high-risk warning; claims use cases are assessed by their actual purpose and decision effect, not assumed compliant from their label.

## Scoring and portfolio order

### Visible priority: 1–5

Priority is a human-confirmable recommendation derived from business impact, urgency, strategic fit, risk reduction, feasibility, and dependencies. It is displayed as both number and text so color is never the only signal:

- `1 — Niedrig`: neutral grey
- `2 — Beobachten`: blue
- `3 — Relevant`: amber
- `4 — Hoch`: orange
- `5 — Kritisch`: red

Claude proposes the component reasoning; deterministic application rules map it to 1–5. A manual override requires a reason and preserves the prior value.

### Impact-/effort matrix: 1–10 per axis

- Impact combines customer/claims outcome, financial/capacity benefit, strategic relevance, urgency, and risk reduction.
- Effort combines data readiness, integration breadth, process change, compliance/security work, delivery complexity, and ongoing operation.
- Default quadrants use 5.5 as both thresholds: `Schnelle Erfolge`, `Strategische Vorhaben`, `Lückenfüller`, `Später prüfen`.
- The app prevents overlapping point labels with compact numbered markers and an adjacent legend.
- Matrix position never silently changes priority; it provides a second decision view.

### AI relevance

`Stark`, `Möglich`, `Schwach`, or `Keine`, with rationale, a conventional alternative, data readiness, evaluation approach, and confidence.

Default portfolio order is manual priority descending, impact descending, effort ascending, then creation timestamp ascending.

## Claude model settings

- Default display choice: `Claude Opus 4.8`.
- Default CLI value: `opus`, intentionally using Claude CLI's latest-Opus alias.
- Default reasoning effort: `medium`, passed as `--effort medium`.
- Workshop settings offer the configured model entries from `workshop.yaml` and effort values `low`, `medium`, `high`, `xhigh`, `max`.
- Advanced users may add a full Claude model identifier to `workshop.yaml`; arbitrary command-line arguments are never accepted.
- The environment check displays the installed Claude Code version and tests authentication with a minimal bounded call.
- Implementation verification uses the authenticated local Claude CLI for exactly one representative fictional idea with `--effort low`; all other development and automated checks use validated fixtures to keep model usage low. This verification-only override does not change the workshop default of `medium`.

## Visual direction

Use a fresh internal-tool interpretation of DOMCURA's public visual language, not a pixel copy and not an assertion of official endorsement:

- primary dark green `#005744` for navigation and primary actions;
- accent red-orange `#D44021` for active emphasis, not general error styling;
- lime `#C3D221` and light lime `#E0E379` for highlights and selected states;
- charcoal `#4A4A49`, white, warm off-white, and pale green `#EDF7BF` surfaces;
- locally bundled Open Sans, the public site's 24px text rhythm, cream surfaces, muted green structural accents, generous whitespace, rounded cards, minimal shadows, and restrained motion;
- the public DOMCURA white SVG wordmark in the prototype header, added at the user's explicit request;
- WCAG-friendly contrast, visible focus states, keyboard navigation, and labels/icons in addition to color.

## Architecture and packaging

- Bun workspace, Vite React TypeScript client, Tailwind CSS, and a minimal Hono server.
- Shared Zod schemas validate YAML, Markdown front matter, and Claude JSON responses.
- `packages/domain` owns states, scoring, ranking, validation, and export generation without React or Claude dependencies.
- Development command: `bun run dev` with client/server hot reload and seeded disposable workshop data.
- Agent validation command: `./scripts/qa changed` during iteration and `./scripts/qa all` before handoff.
- Release command bundles the web assets into one Bun server entry and cross-compiles `dist/Claims-Ideenportfolio-windows-x64.exe` plus `dist/Claims-Ideenportfolio-macos-arm64`.
- At runtime the executable binds only to `127.0.0.1`, chooses an available port, opens the default browser, and prevents a second instance from corrupting files.
- The macOS launcher is runtime-tested on macOS. The Windows x64 artifact is cross-built and ZIP-validated; real Windows runtime testing is explicitly deferred by the user for this workshop iteration.

## Delivery phases

### 1. Developer shell and editable workspace

Scaffold Bun/Vite/Hono/Tailwind, schemas, Markdown repository, embedded defaults, all twelve German demo ideas, the persistent demo-data warning, provenance labels, environment check, and dev hot reload.

Acceptance: `bun install && bun run dev` opens all twelve seeded ideas at their specified priority/impact/effort positions; the warning appears globally and at intake; intake remains disabled until the per-session demo-data confirmation is checked; provenance labels and source links match the seed definitions; editing `workspace/workshop.yaml` and reloading changes workshop labels; restart preserves ideas.

### 2. Intake and Claude workflow

Implement raw capture, structure/clarify/assess operations, schema validation, timeout/retry states, model/effort selection, and history.

Acceptance: a vague idea produces at most three German questions; `unbekannt` is accepted; a failed Claude process leaves files intact and retryable; the process receives no tools.

### 3. Portfolio UI and workshop controls

Implement all six views, 1–5 color scale, 10×10 matrix, detail editing, manual overrides, model settings, backups, and guarded reset.

Acceptance: non-AI ideas stay visible; all recommendations expose evidence and confidence; reset restores defaults after creating a backup; keyboard use does not depend on color.

### 4. Handover and packaging

Implement readiness checks, Markdown/CSV exports, embedded production assets, browser opening, macOS/Windows builds, and non-technical operator instructions.

Acceptance: a selected idea exports reproducibly; both binaries build on macOS; the macOS build completes the smoke workflow; the Windows ZIP is run on a real Windows x64 machine before handoff.

## Files To Change

- `package.json`, `bun.lock`, `tsconfig.json`, `eslint.config.js`, `.gitignore`
- `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/app.tsx`, `apps/web/src/styles.css`
- `apps/web/src/pages/intake-page.tsx`, `portfolio-page.tsx`, `idea-detail-page.tsx`, `matrix-page.tsx`, `handover-page.tsx`, `settings-page.tsx`, `showcase-page.tsx`
- `apps/web/src/components/priority-badge.tsx`, `evidence-badge.tsx`, `demo-data-warning.tsx`, `idea-card.tsx`, `impact-effort-matrix.tsx`, `review-flags.tsx`, `app-shell.tsx`
- `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/german-copy.ts`
- `apps/server/src/index.ts`, `launcher.ts`, `routes/ideas.ts`, `routes/claude.ts`, `routes/settings.ts`, `routes/exports.ts`
- `packages/domain/src/schemas.ts`, `states.ts`, `priority.ts`, `matrix.ts`, `ranking.ts`, `handover.ts`
- `packages/storage/src/markdown-idea-repository.ts`, `workspace-repository.ts`, `atomic-write.ts`, `backup.ts`, `audit-log.ts`
- `packages/claude/src/claude-cli-adapter.ts`, `request-builder.ts`, `response-schemas.ts`
- `defaults/CLAUDE.md`, `defaults/workshop.yaml`, `defaults/templates/brief.md`, `defaults/templates/assessment.md`, `defaults/templates/handover.md`
- `defaults/demo-ideas/IDEA-0001/` through `defaults/demo-ideas/IDEA-0012/`
- `scripts/build-release.ts`, `scripts/check-environment.ts`, `scripts/reset-workspace.ts`
- `scripts/qa`, `scripts/qa-lib.zsh`
- `tests/domain.test.ts`, `tests/storage.test.ts`, `tests/claude-contract.test.ts`
- `README.md`, `AGENTS.md`, `docs/OPERATOR_GUIDE.de.md`, `docs/PRIVACY_NOTICE.de.md`

## Verification

Keep automated coverage deliberately small: domain score/rank rules, Markdown round-trip/reset safety, and Claude schema/argument construction.

### Token-efficient validation wrappers

Implement one repository-native `scripts/qa` wrapper, inspired by the proven agent-manager validation scripts but independent of that repository:

- `./scripts/qa changed` inspects staged, unstaged, and untracked files, then runs only the relevant lint, typecheck, focused test, and build gates.
- `./scripts/qa all` runs format check, lint, typecheck, all focused prototype tests, and the production build.
- `./scripts/qa test [test-file...]` runs selected tests and accepts an optional `--name <pattern>` filter.
- `./scripts/qa build`, `lint`, `typecheck`, and `release` run individual gates.
- Each gate redirects complete stdout/stderr to `.local/validation-runs/<timestamp>-<gate>.log`.
- Success prints one line containing gate, status, and elapsed time.
- Failure prints the command, up to twenty actionable diagnostic lines, and the full log path. It never dumps an entire build or test log into agent context.
- Test execution uses a machine-readable reporter so failed test names and the first concise assertion message can be extracted reliably.
- `.local/` is gitignored. Logs are retained locally for manual diagnosis and may be opened selectively when the compact excerpt is insufficient.
- The wrapper remains dependency-light and zsh-compatible; it must work after `bun install` without depending on files from agent-manager.

Agents use `changed` while iterating, targeted `test` for failures, and `all` once at handoff. They do not repeatedly run the complete validation suite after isolated copy or style edits.

```sh
bun install --frozen-lockfile
./scripts/qa all
./scripts/qa release
```

Use Chrome DevTools MCP for implementation-time verification at 1440×900 and 1024×768. Prefer accessibility-tree snapshots for interaction and state checks; take screenshots only for visual inspection milestones. Inspect filtered console errors and failed network requests rather than returning full logs. Complete intake, clarification, assessment, override, matrix navigation, handover, backup, and reset. Chrome DevTools MCP was verified available in this planning session; the separate in-app Browser integration was unavailable and is not required.

Run one real Claude CLI smoke assessment for a single fictional demo idea at low reasoning effort. Do not make additional live model calls during implementation verification unless that smoke call fails for a diagnosable integration reason.

Run the release artifact on macOS. Cross-build and ZIP-validate the Windows artifact. Real Windows x64 execution, SmartScreen, browser-opening, persistence, export, backup, reset, and shutdown verification are deferred for this workshop iteration by explicit user direction.

## Explicitly deferred

Code signing, installer creation, production data approval, legal determination, user accounts, cloud deployment, collaboration, database storage, IT ticket creation, email, background agents, enterprise model gateway, and production integrations are outside this prototype.
