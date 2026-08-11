# Archive

These four documents are **superseded** by [`../domain/`](../domain/README.md), which
describes what the prototype actually does today and whether each feature is built. Start
there.

They are kept because `AGENTS.md` binds their **domain states and acceptance criteria**,
and the long form carries detail a distilled description would lose. Preserve those states
and criteria unless the product decision explicitly changes them.

| Document                              | Superseded by                                                                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `PRODUCT-FLOW-KI-POTENTIAL.md`        | [`../domain/README.md`](../domain/README.md), [`process-capture.md`](../domain/process-capture.md), [`ai-runtime.md`](../domain/ai-runtime.md) |
| `PLAN-KI-POTENTIAL-SCENARIOS.md`      | [`../domain/opportunity-discovery.md`](../domain/opportunity-discovery.md)                                                                     |
| `DISCOVERY-KI-POTENTIAL-SCENARIOS.md` | [`../domain/opportunity-discovery.md`](../domain/opportunity-discovery.md)                                                                     |
| `PLAN-LEBENDE-PROZESSDOKU.md`         | [`../domain/process-documentation.md`](../domain/process-documentation.md)                                                                     |

Two caveats when reading them:

- They are **plans**, written before the code. Where a plan and the code disagree, the code
  is authoritative and the difference belongs in [`../BACKLOG.md`](../BACKLOG.md).
- Their internal links may point at files retired during the 2026-08-12 documentation
  cleanup — implementation plans, research reports, and finished wayfinder maps. Those
  files remain in git history; nothing was lost, and the paths were deliberately left
  untouched here rather than rewritten inside archived documents.
