# Current State

**Date:** 2026-07-13
**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Active task:** none
**Status:** TASK-037 through TASK-089 are DONE or REVIEW. TASK-060 through TASK-088 are DONE. TASK-089 is REVIEW. M2 gate verdict is `M2_GATE_PASS_WITH_DEFERRED_ITEMS`. M3 gate verdict is `M3_GATE_PASS_WITH_DEFERRED_ITEMS`. M4 gate verdict is `M4_GATE_PASS_WITH_DEFERRED_ITEMS`. M5 gate verdict is `M5_GATE_PASS_WITH_DEFERRED_ITEMS`. M6 gate verdict is `M6_GATE_PASS_WITH_DEFERRED_ITEMS`.

## Current Workflow

1. **Current milestone:** M7 Production Storage Adapter / Replay Boundary.
2. **Current state:** TASK-088 is DONE. TASK-089 is REVIEW. There is no active task.
3. **Single next most important task:** Review `TASK-089 - Public read-only runtime smoke scenario`.
4. **What the current scope must not change:** no generic command execution, no gameplay mutation, no next-state generation, no UI/editor, no replay runtime, no DB adapter, and no external storage adapter may be introduced until later tasks explicitly accept them.
5. **How completion is recognized:** TASK-089 remains review-ready with a deterministic public smoke package and end-to-end read-only smoke result that exercises only `look` and `inventory` with no mutation or next-state behavior.

## Repository / PR State

- Correct GitHub remote is configured:
  - `origin`: `https://github.com/DreddyCZE/narrative-engine.git`
- The old incorrect remote remains isolated and must not be used for pushes.
- PR #47 was merged into `origin/main` at merge commit `28827e6`.
- PR #48 was merged into `origin/main` at merge commit `4adca9f`.
- PR #49 was merged into `origin/main` at merge commit `a2854b4`.
- PR #50 was merged into `origin/main` at merge commit `d2fb102`.
- PR #51 was merged into `origin/main` at merge commit `8f8539b`.
- PR #52 was merged into `origin/main` at merge commit `1df1b6a`.
- PR #53 was merged into `origin/main` at merge commit `f4ba2fb`.
- PR #54 was merged into `origin/main` at merge commit `8db7197`.
- PR #55 was merged into `origin/main` at merge commit `8e2ad13`.
- PR #56 was merged into `origin/main` at merge commit `6d0c976`.
- PR #57 was merged into `origin/main` at merge commit `e679fb7`.
- PR #58 was merged into `origin/main` at merge commit `68f2a38`.
- PR #59 was merged into `origin/main` at merge commit `2c33133`.
- PR #60 was merged into `origin/main` at merge commit `652dbf9`.
- PR #61 was merged into `origin/main` at merge commit `3f86137`.
- PR #62 was merged into `origin/main` at merge commit `cf135ff`.
- PR #63 was merged into `origin/main` at merge commit `73aec38`.
- PR #64 was merged into `origin/main` at merge commit `1c6f034`.
- PR #65 was merged into `origin/main` at merge commit `afd8d68`.
- PR #66 was merged into `origin/main` at merge commit `2cc7c74`.
- PR #67 was merged into `origin/main` at merge commit `e1ada8b`.
- PR #68 was merged into `origin/main` at merge commit `4c7978a`.
- PR #69 was merged into `origin/main` at merge commit `9846803`.
- PR #70 was merged into `origin/main` at merge commit `6d9c566`.
- PR #71 was merged into `origin/main` at merge commit `56968b0`.
- TASK-053 is done.
- TASK-054 is done.
- TASK-055 is done.
- TASK-056 is done.
- TASK-057 is done.
- TASK-058 is done.
- TASK-059 is done.
- TASK-060 is done.
- TASK-061 is done.
- TASK-062 is done.
- TASK-063 is done.
- TASK-064 is done.
- TASK-065 is done.
- TASK-066 is done.
- TASK-067 is done.
- TASK-068 is done.
- TASK-069 is done.
- TASK-070 is done.
- TASK-071 is done.
- TASK-072 is done.
- TASK-073 is done.
- TASK-074 is done.
- TASK-075 is done.
- TASK-076 is done.
- TASK-077 is done.
- TASK-078 is done.
- TASK-079 is done.
- TASK-080 is done.
- TASK-081 is done.
- TASK-082 is done.
- TASK-083 is done.
- TASK-084 is done.
- TASK-085 is done.
- TASK-086 is done.
- TASK-087 is done.
- TASK-088 is done.
- TASK-089 is in review.
- TASK-090 has not been created.
- No DB adapter, external storage adapter, replay runtime, UI, gameplay, or plugin implementation task is active.

## Planning State

- M7 plan location: `docs/planning/M7_PRODUCTION_STORAGE_ADAPTER_REPLAY_BOUNDARY.md`.
- Replay plan location: `docs/planning/M7_REPLAY_BOUNDARY.md`.
- Save/load checkpoint: `docs/planning/M7_SAVE_LOAD_CHECKPOINT_AND_NEXT_SCOPE.md`.
- Replay checkpoint: `docs/planning/M7_REPLAY_BOUNDARY_CHECKPOINT_AND_NEXT_CONTRACT.md`.
- Replay contract closure checkpoint: `docs/planning/M7_REPLAY_CONTRACT_CHECKPOINT_AND_CLOSURE.md`.
- Content/runtime direction checkpoint: `docs/planning/CONTENT_RUNTIME_BOUNDARY_AND_PROTOTYPE_PATH.md`.
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
- In review:
  - `TASK-089 - Public read-only runtime smoke scenario`
- Next task after acceptance:
  - `TASK-090` not created

## Boundary Reminder

- Runtime host remains pure and in-memory except for the intentionally read-only `look`, `inventory`, facade, and public smoke scenario boundaries.
- File IO exists only in the explicit file storage adapter boundary.
- Memory storage adapter remains in-process and host-side-effect free.
- Save/load remains behind its public facade and diagnostics surface.
- Replay runtime remains deferred.
- Content data must remain separate from engine logic.
- Future UX must remain separate from content data.
- P0 story content must not be hardcoded into engine contracts.
- TASK-089 adds only a public read-only smoke scenario that runs the accepted loader, read model, player-state, planning, and read-only facade boundaries for `look` and `inventory`.
- TASK-089 does not execute `go`, `talk`, `take`, `use`, `save`, or `load`, and does not mutate gameplay state or generate next state.
- No DB adapter.
- No external storage adapter.
- No plugin runtime.

## Last Checks

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
- `corepack pnpm test` - passed, 66 test files / 643 tests.
- `corepack pnpm lint` - passed.
- `corepack pnpm typecheck` - passed.
- `corepack pnpm build` - passed.
- `corepack pnpm validate` - passed.
- `git diff --check` - passed.
- Known local environment warning remains: Node `v24.16.0` while the repo expects Node 22.

## Next Task Boundary

Review `TASK-089` next. Keep the work focused on the public read-only smoke scenario for only `look` and `inventory`. Do not introduce generic mutable command execution, gameplay mutation, next-state generation, gameplay content packages, UI/editor, replay runtime, DB adapters, or external storage in this step.
