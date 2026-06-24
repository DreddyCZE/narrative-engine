# TASK-041 HANDOFF

## Status

DONE

## Summary

TASK-041 adds pure data-only reference validation over caller-provided content package data and the
TASK-040 ID index and is now accepted on `main`. The implementation extracts known reference fields
from the neutral content fixture shape, validates missing targets and wrong target sections,
reports unsupported reference kinds deterministically, and preserves input and ID index
immutability. The work stays below external dependency loading, runtime graph construction, and M2
primitive semantic validation.

## Changed Files

- `docs/contracts/CONTENT_LOADER_BOUNDARY.md`
- `docs/handoffs/TASK-041-HANDOFF.md`
- `docs/planning/M4_CONTENT_LOADER_VALIDATION_IMPLEMENTATION.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-041-reference-validation-implementation.md`
- `packages/engine-kernel/src/content-loader/reference-validation.ts`
- `packages/engine-kernel/src/index.ts`
- `tests/content-loader-reference-validation.test.ts`

## Production Function Location

- `packages/engine-kernel/src/content-loader/reference-validation.ts`
- `packages/engine-kernel/src/index.ts`

## Test Location

- `tests/content-loader-reference-validation.test.ts`

## Supported Reference Validations

- reference extraction from known fixture-aligned content shapes
- missing target diagnostics against the TASK-040 ID index
- wrong target section diagnostics when a field expects a specific section
- unsupported reference kind diagnostics for known reference fields
- deterministic diagnostic ordering
- stable reference paths
- input immutability
- ID index immutability

## Unsupported / Deferred Validations

- no file IO
- no production loader orchestration
- no external dependency package loading
- no runtime content graph builder
- no M2 primitive semantic validation
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
- no runtime host

## Validation

- `corepack pnpm test -- tests/content-loader-reference-validation.test.ts`
- `corepack pnpm test -- tests/content-loader-id-indexing.test.ts`
- `corepack pnpm test -- tests/content-loader-manifest-section-validation.test.ts`
- `corepack pnpm test -- tests/content-loader-input-result-types.test.ts`
- `corepack pnpm test -- tests/minimal-neutral-content-package-fixture.test.ts`
- `corepack pnpm test -- tests/content-m2-primitive-integration.test.ts`
- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm test` - 28 test files / 412 tests
- `corepack pnpm build`
- `corepack pnpm validate`
- `git diff --check`

## Acceptance

- acceptance passed on `main`

## Non-Goals

- no file IO
- no production loader orchestration
- no external dependency package loading
- no runtime content graph builder
- no M2 primitive semantic validation
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
- no runtime host

## Risks / Open Questions

- reference field coverage is intentionally limited to known neutral fixture and contract shapes
- future dependency-package references will need an explicit data-only boundary without implicit
  loading
- later M4 tasks must keep semantic primitive validation separate from basic target existence checks

## Next Recommended Task

- `TASK-042 - M2 primitive binding validation implementation`

## Active Task

none
