# Product-video end-to-end readiness

- Status: In progress
- Type: Verification and repair
- Blocked by: Real-provider usage pause

## Goal

Run the German insurance prototype from login through process capture, process
confirmation, PDD export, opportunity discovery, agentic assessment, and its
Excel export. Preserve screenshots and a video suitable for reviewing the
prototype before the final presentation.

## Issue log

### E2E-001: Current Mac lacked Playwright runtime

- Evidence: the repository had no Playwright dependency, browser binary, config,
  or local isolated runner.
- Fix: install `@playwright/test` and Chromium; add `playwright.config.ts`, the
  isolated `scripts/run-local-e2e.ts` runner, and the real-flow specification.
- Verification: `bunx playwright test --list` discovers one product-flow test.

### E2E-002: Desktop confirmation label differed from the test

- Evidence: the desktop tracker renders `Bestätigen`; the test searched only for
  `Prozessbild bestätigen`.
- Fix: match both accessible labels.
- Verification: the corrected locator reached the next real-provider attempt.

### E2E-003: Global disconnected MCP servers polluted Claude startup

- Evidence: the first local run logged unrelated global MCP connection warnings.
- Fix: run chat capture with an empty settings source and strict MCP config so
  only the process-verification server is available.
- Verification: the warning disappeared in the following run.

### E2E-004: Opus 5 exhausted the document-analysis turn limit

- Evidence: the server returned `Reached maximum number of turns (12)` while
  processing the three selected scenario documents. One prior run completed in
  48 seconds, so the failure is workload-dependent rather than a browser timeout.
- Fix: raise the bounded provider turn ceiling from 12 to 20. The existing
  five-minute timeout and one-dollar operation budget remain unchanged.
- Verification pending: provider-free contract tests first; one real run after
  the usage pause is lifted.

### E2E-005: Failed turns left the composer visually locked

- Evidence: after the server persisted `lastTurnOutcome: failed`, the page still
  showed `Unterlagen werden ausgewertet`, a disabled composer, and `Stoppen`.
- Fix: reload the persisted chat view whenever the client stream reaches `ready`
  or `error`, in addition to process-change events.
- Verification pending: UI contract test and browser failure simulation without
  a real provider.

### E2E-006: Screenshot check assumed the wrong confirmed-state label

- Evidence: the confirmed fixture renders `Mit offenen Punkten bestätigt`, not
  the non-existent label `Prozess bestätigt`; the Prozessbild itself was loaded
  and complete in the browser trace.
- Fix: accept the two real domain states, `Abgeschlossen` and
  `Mit offenen Punkten bestätigt`, and independently require the first process
  step before capturing the screenshot.
- Follow-up: the documentation fixture describes this process as `complete`,
  while its PDD fields and per-step actors remain open under the newer profile.
  Align that fixture before calling it presentation-final.
- Fix: the flagship fixture now explicitly supplies step actors and the fixed
  current-state PDD fields; a seed integration assertion requires quality
  `complete` for this process.

### E2E-007: Normal process detail emitted assessment 404s

- Evidence: the clean-browser assertion found two GET 404 responses for
  `/api/opportunities/PROC-0005/agentic-assessment` before any assessment had
  been created.
- Cause: the UI uses absence as a regular domain state, but the read endpoint
  represented it as an HTTP error and both the detail and assessment pages
  requested it normally.
- Fix: return `200` with `{ record: null, isStale: false }`; the API client maps
  that envelope to `null` for both pages.
- Verification: the focused API/type tests pass and the repeated screenshot run
  completed with zero failed requests and zero console errors.

### E2E-008: Successful screenshots contained loading skeletons

- Evidence: visual inspection of the first green screenshot run showed that the
  portfolio table and documentation body were still loading when captured.
- Cause: the test waited only for static page headings, which render before the
  asynchronous data regions.
- Fix: wait for the seeded Leitungswasser process link before the portfolio
  image; select that document and wait for its content heading before the
  documentation image. Expand the process diagram through its real UI control
  before capture so it is legible in presentation review.
