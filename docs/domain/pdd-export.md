# PDD Excel export

## Purpose

`PDD-Arbeitsmappe` is a deterministic, read-only `.xlsx` artifact for one human-confirmed
Process Understanding. It never changes the canonical capture and it is never imported
back. Each download action creates one immutable file below that process's `exports/`
directory and appends `pdd-exported` to its process audit history.

## Gate and source revision

The export is available only for a confirmed profile-3 Process Record with a Process
Understanding, `currentStateDetails`, and `confirmedAt`. Confirmations with explicit
open points remain exportable and show the warning state in the UI. Older confirmed
records remain readable but the UI does not offer an export for them.

`pddSourceRevision` hashes the cover, confirmation metadata, work characteristics,
canonical understanding, and current-state details with sorted object keys. The revision
appears in the workbook, filename metadata, response header, and audit detail.

## Workbook contract

`defaults/pdd-export-config.json` is the versioned mapping contract for the sanitized
`defaults/pdd/PDD_Draft.current-state.v1.xlsx` asset. The workbook retains all 17
template sheets. This phase populates only `Deckblatt`, `01_Prozessdefinition`, and
`02_Prozessschritte`; sheets 4–17 remain byte-identical to the sanitized asset. Unknown
values display as `Nicht bekannt`, and future-state fields on the first three sheets
display the explicit current-state scope notice.

`packages/domain/src/pdd-export.ts` validates coverage and maps confirmed canonical facts
without an export-time AI call. `packages/storage/src/pdd-workbook.ts` copies the
sanitized OOXML package and updates only configured cells using escaped inline strings.
It verifies the template hash, preserves cell styles, rejects active/external content,
compares non-target entries, and reopens the result before storage returns it.

## API and UI

`POST /api/processes/:id/pdd-export` returns a private, no-store XLSX attachment and
the `X-PDD-Source-Revision` header. Unknown processes return `404`; records that do not
meet the confirmation gate return `409` with manager-facing German copy. The process
detail page provides the PDD-Export card and downloads the returned binary once. The
audit entry includes template/mapping revision, output hash, timestamps, and initiating
authenticated user.
