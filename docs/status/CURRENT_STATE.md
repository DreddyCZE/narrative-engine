# Current State

**Date:** 2026-07-16
**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Active task:** none
**Status:** TASK-037 through TASK-101 are DONE or REVIEW. TASK-060 through TASK-100 are DONE. TASK-101 is REVIEW. M2 gate verdict is `M2_GATE_PASS_WITH_DEFERRED_ITEMS`. M3 gate verdict is `M3_GATE_PASS_WITH_DEFERRED_ITEMS`. M4 gate verdict is `M4_GATE_PASS_WITH_DEFERRED_ITEMS`. M5 gate verdict is `M5_GATE_PASS_WITH_DEFERRED_ITEMS`. M6 gate verdict is `M6_GATE_PASS_WITH_DEFERRED_ITEMS`.

## Current Workflow

1. **Current milestone:** M7 Production Storage Adapter / Replay Boundary.
2. **Current state:** TASK-100 is DONE. TASK-101 is REVIEW. There is no active task.
3. **Single next most important task:** Review `TASK-101 - Controlled movement planning vertical slice`.
4. **What the current scope must not change:** no generic command execution, no free-form parser, no arbitrary target input, no gameplay mutation beyond the accepted deterministic current-location movement slice, no inventory mutation, no dialogue progression, no use/effect execution, no replay runtime, no DB adapter, and no external or browser storage adapter may be introduced until later tasks explicitly accept them.
5. **How completion is recognized:** TASK-101 remains review-ready with a dedicated movement executor boundary, explicit exit-targeted `go` planning, deterministic current-location updates, prototype map highlight changes, preserved inventory/progress state, and no expansion into parser, storage, replay, or other gameplay systems.

## Repository / PR State

- Correct GitHub remote is configured:
  - `origin`: `https://github.com/DreddyCZE/narrative-engine.git`
- The old incorrect remote remains isolated and must not be used for pushes.
- PR #83 was merged into `origin/main` at merge commit `56165af`.
- TASK-100 is done.
- TASK-101 is in review.
- TASK-102 has not been created.
- No DB adapter, external storage adapter, replay runtime, browser storage, map editor, or plugin runtime task is active.

## Planning State

- M7 plan location: `docs/planning/M7_PRODUCTION_STORAGE_ADAPTER_REPLAY_BOUNDARY.md`.
- Replay plan location: `docs/planning/M7_REPLAY_BOUNDARY.md`.
- Save/load checkpoint: `docs/planning/M7_SAVE_LOAD_CHECKPOINT_AND_NEXT_SCOPE.md`.
- Replay checkpoint: `docs/planning/M7_REPLAY_BOUNDARY_CHECKPOINT_AND_NEXT_CONTRACT.md`.
- Replay contract closure checkpoint: `docs/planning/M7_REPLAY_CONTRACT_CHECKPOINT_AND_CLOSURE.md`.
- Content/runtime direction checkpoint: `docs/planning/CONTENT_RUNTIME_BOUNDARY_AND_PROTOTYPE_PATH.md`.
- Prototype checkpoint: `docs/planning/PROTOTYPE_MILESTONE_CHECKPOINT_AND_NEXT_GAMEPLAY_SCOPE.md`.
- Accepted:
  - `TASK-060 - Plan M7 Production Storage Adapter / Replay Boundary` DONE
  - `TASK-061 - Storage adapter interface contracts` DONE
  - `TASK-062 - Serialization and schema version contracts` DONE
  - `TASK-063 - File storage adapter boundary` DONE
  - `TASK-064 - Replay planning and contract boundary` DONE
  - `TASK-065 - Storage adapter conformance tests` DONE
  - `TASK-066 - Memory storage adapter conformance` DONE
  - `TASK-067 - Game state save load boundary` DONE
  - `TASK-068 - Minimal runtime game state save/load integration flow` DONE
  - `TASK-069 - Save slot manifest boundary` DONE
  - `TASK-070 - Save/load service facade` DONE
  - `TASK-071 - Save/load diagnostics and recovery policy` DONE
  - `TASK-072 - Save/load public scenario fixture` DONE
  - `TASK-073 - Save/load UI readiness gate` DONE
  - `TASK-074 - M7 save/load checkpoint and next-scope decision` DONE
  - `TASK-075 - Replay boundary checkpoint and next contract decision` DONE
  - `TASK-076 - Replay source descriptor conformance tests` DONE
  - `TASK-077 - Replay plan validation hardening` DONE
  - `TASK-078 - M7 replay contract checkpoint and closure decision` DONE
  - `TASK-079 - Content runtime boundary checkpoint and first prototype path` DONE
  - `TASK-080 - Minimal content package contract for P0 micro prototype` DONE
  - `TASK-081 - Minimal content package loader boundary` DONE
  - `TASK-082 - Runtime content read model boundary` DONE
  - `TASK-083 - Minimal runtime player state contract` DONE
  - `TASK-084 - Runtime command request validation boundary` DONE
  - `TASK-085 - Runtime command planning boundary` DONE
  - `TASK-086 - Read-only look command executor boundary` DONE
  - `TASK-087 - Read-only inventory command executor boundary` DONE
  - `TASK-088 - Read-only runtime command execution facade` DONE
  - `TASK-089 - Public read-only runtime smoke scenario` DONE
  - `TASK-090 - Read-only runtime request execution facade` DONE
  - `TASK-091 - Read-only runtime transcript scenario` DONE
  - `TASK-092 - UI-neutral read-only runtime presentation model` DONE
  - `TASK-093 - Public read-only presentation snapshot scenario` DONE
  - `TASK-094 - UI-neutral read-only input request contract` DONE
  - `TASK-095 - UI-neutral read-only interaction boundary` DONE
  - `TASK-096 - Read-only browser vertical slice prototype` DONE
  - `TASK-097 - Prototype command palette and disabled gameplay actions` DONE
  - `TASK-098 - Prototype read-only map/layout panel` DONE
  - `TASK-099 - Prototype data-driven scenario selector` DONE
  - `TASK-100 - Prototype milestone checkpoint and next gameplay-scope decision` DONE
