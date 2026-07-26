# Prozessaufnahme

German workshop prototype for capturing and confirming how department processes work today. The compact two-page form produces an evidence-backed process brief and high-level process map. For a confirmed process, a separate read-only module can then discover evidence-backed KI-potential hypotheses and generate three human-oversight scenarios (`assistive`, `delegated`, `agentic`). Project assessment, scoring, prioritization, and ranking remain later phases. Repository-local files are the system of record, and the backend invokes the authenticated Claude CLI only for explicit, bounded actions.

## Start development

Requirements: Bun 1.3+, Node 22, and—only for live AI actions—an installed and authenticated Claude Code CLI.

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

The process flow is specified in [docs/PRODUCT-FLOW-KI-POTENTIAL.md](docs/PRODUCT-FLOW-KI-POTENTIAL.md); the downstream module and its acceptance criteria are specified in [docs/PLAN-KI-POTENTIAL-SCENARIOS.md](docs/PLAN-KI-POTENTIAL-SCENARIOS.md).

## Validate and package

```zsh
./scripts/qa changed
./scripts/qa all
./scripts/qa release
```

Release outputs are written to `dist/`, including the Linux ARM64 target for the Raspberry Pi. Claude CLI and Anthropic Sandbox Runtime must be installed separately on the deployment host. Production startup intentionally fails AI workspace operations when sandboxing is unavailable.

See [operator instructions](docs/OPERATOR_GUIDE.de.md) and [data notice](docs/PRIVACY_NOTICE.de.md).
