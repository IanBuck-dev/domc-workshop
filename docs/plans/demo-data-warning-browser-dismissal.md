# Demo-Data Warning Browser Dismissal

## Goal

Remember dismissal of the global “Nur Demo-Daten verwenden.” callout in the
current browser so the user does not need to close it again on later visits.

## Locked Behavior

- Store the dismissed state under the versioned, origin-scoped
  `localStorage` key `claims-ai.demo-data-warning.dismissed.v1` with the value
  `"1"`.
- Do not include the server `instanceId` in the key. Dismissal persists across
  page reloads, tabs, sign-outs, browser restarts, and server restarts for the
  same browser profile and application origin.
- A different browser profile, private browsing context, or application origin
  has its own state. Clearing the application's site data makes the callout
  visible again.
- Read the preference before the component's first committed render so a
  previously dismissed callout does not flash while `/api/health` loads.
- Closing the callout hides it immediately. If browser storage is unavailable
  or throws, keep the current-page dismissal but show the callout again on a
  future page load; the warning must not crash the application.
- Keep the callout global in `AppShell`, retain its existing warning copy and
  styling, and change the close button's accessible label from a session-only
  promise to “Hinweis dauerhaft in diesem Browser ausblenden”.
- Do not migrate or read the old `sessionStorage` entries because their keys
  contain ephemeral server instance IDs and cannot represent the new browser
  preference reliably.
- Document the dismissal preference in the existing privacy section for local
  browser storage. No cookie, backend, process data, audit record, or API
  contract changes are required.

## Files To Change

- `apps/web/src/lib/demo-data-warning-preference.ts`
  - Add the stable storage key and small read/write functions.
  - Accept an injectable `Storage`-compatible dependency for deterministic
    tests, defaulting to browser `localStorage` in production.
  - Catch storage access failures; reads return `false`, and writes do not
    throw.
- `apps/web/src/components/demo-data-warning.tsx`
  - Replace the `instanceId`, `/api/health` fetch, effect, and `sessionStorage`
    calls with the preference functions.
  - Initialize `dismissed` lazily from the stored preference and persist it
    when the close button is activated.
  - Update the German accessible label to describe browser-wide persistence.
- `apps/web/src/pages/privacy-page.tsx`
  - Extend “Sitzungsdaten und Browser-Speicher” to disclose that dismissal of
    the demo-data warning is stored locally and can be removed by clearing the
    application's site data.
- `tests/demo-data-warning.test.ts`
  - Test absent, matching, and unrelated stored values.
  - Test that dismissal writes exactly `"1"` under the versioned stable key.
  - Test fail-safe behavior when storage reads or writes throw.
  - Add a source contract asserting that the component uses the preference
    helper and no longer depends on `/api/health`, `instanceId`, or
    `sessionStorage`.
  - Assert the browser-persistence accessible label and privacy disclosure.

## Validation

- During implementation, run `./scripts/qa test tests/demo-data-warning.test.ts`
  after focused changes and `./scripts/qa changed` before final verification.
- Before handoff, run `./scripts/qa all` and the required release build with
  `./scripts/qa release`.
- In Chrome DevTools at desktop and tablet widths:
  1. Clear site data and verify the global callout is visible without console
     errors or failed unexpected network requests.
  2. Close the callout and verify it disappears immediately.
  3. Reload, open another tab, sign out and back in, and restart the local
     server; verify the callout remains hidden.
  4. Remove `claims-ai.demo-data-warning.dismissed.v1` from local storage and
     verify the callout returns.
  5. Confirm the close control remains keyboard-accessible and its accessible
     name is “Hinweis dauerhaft in diesem Browser ausblenden”.

## Acceptance Criteria

- A user dismisses the global demo-data warning once per browser profile and
  application origin, not once per tab, login session, or server instance.
- Persisted dismissal does not produce a visible warning flash on reload.
- Storage failures never prevent the application or warning from rendering.
- The warning's content, placement, and demo-data restriction remain unchanged.
- The privacy page accurately describes the stored browser preference.
- Focused tests, the full QA suite, the web build, the release build, and the
  desktop/tablet browser checks pass.