- In review:
  - `TASK-101 - Controlled movement planning vertical slice`
- Next task after acceptance:
  - `TASK-102` not created

## Boundary Reminder

- Runtime host remains pure and in-memory except for the accepted read-only `look` and `inventory` boundaries plus the new dedicated movement executor boundary for planned `go` commands.
- File IO exists only in the explicit file storage adapter boundary.
- Memory storage adapter remains in-process and host-side-effect free.
- Save/load remains behind its public facade and diagnostics surface.
- Replay runtime remains deferred.
- Content data must remain separate from engine logic.
- Future UX must remain separate from content data.
- P0 story content must not be hardcoded into engine contracts.
- `apps/runtime` remains the accepted browser prototype consumer over public engine-contracts exports only.
- `Go` is now bound only to explicit exits already present in the current read model and does not accept arbitrary text.
- Scenario registry and map registry remain app-layer only.
- `Talk`, `Take`, `Use`, `Save`, and `Load` remain disabled local UI-only affordances.
- No DB adapter.
- No external or browser storage adapter.
- No map editor.
- No plugin runtime.

## Last Checks

- `corepack pnpm test -- tests/runtime-movement-command-executor-boundary.test.ts` - passed, 1 test file / 10 tests.
- `corepack pnpm --filter @narrative-engine/runtime-prototype test` - passed, 1 test file / 10 tests.
- `corepack pnpm --filter @narrative-engine/runtime-prototype build` - passed.
- `corepack pnpm test -- tests/runtime-command-planning-boundary.test.ts` - passed, 1 test file / 7 tests.
- `corepack pnpm test -- tests/runtime-command-request-boundary.test.ts` - passed, 1 test file / 6 tests.
- `corepack pnpm test -- tests/runtime-player-state-contract.test.ts` - passed, 1 test file / 5 tests.
- `corepack pnpm test -- tests/content-read-model-boundary.test.ts` - passed, 1 test file / 5 tests.
- `corepack pnpm test -- tests/content-package-loader-boundary.test.ts` - passed, 1 test file / 6 tests.
- `corepack pnpm test -- tests/content-package-contracts.test.ts` - passed, 1 test file / 6 tests.
- `corepack pnpm test` - passed, 74 test files / 708 tests.
- `corepack pnpm lint` - passed.
- `corepack pnpm typecheck` - passed.
- `corepack pnpm build` - passed.
- `corepack pnpm validate` - passed.
- `git diff --check` - passed.
- Known local environment warning remains: Node `v24.16.0` while the repo expects Node 22.

## Next Task Boundary

Review `TASK-101` next. Keep the work focused on the accepted controlled movement slice only. Do not introduce parser input, arbitrary targeting, item pickup, inventory mutation, dialogue progression, use/effect execution, save/load UI, replay runtime, DB integration, browser persistence, map editing, plugin runtime, or P0 story content in this step.