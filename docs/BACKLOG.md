# Backlog

Everything the release-preparation audit of 2026-08-12 turned up: gaps between the decided
specs and the code, guardrail violations, dead code, and documentation inconsistencies.

This list is a record, not a plan. Nothing here was fixed while it was written — the
branch that produced it changed documentation only. Deciding what to fix is the point of
having the list.

Format:

```
- **[<domain>] <what>** — <why it matters>. Evidence: `path/file.ts:123`. Size: S/M/L.
```

Size is implementation effort: **S** under an hour, **M** up to a day, **L** more, or a
product decision is required first.

---

## process-capture / agent-memory

- **[agent-memory] Form-mode confirmation never feeds the agent brain** — `AGENTS.md`
  states that a confirmed process is distilled into the company memory, without
  qualification, but `MemoryDistillationService.distill` rejects anything that is not a
  chat capture, and the form confirm route never enqueues distillation. Half the capture
  modes therefore teach the brain nothing, silently. The cause is structural: distillation
  reads the chat transcript, which a form capture does not have. Either extend distillation
  to work from the confirmed understanding alone, or narrow the rule in `AGENTS.md` so the
  documentation stops promising it. Evidence:
  `apps/server/src/memory-distillation-service.ts:57`,
  `apps/server/src/routes/process-captures.ts:416`. Size: L (product decision first).

## process-diagram

- **[process-diagram] Form-mode leads never see the process diagram** — the typed flow
  graph is stored and validated for every understanding regardless of capture mode, but
  `ProcessFlowDiagram` is imported only by the chat page. The process detail page renders
  the linear, editable step strip instead, so a form-mode lead never sees the gateways
  their own understanding contains — and gateways are exactly what a lead is best placed to
  correct. Evidence: `apps/web/src/pages/process-chat-page.tsx`,
  `apps/web/src/components/process-map.tsx`. Size: M.

## process-documentation

- **[process-documentation] Tables can never render, and both sides of the gap are dead
  code** — `react-markdown` runs with `skipHtml` and **without** `remark-gfm`, so a GFM
  table stays literal text. That makes the table CSS at
  `apps/web/src/components/corpus-document.tsx:63` and the `td`/`th` entries in the
  `highlightable` list at line 74 unreachable, and it constrains what the corpus renderer
  may emit. Recommendation: add `remark-gfm` — a process manual has genuine table content
  (systems, quantities, handovers) — then remove whichever side loses. Evidence:
  `apps/web/src/components/corpus-document.tsx:63`, `:74`; note in
  `apps/web/src/styles.css` print block. Size: S.

## chat-capture

- **[chat-capture] Claude writes the working file through the raw filesystem** — the V1
  design has the agent write `process-understanding.json` directly, with the server
  watching the file at 350 ms and validating it out-of-band. The planned V2 replacement — an
  application-owned structured write tool, so an invalid revision can be rejected at the
  point of writing rather than detected afterwards — was never specified or built. Until it
  exists, an invalid write is caught only by the watcher, and only after it has landed on
  disk. Evidence: `apps/server/src/chat-turn-runner.ts`,
  `apps/server/src/process-flow-verification.ts`, and the "Not yet specified" section of
  the retired `.scratch/chat-capture-v1/map.md` (git history). Size: L.

- **[chat-capture] A capture cannot be reopened after confirmation** — confirmation is
  terminal for the chat session. A lead who notices an error a day later can correct
  sections through the understanding API, but cannot resume the conversation that produced
  them. Whether that is a limitation or the intended boundary is a product decision.
  Evidence: `apps/server/src/routes/chat-captures.ts`. Size: L (product decision first).

- **[chat-capture] No backend lock on the chat session** — concurrent turns are prevented
  in the UI, not in the server. Two browser tabs on the same capture are an unguarded case.
  Single-user prototype, so the risk is low and the fix is small. Evidence:
  `apps/server/src/chat-capture-service.ts`. Size: S.

## ui-system

- **[ui-system] The client bundle is over Vite's warning threshold** — ~1,310 kB
  (≈400 kB gzip) in one chunk, with no route-level code splitting, so every visitor
  downloads the flow-graph renderer, the diff viewer, and the table library before seeing
  the login card. `React.lazy` on the four heavy routes (`/dokumentation`,
  `/processes/:id/chat`, the two opportunity routes) is the obvious first cut. Evidence:
  Vite build output; `apps/web/src/App.tsx`. Size: M.

## docs

- **[docs] `AGENTS.md` mixes English rules with German paragraphs** — lines 35–36 and
  42–66 switch language mid-section, in the one file every agent reads first. Pick one
  language for the instruction file; the repo convention of German UI copy, German
  commit messages, and German reader-facing artefacts is unaffected either way. Evidence:
  `AGENTS.md:35`, `:42`. Size: S.

- **[docs] The Pi deployment runbook has not been re-verified against the build script** —
  `docs/operations/PI-DEPLOYMENT.md` is a live runbook and its commands were not checked
  against the current `scripts/build-release.ts` during this audit. Verify before the next
  deployment. Evidence: `docs/operations/PI-DEPLOYMENT.md`, `scripts/build-release.ts`.
  Size: S.
