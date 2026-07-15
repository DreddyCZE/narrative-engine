# TASK-098 Handoff

- Branch: `codex/task-098-prototype-readonly-map-layout-panel`
- Base commit: `ab654612004e6e0535b3bdb95f4237a9126fcc44`
- Commit hash: `5fd6639e65e635035261fc9bd601fd9373bfb77e`

## Changed Files

- `apps/runtime/README.md`
- `apps/runtime/src/main.ts`
- `apps/runtime/src/readonly-prototype.css`
- `apps/runtime/src/readonly-prototype.test.ts`
- `apps/runtime/src/readonly-prototype.ts`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-097-prototype-command-palette-disabled-gameplay-actions.md`
- `docs/tasks/review/TASK-098-prototype-readonly-map-layout-panel.md`
- `docs/handoffs/TASK-098-HANDOFF.md`

## App Files Updated

- `apps/runtime/README.md`
- `apps/runtime/src/main.ts`
- `apps/runtime/src/readonly-prototype.css`
- `apps/runtime/src/readonly-prototype.test.ts`
- `apps/runtime/src/readonly-prototype.ts`

## Tests Updated

- `apps/runtime/src/readonly-prototype.test.ts`

## Docs Updated

- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-097-prototype-command-palette-disabled-gameplay-actions.md`
- `docs/tasks/review/TASK-098-prototype-readonly-map-layout-panel.md`
- `docs/handoffs/TASK-098-HANDOFF.md`

## Validation Results

- `corepack pnpm --filter @narrative-engine/runtime-prototype test` - passed, 1 test file / 6 tests.
- `corepack pnpm --filter @narrative-engine/runtime-prototype build` - passed.
- `corepack pnpm test -- tests/runtime-readonly-interaction-boundary.test.ts` - passed, 1 test file / 8 tests.
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
- `corepack pnpm test` - passed, 73 test files / 694 tests.
- `corepack pnpm lint` - passed.
- `corepack pnpm typecheck` - passed.
- `corepack pnpm build` - passed.
- `corepack pnpm validate` - passed.
- `git diff --check` - passed with LF normalization warnings only.

## Local Run Command

1. `corepack pnpm --filter @narrative-engine/runtime-prototype build`
2. Open `apps/runtime/index.html` in a browser.

## Map Panel Behavior Summary

- The prototype now renders a visible read-only map/layout panel alongside the accepted command palette and text panels.
- The map highlights `Smoke Test Airlock` as the current tile and shows `Smoke Test Corridor` as a known connected tile.
- The connection is rendered as a UI-only door/corridor indicator plus a simple legend for current state, known locations, connections, and disabled movement.

## Proof That Map Layout Data Is UI-only

- All map types, tiles, connections, and legend data live only in `apps/runtime/src/readonly-prototype.ts`.
- No map coordinates, map schema, or map panel exports were added to `@narrative-engine/engine-contracts`.
- The tests assert that engine contracts still expose no `RuntimeMap`, `MapTile`, `MapRenderer`, `MapEditor`, or `moveTo` export.

## Proof That Look Does Not Move

- `apps/runtime/src/readonly-prototype.test.ts` captures the map panel before and after `controller.runAction("look")` and asserts the current location id, tile count, full map panel JSON, and player state all remain unchanged.
- Enabled `look` still routes through `executeRuntimeReadonlyInteraction(...)` only.

## Proof That Disabled Go Does Not Move Or Execute

- `apps/runtime/src/readonly-prototype.ts` branches disabled commands before any runtime interaction creation and returns a local `disabled` outcome.
- `apps/runtime/src/readonly-prototype.test.ts` asserts `go` returns `status === "disabled"`, produces no `interaction`, keeps the map panel unchanged, and preserves identical player state snapshots.
- The disabled reason remains `Movement execution is not implemented yet.`

## No Engine Schema Change Confirmation

- No files under `packages/engine-contracts` were modified.
- No content package contract, runtime player state contract, loader contract, or engine schema file changed for this task.

## Scope Confirmations

- No storage, replay runtime, DB adapter, backend service, external API, or P0 content was added.
- TASK-097 is marked DONE.
- TASK-098 is marked REVIEW.
- `TASK-099` was not created.
