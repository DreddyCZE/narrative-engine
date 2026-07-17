# TASK-108 Handoff

- Branch: `codex/task-108-inventory-owned-item-inspection-hardening`
- Base commit: `069c872f556370fedb3fb39641c688295b3a842c`
- Implementation commit: `6d85e9788da7657e612fa7981b7a7847cb5251fb`
- Checkpoint date: `2026-07-17`
- TASK-109 created: `no`

## Changed Files
- `apps/runtime/README.md`
- `apps/runtime/src/main.ts`
- `apps/runtime/src/readonly-prototype.css`
- `apps/runtime/src/readonly-prototype.test.ts`
- `apps/runtime/src/readonly-prototype.ts`
- `docs/handoffs/TASK-108-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-107-pickup-ux-diagnostics-hardening.md`
- `docs/tasks/review/TASK-108-inventory-owned-item-inspection-hardening.md`

## App Files Updated
- Hardened the inventory panel so each inventory-owned item clearly shows title, description, `Presence: in-inventory`, `Portable`, and an `Inspect` button.
- Kept inventory-owned items non-actionable for pickup in the UI by omitting any active `Take` control and showing `Already in inventory.` instead.
- Hardened item inspection so inventory-owned items now show `Inventory owned: yes` and `Pickup no longer applies to inventory-owned items.`
- Preserved read-only future action readiness for inventory-owned items while keeping `take`, `talk`, and `go` not-applicable.

## Tests Updated
- Reworked `apps/runtime/src/readonly-prototype.test.ts` to cover inventory-owned inspection before and after pickup, blocked re-pickup preservation, and the existing non-portable / elsewhere pickup diagnostics.
- Kept engine pickup and movement regression coverage passing without modifying engine contracts.

## Docs Updated
- Marked TASK-107 as DONE.
- Added TASK-108 review task record.
- Updated `docs/status/CURRENT_STATE.md` to reflect PR #90 merge base, TASK-108 review state, validation results, and TASK-109 absence.
- Updated `apps/runtime/README.md` to document the inventory-owned inspection hardening.

## Inventory-Owned Inspection Summary
- Initial inventory-owned `item.demo.survey-tablet` is projected as `in-inventory`, remains inspectable, and is clearly not a pickup target.
- Inventory inspection now shows explicit ownership state and explicit pickup-not-applicable copy.
- After picking up `item.demo.deck-pass`, the deck pass is inspectable from inventory with the same ownership behavior.

## Pickup Regression Summary
- Successful pickup still reports that the item was picked up.
- Successful pickup still moves `item.demo.deck-pass` from visible room items to inventory projection only.
- The picked-up deck pass remains absent from visible room items and present in inventory.
- Visible non-portable and elsewhere pickup diagnostics from TASK-107 still pass.

## Blocked Pickup Preservation Summary
- Calling `pickupItem` for an inventory-owned item still blocks with `RUNTIME_ITEM_PICKUP_COMMAND_ITEM_ALREADY_IN_INVENTORY`.
- Blocked pickup of both the initial inventory item and the post-pickup deck pass preserves player state and item projection.
- Current location, map highlight, and progress flags remain unchanged on blocked pickup.

## No Engine-Contracts-Change Confirmation
- No files under `packages/engine-contracts` were modified.
- No new runtime executor or mutable public engine API was introduced.

## Scope Guard Confirmation
- No `drop`, `use`, or `talk` execution was added.
- No parser or arbitrary command input was added.
- No save/load UI, replay runtime, DB, browser storage, external storage, P0 content, map editor, or plugin runtime was added.
- Generic command-palette `Take` remains disabled.

## Validation Results
- `corepack pnpm --filter @narrative-engine/runtime-prototype test` PASS
- `corepack pnpm --filter @narrative-engine/runtime-prototype build` PASS
- `corepack pnpm test -- tests/runtime-item-pickup-command-executor-boundary.test.ts` PASS
- `corepack pnpm test -- tests/runtime-movement-command-executor-boundary.test.ts` PASS
- `corepack pnpm test -- tests/runtime-command-planning-boundary.test.ts` PASS
- `corepack pnpm test -- tests/runtime-command-request-boundary.test.ts` PASS
- `corepack pnpm test -- tests/runtime-player-state-contract.test.ts` PASS
- `corepack pnpm test -- tests/content-read-model-boundary.test.ts` PASS
- `corepack pnpm test -- tests/content-package-loader-boundary.test.ts` PASS
- `corepack pnpm test -- tests/content-package-contracts.test.ts` PASS
- `corepack pnpm test` PASS
- `corepack pnpm lint` PASS
- `corepack pnpm typecheck` PASS
- `corepack pnpm build` PASS
- `corepack pnpm validate` PASS
- `git diff --check` PASS with non-blocking CRLF normalization warnings in `apps/runtime/README.md`, `apps/runtime/src/main.ts`, `apps/runtime/src/readonly-prototype.css`, `apps/runtime/src/readonly-prototype.test.ts`, `apps/runtime/src/readonly-prototype.ts`, and `docs/status/CURRENT_STATE.md`
