# TASK-089 Handoff

- Branch: `codex/task-089-public-readonly-runtime-smoke-scenario`
- Base commit: `56968b0a52c210c34025357d1fd049b91cadf6ed`
- Commit hash: `6ac30f73ce3a6e7624e628e78dde49433cd85f1a`
- Scope boundary verdict: PASS. TASK-089 adds only a public read-only smoke scenario over the accepted loader, read model, player-state, planning, and read-only facade boundaries and does not introduce mutable execution, gameplay mutation, next-state generation, UI/editor, replay runtime, DB/external storage, or TASK-090.

## Changed Files

- `docs/handoffs/TASK-089-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-088-read-only-runtime-command-execution-facade.md`
- `docs/tasks/review/TASK-089-public-readonly-runtime-smoke-scenario.md`
- `packages/engine-contracts/src/index.ts`
- `packages/engine-contracts/src/runtime-host/runtime-readonly-smoke-scenario.ts`
- `tests/runtime-readonly-smoke-scenario.test.ts`

## New Production Files

- `packages/engine-contracts/src/runtime-host/runtime-readonly-smoke-scenario.ts`

## New Test Files

- `tests/runtime-readonly-smoke-scenario.test.ts`

## Updated Docs

- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-088-read-only-runtime-command-execution-facade.md`
- `docs/tasks/review/TASK-089-public-readonly-runtime-smoke-scenario.md`

## Smoke Package Summary

- Added `createReadonlyRuntimeSmokeScenarioPackage()` as a public neutral sci-fi smoke fixture.
- Package id is `content.runtime-smoke.readonly`.
- The package contains:
  - `location.smoke.start`
  - `location.smoke.corridor`
  - `item.smoke.keycard`
  - `npc.smoke.observer`
  - `dialogue.smoke.observer`
- The package is JSON-safe and loads cleanly through the public content loader boundary.
- The package affords only `look` and `inventory` for smoke execution.

## Smoke Scenario Behavior Summary

- Added `runReadonlyRuntimeSmokeScenario()` as a public end-to-end read-only runtime smoke runner.
- The runner uses only public APIs:
  - `loadContentPackageFromObject`
  - `createContentReadModel`
  - `createInitialRuntimePlayerStateFromContent`
  - `createRuntimeCommandPlan`
  - `executeRuntimeReadonlyCommand`
- The result is deterministic and JSON-safe.
- The result contains stable `scenarioId`, `packageId`, two smoke steps, initial/final player state, and deterministic metadata counts.

## Command Sequence Summary

- The smoke scenario executes exactly two commands in order:
  - `look`
  - `inventory`
- Both command plans resolve to `planned`.
- Both read-only executions resolve to `executed`.
- No mutable commands are planned or executed.

## No-mutation Evidence

- The scenario captures `initialPlayerState` before execution and `finalPlayerState` after execution.
- Tests compare canonical JSON for both states and verify they are identical.
- Tests also verify:
  - current location remains `location.smoke.start`
  - inventory remains exactly `["item.smoke.keycard"]`

## No-next-state Evidence

- The smoke result does not contain:
  - `nextState`
  - `statePatch`
  - `events`
  - `runtimeDomainEventValues`
  - `transaction`
  - `saveResult`
  - `loadResult`

## Validation Results

- `corepack pnpm test -- tests/runtime-readonly-smoke-scenario.test.ts` - passed
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

- Only `look` and `inventory` are executed by the smoke scenario.
- No gameplay mutation was implemented.
- No next-state generation was implemented.
- No generic mutable command executor was introduced.
- TASK-090 was not created.
