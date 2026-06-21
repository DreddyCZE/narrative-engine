# TASK-028 HANDOFF

## Status

DONE

## Acceptance

Accepted on `main` after PR #15 merged and acceptance validation passed.

## Summary

TASK-028 adds the M3 planning document for Data Model / Content Runtime Boundary. The work stays in
planning and documentation scope only. It defines M3 goals, architecture boundaries, content
package structure, validation flow, loader boundary, test strategy, task breakdown, risks, and
explicit non-goals without adding runtime implementation.

## Changed Files

- `docs/handoffs/TASK-027-HANDOFF.md`
- `docs/handoffs/TASK-028-HANDOFF.md`
- `docs/planning/M3_DATA_MODEL_CONTENT_RUNTIME_BOUNDARY.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-027-m2-gate-review.md`
- `docs/tasks/review/TASK-028-plan-m3-data-model-content-runtime-boundary.md`

## M3 Plan Location

- `docs/planning/M3_DATA_MODEL_CONTENT_RUNTIME_BOUNDARY.md`

## Proposed Task Breakdown

- `TASK-029 - Define M3 content package contract`
- `TASK-030 - Content schema and version manifest`
- `TASK-031 - Content validation diagnostic adapters`
- `TASK-032 - Cross-reference validation for content packages`
- `TASK-033 - Minimal neutral content package fixture`
- `TASK-034 - Loader boundary and validated content graph contract`
- `TASK-035 - Content package integration with M2 primitives`
- `TASK-036 - M3 gate review`

## Non-Goals

- no new runtime code
- no loader implementation
- no Event Store
- no Save system
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime

## Risks / Open Questions

- content model breadth versus maintainability
- preventing concrete game hardcoding in shared packages
- single-package versus multi-package content layout
- localization and text validation before UI exists
- asset references before an asset pipeline exists
- later Save/Event Store integration without rewriting M3 boundaries

## Validation

- `corepack pnpm lint` - pass
- `corepack pnpm typecheck` - pass
- `corepack pnpm test` - pass, 22 test files / 381 tests
- `corepack pnpm build` - pass
- `corepack pnpm validate` - pass
- `git diff --check` - pass

## Next Recommended Task

- `TASK-029 - Define M3 content package contract`

## Active Task

none
