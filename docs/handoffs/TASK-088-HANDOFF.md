# TASK-088 Handoff

- Branch: `codex/task-088-read-only-runtime-command-execution-facade`
- Base commit: `6d9c5668042357171858dbf12816606fe2dfa94a`
- Commit hash: `de723470112e53db3216acf292d0d19c25c5698d`
- Scope boundary verdict: PASS. TASK-088 adds only a read-only command execution facade over the accepted `look` and `inventory` executors and does not introduce generic mutable execution, gameplay mutation, next-state generation, UI/editor, replay runtime, DB/external storage, or TASK-089.

## Changed Files

- `docs/handoffs/TASK-088-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-087-read-only-inventory-command-executor-boundary.md`
- `docs/tasks/review/TASK-088-read-only-runtime-command-execution-facade.md`
- `packages/engine-contracts/src/index.ts`
- `packages/engine-contracts/src/runtime-host/runtime-readonly-command-execution-facade.ts`
- `tests/runtime-readonly-command-execution-facade.test.ts`

## New Production Files

- `packages/engine-contracts/src/runtime-host/runtime-readonly-command-execution-facade.ts`

## New Test Files

- `tests/runtime-readonly-command-execution-facade.test.ts`

## Updated Docs

- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-087-read-only-inventory-command-executor-boundary.md`
- `docs/tasks/review/TASK-088-read-only-runtime-command-execution-facade.md`

## Facade Behavior Summary

- Added deterministic `executed`, `rejected`, and `blocked` statuses for a narrow read-only runtime command execution facade.
- Added a single stable entry point, `executeRuntimeReadonlyCommand`, for currently accepted read-only runtime commands.
- The facade returns a wrapped JSON-safe view envelope instead of exposing raw executor views directly.
- The wrapped view is a stable union:
  - `{ kind: "look", look: RuntimeLookCommandView }`
  - `{ kind: "inventory", inventory: RuntimeInventoryCommandView }`

## Delegation Behavior Summary

- `look` plans delegate to `executeRuntimeLookCommand`.
- `inventory` plans delegate to `executeRuntimeInventoryCommand`.
- The facade does not reimplement look or inventory execution logic.
- For delegated blocked results, the facade preserves delegated diagnostics without mutation.

## Supported / Unsupported Commands

- Supported through the facade:
  - `look`
  - `inventory`
- Rejected by the facade:
  - `go`
  - `talk`
  - `take`
  - `use`
  - `save`
  - `load`
  - any other command id

## Delegated Diagnostic Behavior Summary

- Facade-level input and plan-shape diagnostics use the facade contract owner and deterministic paths.
- Unsupported command diagnostics are emitted by the facade with code `RUNTIME_READONLY_COMMAND_EXECUTOR_COMMAND_UNSUPPORTED`.
- Non-planned supported commands are blocked by the facade with code `RUNTIME_READONLY_COMMAND_EXECUTOR_PLAN_NOT_EXECUTABLE`.
- When a delegated executor blocks, executor diagnostics are preserved as returned by the delegated boundary.

## Validation Results

- `corepack pnpm test -- tests/runtime-readonly-command-execution-facade.test.ts` - passed
- `corepack pnpm test -- tests/runtime-inventory-command-executor-boundary.test.ts` - passed
- `corepack pnpm test -- tests/runtime-look-command-executor-boundary.test.ts` - passed
- `corepack pnpm test -- tests/runtime-command-planning-boundary.test.ts` - passed
- `corepack pnpm test -- tests/runtime-command-request-boundary.test.ts` - passed
- `corepack pnpm test -- tests/runtime-player-state-contract.test.ts` - passed
- `corepack pnpm test -- tests/content-read-model-boundary.test.ts` - passed
- `corepack pnpm test -- tests/content-package-loader-boundary.test.ts` - passed
- `corepack pnpm test -- tests/content-package-contracts.test.ts` - passed
- `corepack pnpm test` - passed
- `corepack pnpm lint` - passed
- `corepack pnpm typecheck` - passed
- `corepack pnpm build` - passed
- `corepack pnpm validate` - passed
- `git diff --check` - passed

## Known Warnings

- Local Node version is `v24.16.0` while the repository expects Node 22. All required validations passed despite the engine warning.

## Explicit Confirmations

- Only `look` and `inventory` are executable through this facade.
- No gameplay mutation was implemented.
- No next-state generation was implemented.
- No generic mutable command executor was introduced.
- TASK-089 was not created.
