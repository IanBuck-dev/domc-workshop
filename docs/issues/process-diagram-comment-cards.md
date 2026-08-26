# Free-form comment cards in the Prozessbild

- Status: Open
- Type: Feature
- Blocked by: None

## Problem

Users reviewing a Prozessbild cannot place free-form notes directly on the
diagram. Feedback therefore loses its visual context or must be entered as a
process correction before it is ready.

## Desired outcome

A user can create, position, read, edit, resolve, and delete comment cards in
the Prozessbild. Comments remain visually distinct from process steps,
gateways, and confirmed process facts.

## Decisions required

- Whether comments belong to the process, one process revision, or one review
  session.
- Whether comments anchor to canvas coordinates, process elements, or both.
- Which lifecycle is required beyond open and resolved.
- Whether confirmed and historical Prozessbilder remain commentable.
- Which comment mutations require append-only audit entries.
- Whether comments appear in documentation or Excel exports. The safe default
  is exclusion until explicitly specified.

## Constraints

- Comments must not silently change the canonical process definition.
- Stored comment data requires runtime validation and atomic writes.
- The UI must remain accessible on desktop and tablet.
- The feature must preserve the light-mode-only design and German UI language.

## Acceptance boundary

Before implementation, resolve the decisions above and write an approved plan
covering domain schema, persistence, API, diagram interaction, audit history,
tests, and browser verification.
