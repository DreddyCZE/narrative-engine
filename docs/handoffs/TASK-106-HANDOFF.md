# TASK-106 Handoff

- Branch: `codex/task-106-controlled-item-pickup-boundary`
- Base commit: `da265a7a8cb51930f0f4d03abb8dca3d740d8bfe`
- Implementation commit: `cf4c58ca80ef2ca29c54e3dc52c140f378a35030`
- Checkpoint date: `2026-07-17`
- TASK-107 created: `no`

## Changed Files
- `apps/runtime/README.md`
- `apps/runtime/src/main.ts`
- `apps/runtime/src/prototype-scenarios.ts`
- `apps/runtime/src/readonly-prototype.css`
- `apps/runtime/src/readonly-prototype.test.ts`
- `apps/runtime/src/readonly-prototype.ts`
- `docs/handoffs/TASK-106-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-105-prototype-item-presence-projection-before-pickup.md`
- `docs/tasks/review/TASK-106-controlled-item-pickup-boundary.md`
- `packages/engine-contracts/src/index.ts`
- `packages/engine-contracts/src/runtime-host/runtime-item-pickup-command-executor.ts`
- `tests/runtime-item-pickup-command-executor-boundary.test.ts`

## Engine Files Added Or Updated
- Added `packages/engine-contracts/src/runtime-host/runtime-item-pickup-command-executor.ts` as the dedicated planned-`take` mutation boundary.
- Updated `packages/engine-contracts/src/index.ts` to export the pickup executor, input/result types, diagnostics, statuses, and validation helpers.

## App Files Updated
- Updated the runtime prototype controller with explicit `pickupItem(itemId: string)` execution through command planning plus the dedicated pickup executor only.
- Updated world item rendering to show explicit `Take` buttons only for visible portable items.
- Kept the generic command-palette `Take` action disabled with local UI-only copy.
- Updated projection-driven inventory and inspection behavior to reflect post-pickup room versus inventory separation.
- Enabled `take` in prototype scenario affordances while keeping parser-free explicit button routing only.

## Tests Added Or Updated
- Added `tests/runtime-item-pickup-command-executor-boundary.test.ts`.
- Replaced `apps/runtime/src/readonly-prototype.test.ts` coverage with pickup-focused prototype assertions while preserving movement, inspection, and readiness regressions.

## Docs Updated
- Marked TASK-105 as DONE.
- Added TASK-106 review task record.
- Updated `docs/status/CURRENT_STATE.md` to reflect TASK-106 review state, accepted pickup scope, validation results, and TASK-107 absence.
- Updated `apps/runtime/README.md` to document the controlled pickup slice.

## Pickup Boundary Summary
- The pickup executor accepts only planned `take` commands.
- It rejects non-`take` plans and blocks missing target, unresolved item, item-not-visible-here, already-in-inventory, and non-portable cases.
- Successful pickup mutates only runtime player state by adding the item id once to `inventoryItemIds`, incrementing `revision`, and updating `metadata.updatedAtRevision`.
- Successful pickup preserves `currentLocationId`, `progressFlags`, content package metadata, and other player state metadata.
- Results remain deterministic and JSON-safe and do not expose storage, replay, DB, or event output fields.

## Projection Integration Summary
- Content item location remains unchanged.
- Runtime inventory state becomes the only ownership mutation.
- App-layer projection derives `visible-here` versus `in-inventory` from unchanged content item location plus updated runtime inventory state.
- After pickup, the selected item disappears from visible room items and appears in inventory without mutating content.

## Proof Content Item Location Is Not Mutated
- The pickup executor reads content items through the read model only and never writes back to content structures.
- Engine tests compare the content item before and after execution and keep the read-model item unchanged.
- Prototype output explicitly states that item presence derives from unchanged content item location plus updated runtime inventory state.

## Proof Inventory Mutation Is Limited To Adding Item ID Once
- Engine tests assert the target item id is appended exactly once to `inventoryItemIds`.
- Blocked paths preserve the initial and final player state byte-for-byte.
- The executor updates no other mutable gameplay fields besides revision metadata.

## Proof Generic Take Remains Disabled
- `Take` stays in `DISABLED_PROTOTYPE_ACTIONS` and still returns only the local disabled palette outcome.
- The runtime prototype exposes pickup only through explicit visible item buttons carrying a concrete item id.
- No parser, arbitrary target text entry, or generic mutable execution surface was introduced.

## Movement Inspection And Readiness Regression Summary
- Existing movement behavior still passes for available, locked, and condition-gated exits.
- Map highlight remains unchanged on blocked pickup and still changes only on accepted movement.
- Inspection remains read-only and separate from movement and pickup execution.
- Future action readiness remains UI-only metadata and now reflects pickup availability without executing pickup itself.

## Validation Results
- `corepack pnpm test -- tests/runtime-item-pickup-command-executor-boundary.test.ts` ✅
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
- `git diff --check` reported non-blocking CRLF normalization warnings for `apps/runtime/README.md` and `apps/runtime/src/readonly-prototype.test.ts`.

## Scope Guard Confirmation
- No parser or arbitrary command input was added.
- No dialogue progression or use/effect execution was added.
- No save/load UI, replay runtime, storage adapter, DB, browser persistence, map editor, plugin runtime, or P0 story content was added.
- Scenario and map data remain app-layer only.
