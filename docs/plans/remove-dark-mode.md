# Remove Dark Mode

## Scope

Remove all executable dark-mode configuration and Tailwind dark variants from the light-only web application without changing light-mode styling, package versions, or unrelated files.

## Files To Change

- `apps/web/src/styles.css`
  - Delete only `@custom-variant dark (&:is(.dark *));`.
  - Preserve all other content, including the concurrently edited `:root` palette and body gradient, byte-for-byte.
- `apps/web/src/components/ui/button.tsx`
  - Remove all of its `dark:` utility tokens and normalize only whitespace created by those deletions; the plan-time inventory is seven tokens.
- `apps/web/src/components/ui/select.tsx`
  - Remove all of its `dark:` utility tokens and normalize only whitespace created by those deletions; the plan-time inventory is three tokens.
- `apps/web/src/components/ui/checkbox.tsx`
  - Remove all of its `dark:` utility tokens and normalize only whitespace created by those deletions; the plan-time inventory is three tokens.
- `apps/web/src/components/ui/badge.tsx`
  - Remove all of its `dark:` utility tokens and normalize only whitespace created by those deletions; the plan-time inventory is three tokens.
- `apps/web/src/components/ui/textarea.tsx`
  - Remove all of its `dark:` utility tokens and normalize only whitespace created by those deletions; the plan-time inventory is two tokens.
- `apps/web/src/components/ui/input.tsx`
  - Remove all of its `dark:` utility tokens and normalize only whitespace created by those deletions; the plan-time inventory is two tokens.
- `apps/web/src/components/ui/dropdown-menu.tsx`
  - Remove all of its `dark:` utility tokens and normalize only whitespace created by those deletions; the plan-time inventory is one token.

No dependency, `components.json`, or `apps/web/index.html` change is required because the inventory found no dark-mode dependency, dark configuration key, color-scheme declaration, provider, hook, or toggle. The existing `theme-color` meta tag is a browser chrome color and remains unchanged.

## Implementation

1. Delete every whitespace-delimited `dark:` utility token from the seven component class strings; the plan-time inventory is 21 tokens.
2. Delete the CSS custom variant line after no `dark:` utility remains, preventing Tailwind's built-in media-query variant from becoming active during the edit sequence.
3. Review the resulting diff to ensure every retained light-mode class is unchanged and no unrelated file is modified.

## Acceptance Criteria

- There are zero `dark:` variants in TypeScript, TSX, or CSS under `apps`, `packages`, and `tests`, excluding dependency and build-output directories.
- There are zero matches for `darkmode`, `prefers-color-scheme`, `next-themes`, `usetheme`, or `custom-variant dark` under `apps`, `packages`, and `tests`, excluding dependency and build-output directories.
- Repository-wide source/config searches find no `.dark` theme selector, `darkMode`, `ThemeProvider`, `color-scheme`, `matchMedia`-based dark preference handling, class-list dark toggling, theme-toggle UI, or dark configuration key.
- `components.json`, `apps/web/index.html`, `package.json`, lockfiles, `AGENTS.md`, `CLAUDE.md`, and `dist/` are unchanged by this work.
- `./scripts/qa changed` passes.
- `bun run build` passes and confirms the web application still builds.

## Validation Commands

```sh
grep -rn 'dark:' apps packages tests --include='*.ts' --include='*.tsx' --include='*.css' --exclude-dir=node_modules --exclude-dir=dist
grep -rni 'darkmode\|prefers-color-scheme\|next-themes\|usetheme\|custom-variant dark' apps packages tests --exclude-dir=node_modules --exclude-dir=dist
rg -n -i --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!**/dist/**' --glob '!.git/**' -e '\.dark([^[:alnum:]_-]|$)' -e 'darkMode' -e 'ThemeProvider' -e 'color-scheme' -e 'theme-toggle' -e 'theme toggle' -e 'next-themes' -e 'matchMedia.*dark' -e 'classList.*dark' .
./scripts/qa changed
bun run build
```
