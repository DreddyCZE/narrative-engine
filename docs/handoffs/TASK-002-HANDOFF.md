# Handoff: TASK-002 Core Contract Inventory

## Task

TASK-002 - core contract inventory

## Summary

Created the M0 contract inventory documents. The work identifies required contracts, ownership,
visibility, stability, versioning expectations, dependencies, migration/security impact, and
whether each contract is needed for M1 or the first vertical slice.

## Files Changed

- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`
- `docs/contracts/CONTRACT_VERSIONING_POLICY.md`
- `docs/tasks/review/TASK-002-core-contract-inventory.md`
- `docs/status/CURRENT_STATE.md`
- `tools/validate.mjs`

## Checks

- `corepack pnpm lint` - passed.
- `corepack pnpm typecheck` - passed.
- `corepack pnpm test` - passed.
- `corepack pnpm build` - passed.
- `corepack pnpm validate` - passed after fixing validation handling for deleted tracked files.

## Final Review

- Required contracts and inventory fields were verified.
- Dependency graph cycle check passed.
- Versioning policy was updated to include Plugin API Version.
- No new ADR is required.
- TASK-002 was moved to DONE.

## Decisions

- No new ADR is required for the inventory itself.
- TASK-002 only inventories and elaborates boundaries already defined in `PROJECT_CHARTER.md`,
  `docs/spec/MASTER_SPEC.md`, and ADR-0001.
- M1 minimum draft order remains: Entity Identity, Schema Versioning, Engine State, Condition,
  Effect, Command, Transaction, Domain Event, Validation Diagnostic.
- Save, Scheduler, Plugin, Script Extension, Asset, Theme, and Editor workflow contracts are
  identified but deferred outside the M1 minimum.
- Contract fixtures are required by policy but must be created by later tasks together with concrete
  contract drafts.
- TASK-003 should add only basic automatically verifiable boundary checks; deeper domain checks must
  grow with real packages and contracts.

## Known Limits

- No final schemas were created.
- No engine systems were implemented.
- Contract fixture design is policy-only and needs later task work.
- Architecture boundary checks remain a later TASK-003 concern.

## Recommended Next Task

TASK-003 - CI and architecture boundary skeleton.
