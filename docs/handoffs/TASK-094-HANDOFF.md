# TASK-094 Handoff

- Branch: `codex/task-094-ui-neutral-readonly-input-request-contract`
- Base commit: `332beaf4cb5688715ec7d5e8eb329b7ddfcb37e4`
- Commit hash: `af822ca2f634174625bf4277d7f50ee402ba2325`

## Changed Files

- `packages/engine-contracts/src/runtime-host/runtime-readonly-input-request-contract.ts`
- `packages/engine-contracts/src/index.ts`
- `tests/runtime-readonly-input-request-contract.test.ts`
- `docs/tasks/done/TASK-093-public-readonly-presentation-snapshot-scenario.md`
- `docs/tasks/review/TASK-094-ui-neutral-readonly-input-request-contract.md`
- `docs/status/CURRENT_STATE.md`

## New Production Files

- `packages/engine-contracts/src/runtime-host/runtime-readonly-input-request-contract.ts`

## New Test Files

- `tests/runtime-readonly-input-request-contract.test.ts`

## Updated Docs

- `docs/tasks/done/TASK-093-public-readonly-presentation-snapshot-scenario.md`
- `docs/tasks/review/TASK-094-ui-neutral-readonly-input-request-contract.md`
- `docs/status/CURRENT_STATE.md`
- `docs/handoffs/TASK-094-HANDOFF.md`

## Validation Results

- `corepack pnpm test -- tests/runtime-readonly-input-request-contract.test.ts` - passed, 1 test file / 7 tests.
- `corepack pnpm test -- tests/runtime-readonly-presentation-snapshot-scenario.test.ts` - passed, 1 test file / 6 tests.
- `corepack pnpm test -- tests/runtime-readonly-presentation-model.test.ts` - passed, 1 test file / 9 tests.
- `corepack pnpm test -- tests/runtime-readonly-transcript-scenario.test.ts` - passed, 1 test file / 7 tests.
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
- `corepack pnpm test` - passed, 71 test files / 680 tests.
- `corepack pnpm lint` - passed.
- `corepack pnpm typecheck` - passed.
- `corepack pnpm build` - passed.
- `corepack pnpm validate` - passed.
- `git diff --check` - passed with no output.

## Known Warnings

- Local Node version is `v24.16.0` while the repository engine expects Node 22. This remained non-blocking because all required validations passed.

## Scope Boundary Verdict

- PASS. TASK-094 adds only a UI-neutral read-only input request contract, deterministic validation helpers, and a one-way conversion into `RuntimeCommandRequest`. No command execution, planning, presentation creation, parser behavior, UI dependency, gameplay mutation, or next-state generation was introduced. TASK-095 was not created.

## Accepted / Rejected Command Summary

- Accepted commands are exactly `look` and `inventory`.
- Rejected commands include `go`, `talk`, `take`, `use`, `save`, `load`, unknown commands such as `attack`, and malformed empty-string command ids.
- Unknown top-level fields, unknown metadata fields, invalid metadata types, non-string ids, non-JSON-safe values, and forbidden keys are rejected with deterministic diagnostics.

## Conversion Behavior Summary

- `toRuntimeCommandRequestFromReadonlyInput` validates the UI-neutral input first and then returns a cloned JSON-safe `RuntimeCommandRequest` containing only `{ commandId }`.
- The conversion does not add `actorId`, `targetId`, `payload`, planning data, execution data, presentation data, or any state output.
- Repeated conversion of the same valid input produces identical canonical JSON.

## No-command-execution Confirmation

- The new contract does not call `executeRuntimeReadonlyRequest`, `executeRuntimeReadonlyCommand`, `createRuntimeCommandPlan`, content loaders, presentation builders, or any runtime executor.
- It is a pure validation and conversion boundary only.

## No-mutation / No-next-state Evidence

- Tests compare canonical JSON before and after conversion and confirm the input object is unchanged.
- Tests confirm the conversion result does not contain `plan`, `view`, `presentation`, `nextState`, `statePatch`, `events`, `runtimeDomainEventValues`, `transaction`, `saveResult`, or `loadResult`.

## Confirmations

- No browser UI or parser was implemented.
- No gameplay mutation was implemented.
- No next-state generation was implemented.
- TASK-095 was not created.
