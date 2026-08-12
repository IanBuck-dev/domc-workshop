# UI system

## Purpose

The audience is an insurance department lead, not a developer. Everything about the
interface follows from that: German copy, no technical vocabulary, a calm light-only
surface, and one obvious next action on every screen.

This document records the rules the interface is built on, so a new screen looks like the
existing ones without anyone reverse-engineering the CSS.

## How it works

### Stack

React 19 + Vite + Tailwind v4 + shadcn/ui (new-york), `react-router-dom` 7 in declarative
mode (no Data Router), `lucide-react` icons. Tailwind v4 means configuration lives in
`apps/web/src/styles.css` as `@theme inline` — there is no `tailwind.config.js`.

### The `components/ui/` boundary

`apps/web/src/components/ui/` is reserved for shadcn primitives and stays on **stock
Tailwind utilities**, so `shadcn add` remains a clean upgrade. Application components live
one level up and use the semantic tokens. `--text-ui` and `--text-label` resolve to exactly
what the primitives already use, so the two systems render identically.

Twenty-three primitives are in place, including three non-stock additions:
`marker.tsx`, `message.tsx`, `message-scroller.tsx`.

### Light mode only

No dark theme, no toggle, no `dark:` variants. The palette is a white canvas with a single
brand green.

The **surface contract**, applied consistently:

| Token          | Use                                                          |
| -------------- | ------------------------------------------------------------ |
| `--background` | page canvas only, never an object                            |
| `--card`       | object surfaces; always paired with a border, never a shadow |
| `--muted`      | recessed panel inside an object, and row hover               |
| `--secondary`  | selected / active interactive state                          |
| `--accent`     | hover on an interactive element                              |

Used solid. No ad-hoc `/15 /20 /30` opacity steps — on a white canvas they compute to
near-white and read as nothing.

**Elevation is carried by borders.** Shadows are reserved for true overlays: dialog,
dropdown, popover, select, and the floating operation queue. The login card is the one
deliberate exception, being the only object on an empty canvas.

Contrast is deliberate, not incidental: `--foreground: #141a18` is near-black with just
enough chroma to relate to the brand without tinting the page; `--muted-foreground:
#4d5855` is AAA on white and stays above 4.5:1 on the tinted surfaces it also lands on;
`--input: #8f9b96` is darker than `--border` because WCAG 1.4.11 wants 3:1 for interactive
boundaries. Brand green lives in `--primary` and `--ring` only.

### Typography

Geist Variable (OFL-1.1), chosen over Open Sans because it is ~5% narrower per character —
which matters for German compounds like "Prozessdokumentation" — and holds up better at UI
sizes. Attribution is on the Impressum page; keep the two in sync if the font changes.

The **semantic type scale** carries size, line-height, weight, and tracking together, so
call sites stop hand-combining `text-*`, `leading-*`, and `font-*`:

`text-display` · `text-title` · `text-heading` · `text-subheading` · `text-body` ·
`text-ui` · `text-label` · `text-caption` · `text-eyebrow` · `text-overline`

Rules: headings step responsively by **pairing** tokens (`text-title sm:text-display`);
never add a size to a token, add a pairing. Eyebrow tracking is part of the token — do not
pair it with a `tracking-[…]` utility. Body is a true 400 weight; when text reads thin the
lever is colour, not weight. `antialiased` is deliberately **not** applied, because
grayscale anti-aliasing thins every stroke on macOS — strip it if a generated file brings
it in.

### Loading states

The pattern is _skeletons where layout is known, delayed reveal where the wait is usually
invisible_. `AppBootScreen` fades in only after 200 ms, so a fast session check shows
nothing at all rather than a flash that reads as a fault. Eighteen components and pages use
`Skeleton`; `Spinner` is reserved for in-place action feedback.

### Print

`@page { margin: 15mm 8mm }` sits outside `@media print` and outside every `@layer`, as
the single unlayered declaration, so nothing competes with it for precedence. The print
dialog's own margin setting overrides it — only "Standard" honours these values.

`@media print` strips the page background gradient, hides `[data-print-hide]`, removes the
screen-only padding and 1280 px cap, avoids breaks after headings, and keeps list items
whole. There is no table rule, because the viewer cannot render tables.

### Language and vocabulary

German UI copy throughout, addressed to a department lead. Never shown in the interface:
raw JSON, terminal commands, prompt text, stack traces, model or provider terminology, or
Git vocabulary (the documentation viewer says _Änderungsverlauf_, _Fassung_, _Rücknahme_).

### Testing

UI is tested as rendered HTML: `bun:test` + `createElement` + `renderToStaticMarkup`,
asserting on the output string. Roughly a third of the 41 test files are UI tests.

## Where it lives

| Layer           | Path                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Tokens and base | `apps/web/src/styles.css`                                                                                                       |
| Primitives      | `apps/web/src/components/ui/` (23 files)                                                                                        |
| Shell           | `apps/web/src/components/app-shell.tsx`, `app-boot-screen.tsx`, `brand-mark.tsx`, `public-page-layout.tsx`, `public-footer.tsx` |
| Pages           | `apps/web/src/pages/` (12 files)                                                                                                |
| Tests           | `tests/*-ui.test.ts`, `brand-mark.test.ts`                                                                                      |

## Implementation status

**Implemented.** The token layer, the surface contract, the semantic type scale, the
primitives boundary, light-mode-only palette with documented contrast decisions, the
delayed boot screen and skeleton loading states, and the print stylesheet.

Two known gaps are recorded in [`../BACKLOG.md`](../BACKLOG.md): the client bundle is
~1,310 kB (≈400 kB gzip), over Vite's 500 kB warning threshold, with no route-level code
splitting; and `apps/web/src/components/corpus-document.tsx:63` carries table CSS plus
`td`/`th` entries in the `highlightable` list that can never apply, because
`react-markdown` runs without `remark-gfm`.

## Constraints

- Light mode only. No dark theme, no `dark:` variants.
- `components/ui/` stays on stock Tailwind; application components use the semantic tokens.
- Elevation via borders; shadows only for true overlays.
- Extend the type scale by pairing tokens, never by adding sizes.
- German UI copy; no JSON, commands, prompt text, stack traces, model terms, or Git
  vocabulary in the interface.
- One obvious next action per screen.

## Open items

See [`../BACKLOG.md`](../BACKLOG.md).
