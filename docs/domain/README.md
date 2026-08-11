# Domain documentation

This folder describes what the prototype **does**, feature by feature, and whether each
feature is actually built. It is written in English and kept in sync with the code — when
a document and the code disagree, the code wins and the difference belongs in
[`../BACKLOG.md`](../BACKLOG.md).

The user interface itself is German throughout, for an insurance manager rather than a
developer. German terms are kept in these documents wherever they are identifiers in the
code or labels on screen.

## What the prototype is

A local, single-tenant workshop tool ("Zukunftswerkstatt") for LifeCorp Versicherung, a
fictional insurer. A department lead describes how one of their processes works today;
the tool turns that description into a structured, evidence-backed **process
understanding** that the lead confirms. Confirmed processes then feed two downstream
outputs: **AI-potential hypotheses with human-oversight scenarios**, and a **living
process documentation corpus**.

The product boundary is deliberate and enforced in `AGENTS.md`: no solution assessment,
no financial values, no scoring, no prioritisation, no handover, no project management.

## The flow

```
                        ┌── chat capture ──┐
  /processes/new ──────►│                  ├──► process understanding ──► CONFIRM
                        └── form capture ──┘         (evidence,              │
                                                      provenance,            │
                                                      confidence)            │
                                                                             │
                        ┌────────────────────────────────────────────────────┤
                        │                                                    │
                        ▼                                                    ▼
              memory distillation                              documentation sync
              (the agent brain)                                (living corpus)
                        │                                                    │
                        ▼                                                    ▼
              workspace/memory/                                    workspace/docs/
                        │                                       (app-managed git repo)
                        └──────────────► feeds later captures            │
                                                                          ▼
                                                                   /dokumentation

  CONFIRM also unlocks: opportunity discovery
      hypotheses ──► (if supported) ──► three oversight scenarios
```

## Documents

| Document | Feature |
| --- | --- |
| [process-capture.md](process-capture.md) | Intake: the five topics, the mandatory work characteristics, iterative validation, uploads, the process list |
| [chat-capture.md](chat-capture.md) | Conversational intake and the one resumable Claude session |
| [process-understanding.md](process-understanding.md) | The canonical understanding, provenance, editing, and confirmation |
| [process-diagram.md](process-diagram.md) | The typed process flow graph (Prozessbild) |
| [opportunity-discovery.md](opportunity-discovery.md) | AI-potential hypotheses and the three human-oversight scenarios |
| [agent-memory.md](agent-memory.md) | The agent brain: one company-wide memory that grows with every confirmation |
| [process-documentation.md](process-documentation.md) | The living documentation corpus and its viewer |
| [ai-runtime.md](ai-runtime.md) | How Claude is called: bounded operations, versioned prompts, validation, sandbox, progress events |
| [demo-data.md](demo-data.md) | The LifeCorp fixtures and the two seed scripts |
| [access-and-public-pages.md](access-and-public-pages.md) | Login gate, session, demo-data warning, public pages |
| [ui-system.md](ui-system.md) | Light-mode palette, surface contract, type scale, loading states |

## Architecture

Six layers, in dependency order. Domain logic never imports React or the Claude adapter.

| Layer | Path | Responsibility |
| --- | --- | --- |
| Domain | `packages/domain/src` | Zod schemas and pure rules — the single definition of every structure the system stores or receives |
| Corpus renderer | `packages/corpus/src` | Deterministic process → Markdown rendering; pure, no I/O |
| Storage | `packages/storage/src` | Repositories over `workspace/`, atomic writes, append-only audit, the embedded git repo |
| Claude adapter | `packages/claude/src` | Prompt and schema loading, one bounded call per operation, response validation, sandbox |
| Server | `apps/server/src` | Hono API, services, operation queue, server-sent events |
| Web | `apps/web/src` | React 19 + Vite UI |

Two directories carry configuration rather than code:

- `defaults/` — versioned prompts (`defaults/prompts/*.md`), JSON response schemas
  (`defaults/ai-schemas/*.json`), and product configuration
  (`defaults/process-capture-config.json`, `defaults/opportunity-discovery-config.json`).
  Workshop policy lives here, not in React components.
- `demo-data/` — the fictional LifeCorp scenarios used for seeding and tuning.

Runtime data lives in `workspace/` and is never committed.

## Where the decisions are recorded

- [`../decisions/`](../decisions/) — architecture decision records for choices with
  lasting consequences.
- [`../archive/`](../archive/) — the superseded implementation plans. They are kept
  because `AGENTS.md` binds their domain states and acceptance criteria; they are not
  maintained and may describe behaviour that has since changed.
- [`../operations/`](../operations/) — the German operator guide, the Raspberry Pi
  deployment runbook, and the data-protection notice.
