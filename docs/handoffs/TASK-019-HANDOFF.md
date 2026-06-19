# Handoff: TASK-019 Engine State Shape and Snapshot Validator

## Task

TASK-019 - Engine State Shape and Snapshot Validator

## Status

REVIEW

## Summary

Implemented the production Engine State validator on top of TASK-016 JSON-safe helpers,
TASK-017 Entity Identity validation, and TASK-018 Schema Versioning compatibility helpers. The
validator checks the root snapshot envelope, revision semantics, run/meta domain collections,
canonical domain ordering, and entity identity/reference shape without introducing any condition,
effect, transaction, save, or event pipeline logic.

## Changed Files

- `packages/engine-contracts/src/engine-state/engine-state.ts`
- `packages/engine-contracts/src/index.ts`
- `tests/engine-state-validator.test.ts`
- `docs/tasks/review/TASK-019-engine-state-shape-and-snapshot-validator.md`
- `docs/status/CURRENT_STATE.md`

## API Summary

- `ENGINE_STATE_CONTRACT_VERSION`
- `inspectEngineStateSnapshot(value)`
- `validateEngineStateSnapshot(value)`
- `isEngineStateSnapshot(value)`
- `assertEngineStateSnapshot(value)`
- `formatEngineStateValidationMessage(issues)`
- `EngineStateSnapshot`
- `EngineStateValidationResult`
- `EngineStateIssue`
- `EngineStateIssueCode`
- `EngineStateDomain`
- `EngineStateRun`
- `EngineStateMeta`
- `EngineStateDomainAuthority`
- `EngineStatePersistence`

## Tests

- Valid minimal snapshot coverage.
- Missing root object and forbidden-key coverage.
- Cyclic value and deterministic diagnostics coverage.
- Invalid schema metadata and revision coverage.
- Missing domain collection and invalid entity reference coverage.
- Duplicate entity ID coverage.
- Assertion success/failure coverage.
- Input immutability coverage.

## Validation

- `corepack pnpm lint` - passed.
- `corepack pnpm typecheck` - passed.
- `corepack pnpm test` - passed, 307 tests.
- `corepack pnpm build` - passed.
- `corepack pnpm validate` - passed.
- `git diff --check` - passed.

Local note: the workstation is on Node `v24.16.0`, while the repository expects Node 22. The
warning is environment debt only because all checks passed.

## Boundary Notes

- `packages/engine-contracts` imports `@narrative-engine/core` through the workspace public entry.
- Runtime code does not import docs, tests, or fixtures.
- The validator does not introduce Condition, Effect, Command, Transaction, Domain Event, Save,
  Event Store, UI, editor, plugin, or gameplay behavior.

## Known Non-Blockers

- `TASK-020` is intentionally deferred until TASK-019 is accepted.
- The Node 22 engine pin remains unchanged by design.

## Explicit Non-Goals

- No Condition evaluator.
- No Effect applicator.
- No Command handling.
- No Transaction Manager.
- No Domain Event materializer.
- No Event Store or Save system.
- No persistence.
- No UI/editor.
- No gameplay/P0 content.
- No plugin runtime.

## Next Recommended Task

- `TASK-020 - Validation Diagnostic adapter/core model`

## Active Task

none
