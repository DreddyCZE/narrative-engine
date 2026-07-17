# TASK-105 Handoff

- Branch: `codex/task-105-prototype-item-presence-projection-before-pickup`
- Base commit: `6354cdb00ddcf53d7f350ba5c946fa64cc9cbcbe`
- Implementation commit: `b9424aeb185f85572cadbee03c713c3cbf17bd8e`
- Checkpoint date: `2026-07-17`
- TASK-106 created: `no`

## Changed Files
- `apps/runtime/README.md`
- `apps/runtime/src/main.ts`
- `apps/runtime/src/prototype-scenarios.ts`
- `apps/runtime/src/readonly-prototype.css`
- `apps/runtime/src/readonly-prototype.test.ts`
- `apps/runtime/src/readonly-prototype.ts`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-104-prototype-future-action-readiness-model.md`
- `docs/tasks/review/TASK-105-prototype-item-presence-projection-before-pickup.md`
- `docs/handoffs/TASK-105-HANDOFF.md`

## App Files Updated
- Added a typed app-layer item presence projection to the runtime prototype state.
- Updated world details to render only `visible-here` projected items.
- Updated inventory rendering to use `in-inventory` projected items from runtime player state.
- Added inventory-side inspect buttons so only visible-here and in-inventory items remain inspectable.
- Added a visible room item and an unreachable item to the observation-deck demo scenario so all projection states can be demonstrated in the UI.

## Tests Updated
- Extended `apps/runtime/src/readonly-prototype.test.ts` with projection coverage for `visible-here`, `in-inventory`, and `elsewhere` items.
- Added assertions that room rendering uses only visible-here items and inventory rendering uses only in-inventory items.
- Added checks that visible portable items show `take` as `ready-later` while inventory-owned items do not appear as pickup targets.

## Docs Updated
- Marked TASK-104 as DONE.
- Added TASK-105 review task record.
- Updated `docs/status/CURRENT_STATE.md` to reflect TASK-105 in review and TASK-106 not created.
- Updated `apps/runtime/README.md` to document the read-only item presence projection.

## Item Presence Projection Summary
- Prototype state now carries `itemPresence` rows with `itemId`, `title`, `description`, `portable`, `status`, optional `sourceLocationId`, and `readonly: true`.
- Projection states are `visible-here`, `in-inventory`, `elsewhere`, and `unknown`.
- Projection is derived only from app-layer content item location data plus `playerState.inventoryItemIds`.
- The observation-deck demo now contains:
  - `Prototype Deck Pass` as a visible portable room item
  - `Prototype Survey Tablet` as an inventory-owned item
  - `Prototype Locker Seal` as an unreachable elsewhere item

## Proof Projection Is Read-Only
- Projection is computed inside `apps/runtime/src/readonly-prototype.ts` through pure helpers only.
- No projection path calls `createRuntimeCommandPlan`, `executeRuntimeReadonlyInteraction`, or `executeRuntimeMovementCommand`.
- Projection updates only derived app-layer state used for rendering and inspection.

## Proof Projection Does Not Mutate Player State Map Inventory Or Progress
- Projection reads from `runtime.playerState.currentLocationId` and `runtime.playerState.inventoryItemIds` but never writes to them.
- Tests assert inspection plus projection leave `location`, `inventory`, `mapPanel`, and `itemPresence` unchanged.
- Existing movement tests still pass for available movement, locked exits, and condition-gated exits.

## Proof `take` Is Still Not Executable
- `Take` remains in `DISABLED_PROTOTYPE_ACTIONS` and still returns only the existing local disabled outcome.
- No `take` executor, mutation pipeline, item move operation, or ownership write was added.
- Visible portable items show `take` as `ready-later` only inside inspection readiness metadata.
- Inventory-owned items show `take` as `not-applicable` and are not presented as pickup targets.

## Movement Regression Summary
- Available exits still move through explicit exit-targeted planning and the dedicated movement boundary.
- Locked exits still block with `RUNTIME_MOVEMENT_COMMAND_EXIT_LOCKED`.
- Condition-gated exits still block with `RUNTIME_MOVEMENT_COMMAND_EXIT_CONDITION_UNMET`.
- Map highlight behavior remains unchanged and still updates only after accepted movement.

## Inspection And Readiness Regression Summary
- Inspection remains read-only and separate from movement.
- Current location, exits, visible-here items, inventory-owned items, and NPCs remain inspectable.
- Future action readiness remains visibly read-only and non-executing.
- Visible portable room items show `take` as `ready-later`.
- Inventory-owned items do not show pickup availability.

## Engine Contracts Confirmation
- No files under `packages/engine-contracts` were changed.
- Projection logic lives only in `apps/runtime`.
- Existing tests still confirm engine exports did not gain parser, map-editor, storage, replay, or final-game symbols.

## Validation Results
- `corepack pnpm --filter @narrative-engine/runtime-prototype test` ✅
- `corepack pnpm --filter @narrative-engine/runtime-prototype build` ✅
- `corepack pnpm test -- tests/runtime-movement-command-executor-boundary.test.ts` ✅
- `corepack pnpm test -- tests/runtime-command-planning-boundary.test.ts` ✅
- `corepack pnpm test -- tests/runtime-command-request-boundary.test.ts` ✅
- `corepack pnpm test -- tests/runtime-player-state-contract.test.ts` ✅
- `corepack pnpm test -- tests/content-read-model-boundary.test.ts` ✅
- `corepack pnpm test -- tests/content-package-loader-boundary.test.ts` ✅
- `corepack pnpm test -- tests/content-package-contracts.test.ts` ✅
- `corepack pnpm test` ✅
- `corepack pnpm lint` ✅
- `corepack pnpm typecheck` ✅
- `corepack pnpm build` ✅
- `corepack pnpm validate` ✅
- `git diff --check` ✅

## Known Warnings
- Local Node version is `v24.16.0` while the repository declares `>=22 <23`. All validations passed and the warning remained non-blocking.

## Scope Guard Confirmation
- No parser or arbitrary command input was added.
- No `take` execution, inventory mutation, dialogue progression, or use/effect execution was added.
- No save/load UI, replay runtime, DB, browser storage, external storage, map editor, plugin runtime, or P0 story content was added.
- Scenario and map data remain app-layer only.
