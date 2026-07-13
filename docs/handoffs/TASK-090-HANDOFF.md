# TASK-090 Handoff

- Branch: `codex/task-090-read-only-runtime-request-execution-facade`
- Base commit: `ff949beb88677d1542a0274fd4c03c2ae6f0c706`
- Commit hash: `PENDING_COMMIT_HASH`

## Changed Files

- `packages/engine-contracts/src/runtime-host/runtime-readonly-request-execution-facade.ts`
- `packages/engine-contracts/src/index.ts`
- `tests/runtime-readonly-request-execution-facade.test.ts`
- `docs/tasks/done/TASK-089-public-readonly-runtime-smoke-scenario.md`
- `docs/tasks/review/TASK-090-read-only-runtime-request-execution-facade.md`
- `docs/status/CURRENT_STATE.md`

## New Production Files

- `packages/engine-contracts/src/runtime-host/runtime-readonly-request-execution-facade.ts`

## New Test Files

- `tests/runtime-readonly-request-execution-facade.test.ts`

## Updated Docs

- `docs/tasks/done/TASK-089-public-readonly-runtime-smoke-scenario.md`
- `docs/tasks/review/TASK-090-read-only-runtime-request-execution-facade.md`
- `docs/status/CURRENT_STATE.md`

## Validation Results

- `corepack pnpm test -- tests/runtime-readonly-request-execution-facade.test.ts` - passed, 1 test file / 8 tests.
- `corepack pnpm test -- tests/runtime-readonly-smoke-scenario.test.ts` - passed, 1 test file / 7 tests.
- `corepack pnpm test -- tests/runtime-readonly-command-execution-facade.test.ts` - passed, 1 test file / 8 tests.
- `corepack pnpm test -- tests/runtime-inventory-command-executor-boundary.test.ts` - passed, 1 test file / 8 tests.
- `corepack pnpm test -- tests/runtime-look-command-executor-boundary.test.ts` - passed, 1 test file / 7 tests.
- `corepack pnpm test -- tests/runtime-command-planning-boundary.test.ts` - passed, 1 test file / 7 tests.
- `corepack pnpm test -- tests/runtime-command-request-boundary.test.ts` - passed, 1 test file / 6 tests.
- `corepack pnpm test -- tests/runtime-player-state-contract.test.ts` - passed, 1 test file / 5 tests.
- `corepack pnpm test -- tests/content-read-model-boundary.test.ts` - passed, 1 test file / 5 tests.
- `corepack pnpm test -- tests/content-package-loader-boundary.test.ts` - passed, 1 test file / 6 tests.
- `corepack pnpm test -- tests/content-package-contracts.test.ts` - passed, 1 test file / 6 tests.
- `corepack pnpm test` - passed, 67 test files / 651 tests.
- `corepack pnpm lint` - passed.
- `corepack pnpm typecheck` - passed.
- `corepack pnpm build` - passed.
- `corepack pnpm validate` - passed.
- `git diff --check` - passed with line-ending normalization warning only for `docs/status/CURRENT_STATE.md`; no whitespace errors.

## Known Warnings

- Local Node version is `v24.16.0` while the repository engine expects Node 22. This remained non-blocking because all required validations passed.

## Scope Boundary Verdict

- PASS. The new facade remains read-only, supports only `look` and `inventory`, and does not add any mutable command execution, gameplay mutation, next-state generation, storage behavior, UI/editor work, replay runtime, DB/external storage, or TASK-091.

## Request Facade Behavior Summary

- `executeRuntimeReadonlyRequest` accepts a `RuntimeCommandRequest`, validated content input or read model, and validated runtime player state.
- It returns a deterministic JSON-safe result envelope containing the original request snapshot, internal plan snapshot, wrapped read-only execution view when available, diagnostics, and identical initial/final player state snapshots.
- Unsupported mutable-style commands return deterministic `rejected` results.
- Supported commands that cannot be planned or executed in the current read-only context return deterministic `blocked` results.

## Planning Delegation Summary

- The facade reuses TASK-084 request/content validation and TASK-083 player-state validation through the new input inspection helper.
- It creates plans exclusively through `createRuntimeCommandPlan` and surfaces the resulting `planned`, `blocked`, or `rejected` plan state in the result envelope.
- Planning is still non-mutating and no command execution logic is embedded in the planning step.

## Read-only Execution Delegation Summary

- The facade delegates execution exclusively through `executeRuntimeReadonlyCommand` from TASK-088.
- It does not call the look or inventory executors directly and does not reimplement their read-only behavior.
- Delegated diagnostics are preserved deterministically in blocked execution cases such as unresolved location or unresolved inventory item state.

## Supported / Unsupported Command Summary

- Successfully executable through this facade: `look`, `inventory`.
- Rejected as unsupported by the read-only request facade: `go`, `talk`, `take`, `use`, `save`, `load`, and any other command outside the accepted read-only set.

## No-mutation Evidence

- Tests compare canonical JSON snapshots of the request and player state before and after execution.
- Successful `look` and `inventory` results preserve identical `initialPlayerState` and `finalPlayerState` snapshots.
- Blocked and rejected cases also return without mutating request, player state, or content input/read model data.

## No-next-state Evidence

- Result assertions verify that the request facade does not expose `nextState`, `statePatch`, `events`, `runtimeDomainEventValues`, `transaction`, `saveResult`, or `loadResult`.
- No state transition, gameplay mutation, or storage side effect API was introduced.

## Confirmations

- Only `look` and `inventory` are executable through the TASK-090 request facade.
- No gameplay mutation was implemented.
- No next-state generation was implemented.
- TASK-091 was not created.
