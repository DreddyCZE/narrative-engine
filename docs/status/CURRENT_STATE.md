# Current State

**Date:** 2026-07-16
**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Active task:** none
**Status:** TASK-037 through TASK-103 are DONE or REVIEW. TASK-060 through TASK-102 are DONE. TASK-103 is REVIEW. M2 gate verdict is `M2_GATE_PASS_WITH_DEFERRED_ITEMS`. M3 gate verdict is `M3_GATE_PASS_WITH_DEFERRED_ITEMS`. M4 gate verdict is `M4_GATE_PASS_WITH_DEFERRED_ITEMS`. M5 gate verdict is `M5_GATE_PASS_WITH_DEFERRED_ITEMS`. M6 gate verdict is `M6_GATE_PASS_WITH_DEFERRED_ITEMS`.

## Current Workflow

1. **Current milestone:** M7 Production Storage Adapter / Replay Boundary.
2. **Current state:** TASK-102 is DONE. TASK-103 is REVIEW. There is no active task.
3. **Single next most important task:** Review `TASK-103 - Prototype read-only inspection panel`.
4. **What the current scope must not change:** no generic command execution, no free-form parser, no arbitrary target input, no gameplay mutation beyond the accepted deterministic current-location movement slice, no inventory mutation, no dialogue progression, no use/effect execution, no replay runtime, no DB adapter, and no external or browser storage adapter may be introduced until later tasks explicitly accept them.
5. **How completion is recognized:** TASK-103 remains review-ready with a read-only inspection panel for current locations, exits, visible items, and visible NPCs, while movement diagnostics and deterministic movement behavior remain intact and inspection never executes runtime commands.

## Repository / PR State

- Correct GitHub remote is configured:
  - `origin`: `https://github.com/DreddyCZE/narrative-engine.git`
- The old incorrect remote remains isolated and must not be used for pushes.
- PR #84 was merged into `origin/main` at merge commit `53e66a6`.
- PR #85 was merged into `origin/main` at merge commit `47b8584`.
- TASK-102 is done.
- TASK-103 is in review.
- TASK-104 has not been created.
- No DB adapter, external storage adapter, replay runtime, browser storage, map editor, or plugin runtime task is active.

## Boundary Reminder

- Runtime host remains pure and in-memory except for the accepted read-only `look` and `inventory` boundaries plus the dedicated movement executor boundary for planned `go` commands.
- `apps/runtime` remains the accepted browser prototype consumer over public engine-contracts exports only.
- Inspection is app-layer only and must not call planning, read-only execution, or movement execution.
- `Go` stays bound only to explicit exits already present in the current read model and does not accept arbitrary text.
- Locked exits block movement with `RUNTIME_MOVEMENT_COMMAND_EXIT_LOCKED`.
- Condition-gated exits block movement with `RUNTIME_MOVEMENT_COMMAND_EXIT_CONDITION_UNMET` until the required progress flag is present.
- Scenario registry and map registry remain app-layer only.
- `Talk`, `Take`, `Use`, `Save`, and `Load` remain disabled local UI-only affordances.
- No DB adapter.
- No external or browser storage adapter.
- No map editor.
- No plugin runtime.

## Next Task Boundary

Review `TASK-103` next. Keep the work focused on the accepted controlled movement slice and read-only inspection panel only. Do not introduce parser input, arbitrary targeting, item pickup, inventory mutation, dialogue progression, use/effect execution, save/load UI, replay runtime, DB integration, browser persistence, map editing, plugin runtime, or P0 story content in this step.
