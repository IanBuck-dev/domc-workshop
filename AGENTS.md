# Repository Agent Instructions

## Product boundary

Build a local prototype for claims project intake, clarification, assessment, prioritization, manual review, and IT handover. Do not turn it into a general project-management suite.

## Runtime

- Use the user's `zsh` shell.
- Run terminal commands with a non-login shell so Node 22 from nvm is used.
- Use Bun for dependency installation, development scripts, bundling, and cross-platform prototype compilation.
- Treat the locally authenticated `claude` CLI as the only AI provider in the first prototype.
- Keep all submitted content and generated artifacts in repository-local files. Never commit real insurance or personal data.

## Implementation rules

- Use TypeScript with strict type checking.
- Keep domain logic independent of React and the Claude adapter.
- Validate every file read and every AI response at runtime before using it.
- Write files atomically and preserve an append-only audit history for AI and manual changes.
- Never silently reject a non-AI idea. Label it, explain the assessment, and keep it available for human review.
- Scores must expose their component values, weights, evidence, assumptions, and confidence. Users can override them only with a recorded reason.
- AI output is advisory. Only a user action can mark an idea ready for IT handover.
- Claude prompts and structured response schemas are versioned repository files, not inline strings scattered through application code.
- Do not send unrelated repository content to Claude. Pass only the idea data required for the current operation.
- Avoid autonomous loops. One explicit user action may trigger one bounded analysis or clarification operation.
- Process Discovery may resume one deterministic Claude session across user messages. Each explicit user message still triggers exactly one bounded interview turn; autonomous follow-up loops remain prohibited.
- Keep the product behavior primarily editable through `defaults/CLAUDE.md` and `defaults/workshop.yaml`; do not bury workshop policy in React components.
- Keep automated testing lean for this prototype: cover domain rules, file/reset safety, and the Claude process contract.
- Keep the demo-data warning visible globally and at intake. Do not weaken the per-session confirmation without explicit user approval.
- Preserve `PUBLIC`, `INFERRED`, and `FICTIONAL` provenance in storage, UI, and exports. Never present inferred or fictional demo work as an actual DOMCURA commitment.
- Use `./scripts/qa changed` during implementation and focused `./scripts/qa test <file>` while repairing failures. Use `./scripts/qa all` once before handoff. Read full `.local/validation-runs` logs only when the compact failure excerpt is insufficient.

## UX rules

- Write German interface copy for an insurance manager, not a developer.
- Show the current state, the next required action, and why a recommendation was made.
- Use a restrained, accessible desktop-first UI that remains usable on tablets.
- Do not expose raw JSON, terminal commands, prompt text, stack traces, or model terminology in the normal UI.

## Verification

Before considering an implementation task complete, run `./scripts/qa all` and the required release build. Verify UI workflows through Chrome DevTools MCP at desktop and tablet widths, including filtered console and failed-network inspection. Prefer accessibility snapshots over screenshots except when judging visual layout.

## Planning source

Follow `docs/PLAN.md` until it is replaced by a more specific approved plan. Preserve its domain states and acceptance criteria unless the user explicitly changes them.
