# TASK-101 Handoff

## Branch

- Branch name: `codex/task-101-controlled-movement-planning-vertical-slice`
- Base commit: `56165aff9122c4e41ae11091041f000f5a5817c6`
- Commit hash: `32dd73b1dfca2e761a2eca4e11e137191bbf555e`

## Changed Files

- `apps/runtime/README.md`
- `apps/runtime/src/main.ts`
- `apps/runtime/src/prototype-scenarios.ts`
- `apps/runtime/src/readonly-prototype.css`
- `apps/runtime/src/readonly-prototype.test.ts`
- `apps/runtime/src/readonly-prototype.ts`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-100-prototype-milestone-checkpoint-next-gameplay-scope.md`
- `docs/tasks/review/TASK-101-controlled-movement-planning-vertical-slice.md`
- `packages/engine-contracts/src/index.ts`
- `packages/engine-contracts/src/runtime-host/runtime-movement-command-executor.ts`
- `tests/runtime-movement-command-executor-boundary.test.ts`
- `docs/handoffs/TASK-101-HANDOFF.md`

## Engine Files Added Or Updated

- Added `packages/engine-contracts/src/runtime-host/runtime-movement-command-executor.ts`
- Updated `packages/engine-contracts/src/index.ts`

## App Files Updated

- Updated `apps/runtime/src/readonly-prototype.ts`
- Updated `apps/runtime/src/main.ts`
- Updated `apps/runtime/src/readonly-prototype.css`
- Updated `apps/runtime/src/prototype-scenarios.ts`
- Updated `apps/runtime/README.md`

## Tests Added Or Updated

- Added `tests/runtime-movement-command-executor-boundary.test.ts`
- Updated `apps/runtime/src/readonly-prototype.test.ts`

## Docs Updated

- Updated `docs/status/CURRENT_STATE.md`
- Moved `docs/tasks/review/TASK-100-prototype-milestone-checkpoint-next-gameplay-scope.md` to `docs/tasks/done/TASK-100-prototype-milestone-checkpoint-next-gameplay-scope.md`
- Added `docs/tasks/review/TASK-101-controlled-movement-planning-vertical-slice.md`
- Added `docs/handoffs/TASK-101-HANDOFF.md`

## Validation Results

- `corepack pnpm test -- tests/runtime-movement-command-executor-boundary.test.ts` - passed, 1 test file / 10 tests
- `corepack pnpm --filter @narrative-engine/runtime-prototype test` - passed, 1 test file / 10 tests
- `corepack pnpm --filter @narrative-engine/runtime-prototype build` - passed
- `corepack pnpm test -- tests/runtime-command-planning-boundary.test.ts` - passed, 1 test file / 7 tests
- `corepack pnpm test -- tests/runtime-command-request-boundary.test.ts` - passed, 1 test file / 6 tests
- `corepack pnpm test -- tests/runtime-player-state-contract.test.ts` - passed, 1 test file / 5 tests
- `corepack pnpm test -- tests/content-read-model-boundary.test.ts` - passed, 1 test file / 5 tests
- `corepack pnpm test -- tests/content-package-loader-boundary.test.ts` - passed, 1 test file / 6 tests
- `corepack pnpm test -- tests/content-package-contracts.test.ts` - passed, 1 test file / 6 tests
- `corepack pnpm test` - passed, 74 test files / 708 tests
- `corepack pnpm lint` - passed
- `corepack pnpm typecheck` - passed
- `corepack pnpm build` - passed
- `corepack pnpm validate` - passed
- `git diff --check` - passed

## Known Warnings

- Local Node version is `v24.16.0` while the repo engine expects Node 22; all required validations passed despite the warning.

## Movement Boundary Summary

- Added a dedicated public movement executor boundary in `packages/engine-contracts/src/runtime-host/runtime-movement-command-executor.ts`.
- The boundary accepts only planned `go` commands.
- Execution mutates only `currentLocationId`, `revision`, and `metadata.updatedAtRevision`.
- Inventory item IDs, progress flags, and content package metadata are preserved.
- The result returns `initialPlayerState` and `finalPlayerState`, plus `fromLocationId`, `toLocationId`, and the resolved `exitId`.
- The movement result remains deterministic and JSON-safe and does not expose storage, replay, transaction, or event outputs.

## Request And Planning Integration Summary

- The prototype does not bypass planning.
- Exit clicks create a normal `RuntimeCommandRequest` with `commandId: "go"` and `targetId` set to the selected exit target location id.
- That request flows through `createRuntimeCommandPlan(...)` before reaching `executeRuntimeMovementCommand(...)`.
- No free-form parser or arbitrary text command input was introduced.

## Prototype Movement UI Summary

- The command palette now conditionally enables `Go` when the current location has at least one exit.
- Exit buttons are rendered directly from the current location read model.
- Clicking an exit executes movement for that explicit target only.
- After movement, the location panel, transcript preview, output panel, and map highlight update to the new current location.
- `Talk`, `Take`, `Use`, `Save`, and `Load` remain disabled local UI-only actions.

## Map Update Proof

- Prototype tests verify that moving through the smoke scenario exit changes `mapPanel.currentLocationId` from `location.smoke.start` to `location.smoke.corridor`.
- Prototype tests verify the observation deck scenario moves to `location.demo.sensor-gallery` and updates the highlighted room there as well.

## Inventory And Progress Preservation Proof

- Engine movement tests assert inventory and progress flags are identical before and after movement.
- Prototype movement tests assert the visible inventory remains unchanged after movement.
- The movement boundary test also asserts that `metadata.contentPackageId` remains stable across the move.

## No Parser Or Arbitrary Target Proof

- `Go` is not a text input.
- Movement can be triggered only by clicking a visible exit button derived from the current read model.
- The command palette `Go` action alone does not execute movement without an explicit exit selection.
- No arbitrary target typing, parser surface, or generic command executor API was added.

## No Storage / Replay / DB / P0 / Map Editor / Plugin Confirmation

- No browser storage, DB adapter, or external storage was added.
- No replay runtime was added.
- No save/load UI integration was added.
- No P0 story content package was added.
- No map editor was added.
- No plugin runtime was added.

## Task Metadata Confirmation

- TASK-100 is marked DONE.
- TASK-101 is REVIEW.
- TASK-102 was not created.