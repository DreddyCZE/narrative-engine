# TASK-037 HANDOFF

## Status

REVIEW

## Summary

TASK-037 adds the M4 planning document for Content Loader / Validation Implementation. The work
stays in planning and documentation scope only. It defines the M4 goal, architecture boundaries,
validation stages, implementation boundaries, likely package areas, test strategy, task breakdown,
risks, and explicit non-goals without introducing loader or runtime implementation.

## Changed Files

- `docs/handoffs/TASK-036-HANDOFF.md`
- `docs/handoffs/TASK-037-HANDOFF.md`
- `docs/planning/M3_DATA_MODEL_CONTENT_RUNTIME_BOUNDARY.md`
- `docs/planning/M4_CONTENT_LOADER_VALIDATION_IMPLEMENTATION.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-036-m3-gate-review.md`
- `docs/tasks/review/TASK-037-plan-m4-content-loader-validation.md`

## M4 Plan Location

- `docs/planning/M4_CONTENT_LOADER_VALIDATION_IMPLEMENTATION.md`

## Proposed Task Breakdown

- `TASK-038 - Content loader input/result types`
- `TASK-039 - Manifest and section validation implementation`
- `TASK-040 - Content ID indexing and duplicate detection`
- `TASK-041 - Reference validation implementation`
- `TASK-042 - M2 primitive binding validation implementation`
- `TASK-043 - Validated content graph value builder`
- `TASK-044 - Minimal fixture loader boundary integration test`
- `TASK-045 - M4 gate review`

## Non-Goals

- no production loader implementation
- no runtime content graph resolver
- no schema validation engine
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime

## Risks / Open Questions

- exact ownership split between contracts and kernel helpers is still open
- dependency package handling without file IO still needs a concrete later design
- the loader boundary must not drift into a runtime host
- schema validation depth may need careful phasing across M4 tasks
- later Save/Event Store attachment still requires discipline to preserve boundary purity

## Validation

- `corepack pnpm test -- tests/minimal-neutral-content-package-fixture.test.ts`
- `corepack pnpm test -- tests/content-m2-primitive-integration.test.ts`
- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm build`
- `corepack pnpm validate`
- `git diff --check`

## Next Recommended Task

- `TASK-038 - Content loader input/result types`

## Active Task

none
