# TASK-099 Handoff

## Branch

- Branch name: `codex/task-099-prototype-data-driven-scenario-selector`
- Base commit: `b3952cf43633d6d31834be027c6d688a183ff5ff`
- Implementation commit: `99f31f1347c2c6182b74d14067b199864d45bdda`

## Changed Files

- `apps/runtime/README.md`
- `apps/runtime/src/main.ts`
- `apps/runtime/src/prototype-map-layouts.ts`
- `apps/runtime/src/prototype-scenarios.ts`
- `apps/runtime/src/readonly-prototype.css`
- `apps/runtime/src/readonly-prototype.test.ts`
- `apps/runtime/src/readonly-prototype.ts`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-098-prototype-readonly-map-layout-panel.md`
- `docs/tasks/review/TASK-099-prototype-data-driven-scenario-selector.md`
- `docs/handoffs/TASK-099-HANDOFF.md`

## App Files Added or Updated

- Added `apps/runtime/src/prototype-map-layouts.ts`
- Added `apps/runtime/src/prototype-scenarios.ts`
- Updated `apps/runtime/src/readonly-prototype.ts`
- Updated `apps/runtime/src/main.ts`
- Updated `apps/runtime/src/readonly-prototype.css`
- Updated `apps/runtime/README.md`

## Tests Updated

- Updated `apps/runtime/src/readonly-prototype.test.ts`
- Added scenario-registry, scenario-selection, per-scenario read-only action, disabled-action locality, reset-output, JSON-safety, and export-leakage coverage

## Docs Updated

- Updated `docs/status/CURRENT_STATE.md`
- Moved `docs/tasks/review/TASK-098-prototype-readonly-map-layout-panel.md` to `docs/tasks/done/TASK-098-prototype-readonly-map-layout-panel.md`
- Added `docs/tasks/review/TASK-099-prototype-data-driven-scenario-selector.md`
- Added `docs/handoffs/TASK-099-HANDOFF.md`

## Validation Results

- `corepack pnpm --filter @narrative-engine/runtime-prototype test` - passed, 1 file / 10 tests
- `corepack pnpm --filter @narrative-engine/runtime-prototype build` - passed
- `corepack pnpm test -- tests/runtime-readonly-interaction-boundary.test.ts` - passed
- `corepack pnpm test -- tests/runtime-readonly-input-request-contract.test.ts` - passed
- `corepack pnpm test -- tests/runtime-readonly-presentation-snapshot-scenario.test.ts` - passed
- `corepack pnpm test -- tests/runtime-readonly-presentation-model.test.ts` - passed
- `corepack pnpm test -- tests/runtime-readonly-transcript-scenario.test.ts` - passed
- `corepack pnpm test -- tests/runtime-readonly-request-execution-facade.test.ts` - passed
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
- `corepack pnpm test` - passed, 73 files / 698 tests
- `corepack pnpm lint` - passed
- `corepack pnpm typecheck` - passed
- `corepack pnpm build` - passed
- `corepack pnpm validate` - passed
- `git diff --check` - passed after final file cleanup

## Known Warnings

- Local Node version is `v24.16.0` while the repo engine expects Node 22; all required validations passed despite the warning.

## Local Run Command

1. `corepack pnpm --filter @narrative-engine/runtime-prototype build`
2. Open `apps/runtime/index.html` in a browser.

## Scenario Registry Summary

- Added an app-layer scenario registry in `apps/runtime/src/prototype-scenarios.ts`
- Registry entries are stable, unique, and data-driven
- The runtime prototype now rebuilds state from the selected registry entry instead of assuming a single hardcoded scenario

## Second Scenario Summary

- Added prototype-only demo scenario `prototype.demo.observation-deck`
- Uses the public content package contract and loader path
- Current location is `Prototype Observation Deck`
- Connected location is `Prototype Sensor Gallery`
- Inventory contains `Prototype Survey Tablet`
- Content remains prototype/demo only and does not add P0 story content

## Selector Behavior Summary

- The UI renders a scenario selector ahead of the command palette
- Selecting a scenario rebuilds content, read model, player state, map panel, transcript preview, and output state
- Scenario switching resets the latest action output back to the newly selected scenario preview instead of retaining prior scenario output
- Command palette behavior remains unchanged after scenario switches

## App-Layer Data Evidence

- Scenario package factories live in `apps/runtime/src/prototype-scenarios.ts`
- Map layouts live in `apps/runtime/src/prototype-map-layouts.ts`
- No scenario registry, map layout, or demo content was added to `packages/engine-contracts`

## Engine Contract Evidence

- No engine schema or runtime player state contract files were modified
- The prototype continues to import only public `@narrative-engine/engine-contracts` APIs
- Tests assert that no public engine exports such as `RuntimeMap`, `MapTile`, `MapRenderer`, `MapEditor`, `P0ContentPackage`, or `moveTo` were introduced

## Interaction Boundary Evidence

- Executable UI actions remain limited to `look` and `inventory`
- Both actions route through `executeRuntimeReadonlyInteraction(...)`
- The UI does not construct direct mutable execution paths or call lower-level executors/planners

## Disabled Action Local-Only Evidence

- Disabled `go`, `talk`, `take`, `use`, `save`, and `load` remain visible in the palette
- Selecting a disabled action returns a local disabled outcome with a reason
- Disabled actions do not create runtime requests, do not execute runtime interactions, and do not change player state or map state

## No Movement / Storage / Replay / DB / P0 Confirmation

- No movement or other gameplay mutation was introduced
- No next-state generation, state patching, event emission, transaction output, save result, or load result was added to prototype outcomes
- No localStorage, sessionStorage, IndexedDB, file storage, DB adapter, or external storage was added
- No replay runtime or backend integration was added
- No P0 story content was added

## Task Metadata Confirmation

- TASK-098 is marked DONE
- TASK-099 is marked REVIEW
- TASK-100 was not created