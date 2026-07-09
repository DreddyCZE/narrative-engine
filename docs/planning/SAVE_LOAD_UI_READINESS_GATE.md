# Save/Load UI Readiness Gate

## Status

PASS WITH DEFERRED UI WORK

The current engine-level save/load surface is ready for future UI or editor integration as long as UI work stays on the documented public boundary and treats diagnostics policy results as the recovery contract.

## Approved Public APIs

Future UI or editor work may call only these public `engine-kernel` exports for save/load interactions:

- `saveGame`
- `loadGame`
- `listSaves`
- `inspectSaveGameResult`
- `inspectLoadGameResult`
- `inspectListSavesResult`
- `inspectManifestSnapshotMismatch`

The existing public scenario fixture in `tests/fixtures/save-load/public-save-load-scenario.ts` is the reference flow for future UI usage patterns.

## Required Result States

Any future UI or editor work must handle these engine-level states:

- successful save
- successful load
- successful list
- empty save list
- missing save
- manifest entry pointing to a missing snapshot
- invalid input
- adapter or storage error

The current public API already returns stable status families for these cases:

- save: `saved`, `rejected`, `error`
- load: `loaded`, `blocked`, `rejected`, `error`
- list: `loaded`, `rejected`, `error`

## Required Recovery Actions

Any future UI-facing recovery mapping must be derived from diagnostics policy actions only:

- `none`
- `retry`
- `choose-different-slot`
- `rebuild-manifest`
- `discard-corrupt-entry`
- `report-error`

UI may translate these actions into copy or affordances later, but it must not invent alternative recovery classifications at the storage layer.

## Boundary Rules

Future UI or editor save/load work must follow these rules:

- UI must use the public save/load facade APIs.
- UI must not call storage adapter internals directly.
- UI must not inspect the file system directly.
- UI must not assume file storage.
- UI must not mutate manifest or snapshot storage directly.
- UI must treat diagnostics policy as the source for recovery classification.
- UI must not parse low-level diagnostic codes directly unless an ADR or follow-up task documents that dependency explicitly.

## Deferred Items

The following remain intentionally out of scope after this gate:

- no actual UI save/load menu
- no save slot rename
- no save delete
- no autosave
- no import/export
- no browser localStorage adapter
- no cloud or external storage
- no DB adapter
- no replay runtime recovery
- no gameplay or P0 content integration

## Readiness Verdict

The engine boundary is ready for future UI or editor integration because:

- the save/load facade is public and deterministic
- diagnostics policy provides stable recovery actions
- a public scenario fixture demonstrates the full happy path and recovery-path usage
- file storage remains behind the adapter boundary with behavioral-only tests

Future UI work must remain a consumer of this surface, not a bypass around it.
