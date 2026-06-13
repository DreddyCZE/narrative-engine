# TASK-006 Handoff

## Summary

TASK-006 defines the draft `Engine State Contract` and the supporting schema, fixtures, and tests
for the M1 state boundary. The task is now in `REVIEW` and the repository has no ACTIVE task.

## Main Decisions

- Engine State is the authoritative runtime state for a run plus optional cross-run meta state.
- The root snapshot uses a dedicated `stateId`; it is not an Entity Identity ID.
- `revision` starts at `0` and increments by exactly `1` on successful commit.
- Runtime state is JSON-safe only; functions, promises, DOM objects, and other executable values are
  forbidden.
- State domains are versioned, owned, and persisted independently inside the root snapshot.
- UI, editor, and plugins are not authorities for direct state mutation.
- Canonical snapshots are deterministic, with stable key order and stable domain ordering.

## State Taxonomy

- `run`: active playthrough state.
- `meta`: optional cross-run state.
- `session`: excluded from Engine State and handled by client/editor session models.
- `derived`: non-authoritative values that may be rebuilt.

## Root Envelope

- `contractVersion`: `engine-state@0.1.0`
- `schemaId`: `engine-state`
- `schemaVersion`: integer `>= 1`
- `stateId`: `state.<scope>.<name>`
- `revision`: non-negative integer
- `run.domains`: authoritative run domains
- `meta.domains`: optional cross-run domains
- `engineVersion` and `gameVersion`: future Save Envelope or external compatibility metadata, not
  Engine State
- `seed`: included only when needed for deterministic replay
- `activeModules`: included only for the active run set; installed modules remain a manifest/save
  concern

## Domain Model

- `domainId`: `state-domain.<scope>.<name>`
- `schemaId`: domain schema identifier
- `schemaVersion`: positive integer
- `owner`: stable owner token, such as `engine`, `game`, or `module.world`
- `authority`: `engine`, `module`, or `game`
- `persistence`: `transient`, `run`, `meta`, `snapshot-only`, or `reconstructable`
- `data`: JSON object validated by the domain schema

## Revision / Reference Policy

- Revision changes only after a successful commit.
- Aliases are resolved at the boundary; canonical snapshots store canonical Entity Identity IDs.
- Dangling references are semantic validation errors.
- Session-only values and derived caches do not belong to canonical Engine State.

## Canonical Serialization

- UTF-8 JSON with LF line endings in fixtures.
- Two-space indentation and final newline.
- Stable top-level order:
  - `contractVersion`
  - `schemaId`
  - `schemaVersion`
  - `stateId`
  - `revision`
  - `requiredDomains` when present
  - `run`
  - `meta`
- Stable `domains` ordering by `domainId`.
- Stable ordering for set-like arrays such as `activeModules` and `requiredDomains`.

## Fixtures

Valid fixtures:

- 7 total, covering empty state, core domain, game domain, module domain, run/meta state,
  canonical entity reference, and deterministic domain ordering.

Invalid fixtures:

- 11 JSON fixtures plus 1 executable source fixture.
- Cover negative and decimal revisions, invalid schema version, duplicate domain IDs, invalid
  domain IDs, invalid persistence/authority, forbidden object keys, session persistence, and unknown
  fields.

Semantic-invalid fixtures:

- 9 total.
- Cover alias references, dangling references, derived cache authority, duplicate ownership,
  invalid working-to-committed transition, missing required domain, misordered domains, revision
  jumps, and unsupported domain schema versions.

## Tests

- `tests/engine-state-contract.test.ts`
- 11 task-specific tests
- Includes a test-scoped pre-serialization validation helper for function, Date, Map, Set, NaN,
  Infinity, and cyclic runtime values.
- Total repo test count after this task: 48

## Changes Made

- Added `docs/contracts/ENGINE_STATE_CONTRACT.md`
- Added `schemas/engine-state.schema.json`
- Added `tests/engine-state-contract.test.ts`
- Added fixtures under `tests/fixtures/contracts/engine-state/`
- Updated `docs/contracts/CONTRACT_INVENTORY.md`
- Moved TASK-006 from active to done
- Updated `docs/status/CURRENT_STATE.md`

## Compatibility and Migration Impact

- This task defines the Engine State boundary only.
- It does not implement a State Store, command pipeline, transaction engine, or save system.
- Future incompatible state changes must follow the contract versioning policy and the Engine State
  contract itself.

## Security Impact

- Prevents direct runtime mutation from UI, editor, or plugins.
- Rejects non-JSON-safe runtime state values.
- Rejects forbidden object keys that could cause prototype pollution.
- Treats canonical entity references as canonical IDs, not aliases.

## Known Limits

- JSON Schema validates the local envelope and domain descriptor shape only.
- Referential integrity, canonical ordering, revision history, and semantic invariants are enforced
  by test-scoped validation helpers, not by a runtime State Store.
- Pre-serialization runtime-value validation is test-scoped and not a production serializer.
- The task intentionally does not define transaction mechanics or save envelope layout.

## Deferred Decisions

- Exact future State Store implementation.
- Concrete command and transaction contract shapes.
- Future permission/capability contract for cross-domain mutation.
- Final production performance budgets.
- Save envelope layout and event trace integration.

## Checks

- `corepack pnpm lint` - passed
- `corepack pnpm typecheck` - passed
- `corepack pnpm test` - passed
- `corepack pnpm build` - passed
- `corepack pnpm check:boundaries` - passed
- `corepack pnpm validate` - passed
- `git diff --check` - passed

## Environment Note

Local execution emitted the expected pnpm engine warning because the workstation is on Node 24,
while the project remains pinned to Node 22. No pin was changed.

## Next Step

TASK-006 is done. The next step is to create the precise Condition Contract task.
