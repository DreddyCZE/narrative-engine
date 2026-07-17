# TASK-107 Handoff

- Branch: `codex/task-107-pickup-ux-diagnostics-hardening`
- Base commit: `1c5981a53901d00466dd23aa679384fa87b5b1a7`
- Implementation commit: `b795ace381b31b761efb85d68002d65ceff6a8f5`
- Checkpoint date: `2026-07-17`
- TASK-108 created: `no`

## Changed Files
- `apps/runtime/README.md`
- `apps/runtime/src/prototype-scenarios.ts`
- `apps/runtime/src/readonly-prototype.test.ts`
- `apps/runtime/src/readonly-prototype.ts`
- `docs/handoffs/TASK-107-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-106-controlled-item-pickup-boundary.md`
- `docs/tasks/review/TASK-107-pickup-ux-diagnostics-hardening.md`
- `tests/runtime-item-pickup-command-executor-boundary.test.ts`

## App Files Updated
- Added a visible non-portable observation deck fixture, `item.demo.bulkhead-plaque`, alongside the existing visible portable deck pass.
- Hardened pickup output so blocked pickup now clearly reports already-in-inventory, not-visible-here, and visible-but-not-portable outcomes.
- Kept generic command-palette `Take` disabled while preserving explicit item-button pickup only.
- Strengthened prototype tests around non-portable visibility, disabled take affordances, blocked-state preservation, and successful pickup regression.

## Tests Updated
- Strengthened `tests/runtime-item-pickup-command-executor-boundary.test.ts` so visible non-portable pickup must include diagnostic details for `currentLocationId`, `itemId`, `itemLocationId`, and `inventoryItemIds`.
- Reworked `apps/runtime/src/readonly-prototype.test.ts` to cover the new visible non-portable fixture, blocked pickup transcript copy, projection preservation, and existing movement, inspection, and readiness regressions.

## Docs Updated
- Marked TASK-106 as DONE.
- Added TASK-107 review task record.
- Updated `docs/status/CURRENT_STATE.md` to reflect TASK-107 review readiness, PR #89 merge base, validation results, and TASK-108 absence.
- Updated `apps/runtime/README.md` to document the visible non-portable pickup fixture and clearer blocked pickup diagnostics.

## Visible Non-Portable Fixture Summary
- Added `item.demo.bulkhead-plaque` to the observation deck scenario.
- The plaque is `visible-here`, `portable: false`, inspectable, and rendered with a disabled `Take` affordance plus the reason `This visible item is not portable.`
- Blocked non-portable pickup leaves the plaque visible in the room projection.

## Blocked Pickup Diagnostic Summary
- Inventory-owned pickup still blocks with `RUNTIME_ITEM_PICKUP_COMMAND_ITEM_ALREADY_IN_INVENTORY`.
- Elsewhere pickup still blocks with `RUNTIME_ITEM_PICKUP_COMMAND_ITEM_NOT_VISIBLE_HERE`.
- Visible non-portable pickup now has explicit prototype coverage for `RUNTIME_ITEM_PICKUP_COMMAND_ITEM_NOT_PORTABLE` and transcript copy that says the item is visible here but not portable.
- Blocked pickup paths preserve runtime player state and map highlight.

## Successful Pickup Regression Summary
- Visible portable `item.demo.deck-pass` still picks up successfully.
- The picked-up item still moves from room view to inventory view through projection only.
- Current location, map highlight, and progress flags remain unchanged after successful pickup.

## Projection Preservation Proof
- Content item location is unchanged; the prototype still derives room versus inventory visibility from content location plus runtime inventory state.
- The new visible non-portable plaque remains visible after blocked pickup, proving failed pickup does not mutate content location or inventory ownership.
- After successful deck-pass pickup, the room still shows only the plaque while inventory gains the deck pass.

## No Generic Take Parser Storage Or Runtime Widening Confirmation
- Generic command-palette `Take` remains disabled.
- Pickup still executes only through explicit visible item buttons with concrete item ids.
- No new gameplay executor was introduced.
- No parser, arbitrary command input, save/load UI, replay runtime, DB, browser storage, P0 content, map editor, or plugin runtime was introduced.
- `Talk`, `Use`, `Save`, and `Load` remain disabled local UI-only affordances.

## Validation Results
- `corepack pnpm test -- tests/runtime-item-pickup-command-executor-boundary.test.ts` PASS
- `corepack pnpm --filter @narrative-engine/runtime-prototype test` PASS
- `corepack pnpm --filter @narrative-engine/runtime-prototype build` PASS
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
- `git diff --check` PASS with non-blocking CRLF normalization warnings in `apps/runtime/README.md`, `apps/runtime/src/prototype-scenarios.ts`, `apps/runtime/src/readonly-prototype.test.ts`, `apps/runtime/src/readonly-prototype.ts`, `docs/status/CURRENT_STATE.md`, and `tests/runtime-item-pickup-command-executor-boundary.test.ts`
