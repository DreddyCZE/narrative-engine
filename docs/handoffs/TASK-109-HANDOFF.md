# TASK-109 Handoff

- Branch: `codex/task-109-pickup-milestone-checkpoint-before-next-command`
- Base commit: `1ebffe66283d493a967405131f9bbc99d131089d`
- Implementation commit: `932b146aafda8ef9b7bb6ee15ff2bf650383cbac`
- Checkpoint date: `2026-07-17`
- TASK-110 created: `no`

## Changed Files
- `docs/handoffs/TASK-109-HANDOFF.md`
- `docs/planning/PICKUP_MILESTONE_CHECKPOINT_AND_NEXT_COMMAND_SCOPE.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-108-inventory-owned-item-inspection-hardening.md`
- `docs/tasks/review/TASK-109-pickup-milestone-checkpoint-before-next-command.md`

## Docs-Only Confirmation
- No files under `apps/runtime` were modified.
- No files under `packages` were modified.
- No files under `tests` were modified.
- This task updates only planning, status, task metadata, and handoff documentation.

## Validation Results
- `git diff --check` PASS with a non-blocking CRLF normalization warning in `docs/status/CURRENT_STATE.md`
- `corepack pnpm validate` PASS

## Accepted Boundary Summary
- Accepted runtime command boundaries remain read-only `look`, read-only `inventory`, controlled explicit-exit `go`, and controlled explicit-visible-portable-item `take`.
- Accepted prototype behavior remains scenario selection, read-only map/layout, movement diagnostics, inspection, future readiness, item presence projection, controlled pickup, and inventory-owned inspection hardening.

## Accepted Mutation Summary
- Movement may mutate only `currentLocationId`, `revision`, and `metadata.updatedAtRevision`.
- Pickup may mutate only `inventoryItemIds`, `revision`, and `metadata.updatedAtRevision`.
- All other runtime player state fields remain unchanged unless a later task explicitly accepts them.

## Forbidden Scope Summary
- Generic command execution, parser input, arbitrary target input, `drop`, `use`, `talk` execution, dialogue progression, effect execution, save/load UI, replay runtime, browser storage, external storage, DB adapters, map editor, plugin runtime, P0 story content, and hardcoded production story in engine contracts remain forbidden.

## Next Command Recommendation
- Recommend `talk` before `use`.
- Rationale: `talk` can be introduced as a controlled explicit-visible-NPC preview boundary without pulling in the broader effect-modeling and unlock-state consequences that `use` likely needs.

## TASK-110 Confirmation
- TASK-110 is not created in this task. Only a future outline is documented.
