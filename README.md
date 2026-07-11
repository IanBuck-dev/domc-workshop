# Claims-Ideenportfolio

Local German workshop prototype for turning unstructured insurance project ideas into transparent assessments and an IT-ready portfolio. Markdown and YAML files under `workspace/` are the system of record; Claude Code is invoked only for explicit, bounded actions.

## Start development

Requirements: Bun 1.3+, Node 22, and—only for live AI actions—an installed and authenticated Claude Code CLI.

```zsh
bun install --frozen-lockfile
bun run dev
```

Open `http://127.0.0.1:5173`. The first start creates `workspace/` with twelve demo projects. Never enter real claim, customer, contract, health, or employee data.

## Validate and package

```zsh
./scripts/qa changed
./scripts/qa all
./scripts/qa release
```

Release outputs are written to `dist/`. The Windows prototype is unsigned and may trigger SmartScreen. Claude Code must be installed and authenticated separately on the target computer.

See [operator instructions](docs/OPERATOR_GUIDE.de.md) and [data notice](docs/PRIVACY_NOTICE.de.md).