- Verification: the repeated run passed; all four PNGs were inspected after
  capture and contain rendered seed content instead of skeletons.

### E2E-009: Playwright specs broke the Bun unit-test gate

- Evidence: `./scripts/qa changed` imported both `e2e/*.spec.ts` files through
  `bun test`, which raised `Playwright Test did not expect test() to be called
here` before the suite could complete.
- Fix: use a dedicated `*.pw.ts` suffix and configure Playwright's `testMatch`;
  the local runner selects those exact files.
- Verification: `./scripts/qa changed` passes, including the full Bun test suite
  and production web build; Playwright lists exactly the two `*.pw.ts` tests.

### E2E-010: Documentation exposed machine artifacts and slug labels

- Evidence: visual inspection showed `Index`, `Katalog.json`, `It`, and
  transliterated process names in the manager-facing tree. The full document
  also ended with raw provenance enum counters and a raw quality enum.
- Fix: filter index and catalogue from the tree API; attach versioned German
  labels from the catalogue to folder and document entries; remove provenance
  counters from renderer version 2 and render confirmation quality in German.
- Verification: 32 focused corpus/UI tests and strict type checking pass. The
  refreshed desktop and tablet screenshots show `IT`, the German process title,
  and no index, catalogue, raw quality, or provenance fields. Both Playwright
  screenshot scenarios completed with zero console errors and zero failed
  requests.

### E2E-011: The first tablet Prozessbild capture clipped the flow

- Evidence: visual inspection showed the first process step above the visible
  canvas and the final steps below it despite a green browser test.
- Fix: use a 1024 × 900 tablet review viewport and invoke the diagram's real
  `Ansicht einpassen` control after switching to the Prozessbild tab.
- Verification: the refreshed tablet image contains the trigger and all six
  numbered process steps in one review frame.

### E2E-012: Tablet progress labels collided beside the process title

- Evidence: visual inspection of the KI-scenario screen at 1024 px showed
  `Potenzialhypothesen` and `KI-Szenarien` touching because the page switched to
  a horizontal title/progress layout too early.
- Fix: keep title and progress stacked until the `xl` desktop breakpoint, in
  line with the assessment page.
- Verification: the refreshed 1024 px screenshot shows three separated labels
  beneath the process title and preserves the three-column scenario comparison.

### E2E-013: A fast route change produced a scrolled screenshot frame

- Evidence: the first tablet assessment image started inside the page title and
  omitted the sticky application header despite the test requesting scroll
  position zero.
- Fix: wait for two animation frames after resetting scroll position before
  every saved screenshot.
- Verification: the refreshed assessment screenshot starts with the global
  header, demo warning, back link and complete process title.

### E2E-014: Presentation seed stopped before downstream review screens

- Evidence: the deterministic documentation seed produced the process, PDD and
  corpus, but no stored KI scenarios or assessment; screenshots of the final
  modules would still require provider usage on every run.
- Fix: seed four Leitungswasser-specific hypotheses, all three oversight
  scenarios and a mixed-confidence 32-criterion assessment through the real
  repositories. The operation trace explicitly identifies deterministic demo
  data and does not impersonate a provider run.
- Verification: the seed integration test requires the completed opportunity,
  `Agentischer Schaden-Arbeitsbegleiter`, four hypotheses, and 15 scored
  criteria. Desktop and tablet browser runs opened both review pages, downloaded
  both XLSX exports, and reported zero console errors or failed requests. The
  exact downloads pass ZIP integrity checks and the focused workbook/API tests.

## Remaining acceptance evidence

- One uninterrupted real Claude run through both Excel downloads.
- No failed browser requests and no console errors during that run.

## Provider-free release evidence

- `./scripts/qa all`: format, lint, strict type checking, full tests and web
  build pass after the downstream seed changes.
- `bun run build:release`: macOS ARM64, Windows x64 and Linux ARM64 artifacts
  build successfully with the checked example operator information.
- Two Playwright screenshot scenarios cover desktop and 1024 px tablet views,
  both Excel downloads, zero failed requests and zero console errors.
