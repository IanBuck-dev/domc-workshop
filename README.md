# Zukunftswerkstatt

German workshop prototype for understanding department processes and exploring their KI potential. In `Prozessaufnahme`, a domain expert chooses a conversational or form-based intake, uploads available files, and confirms an evidence-backed process understanding with a typed process map. For a confirmed process, separate read-only modules discover KI-potential hypotheses, compare three human-oversight scenarios (`assistive`, `delegated`, `agentic`), assess the agentic scenario, derive a directional portfolio score, and create deterministic Excel exports. Project approval, financial values, and automatic implementation decisions remain later phases.

Repository-local files are the system of record. The backend uses a provider-neutral AI runtime with Codex CLI as the default and Claude CLI as a compatibility provider. Every current AI action is explicit and bounded. Authenticated server-sent events update active browser views without periodic polling.

## Current product boundary

The domain expert selects files through the local file picker. The application validates and stores them in the process workspace; only explicitly selected files are available to the AI operation. The prototype has no SharePoint connector, no background crawler, and no autonomous discovery of processes or documents. Documents and interviews may contradict each other, so only explicit human confirmation turns the current understanding into the accepted process.

## Vision: agentic process intelligence

A later version can give a governed agent access to approved evidence sources instead of requiring every file to be selected manually. With a defined organisational scope, versioned instructions, least-privilege connectors, and bounded budgets, the agent can inspect process registers, instructions, system descriptions, and operational evidence; propose process candidates; identify gaps; and prepare interviews. It must preserve provenance and assumptions, resist instructions embedded in source documents, and leave confirmation and material decisions with humans.

The architecture already points in that direction:

- **Data sources over copied context:** agents receive controlled access to the source needed for the task.
- **Instructions and schemas:** versioned prompts and runtime validation define the expected work and output.
- **Agentic memory:** confirmed lessons can support later captures without silently becoming facts of a new process.
- **Bounded autonomy:** agents may gather and prepare within explicit scope, but do not approve processes, solutions, or business decisions.
- **Deterministic delivery:** web reviews and Excel exports use saved, validated domain objects rather than rerunning AI.

The documentation backlog includes a small handover wiki for insurance IT and AI teams plus a separate design track for autonomous process discovery. Neither is part of the implemented capture flow today.

## Start development

Requirements: Bun 1.3+, Node 22, and—only for live AI actions—an installed and authenticated Codex CLI. Claude CLI remains available through `AI_PROVIDER=claude-cli`.

```zsh
bun install --frozen-lockfile
bun run dev
```

Configure the single application account before starting:

```zsh
export APP_AUTH_USERNAME=testing
export APP_AUTH_PASSWORD_HASH='<Bun.password hash>'
export APP_SESSION_SECRET='<at least 32 random characters>'
bun run dev
```

Open `http://127.0.0.1:5173`. Never enter real claim, customer, contract, health, employee, or other confidential production data.

Every feature is documented in [docs/domain/](docs/domain/README.md) — what it does, where its code lives, and whether it is built. Known gaps are listed in [docs/BACKLOG.md](docs/BACKLOG.md); the superseded specifications that still bind the acceptance criteria are kept in [docs/archive/](docs/archive/README.md).

The fictional insurer and all cross-cutting demo assumptions are documented in
[LIFECORP.md](LIFECORP.md). It links the binding detail catalogues for the
organisation, systems and data sources, modelling frame, and target process
portfolio.

## Validate and package

```zsh
./scripts/qa changed
./scripts/qa all
./scripts/qa release
```

Release outputs are written to `dist/`, including the Linux ARM64 target for the Raspberry Pi. The selected AI CLI and the configured sandbox runtime must be installed separately on the deployment host. Production startup intentionally fails AI workspace operations when required sandboxing is unavailable.

See [operator instructions](docs/operations/OPERATOR_GUIDE.de.md), the [Raspberry Pi deployment runbook](docs/operations/PI-DEPLOYMENT.md), and [data notice](docs/operations/PRIVACY_NOTICE.de.md).
