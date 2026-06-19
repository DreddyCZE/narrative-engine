# Handoff: TASK-016 Shared JSON-safe and Canonical Serialization Utilities

## Task

TASK-016 - Shared JSON-safe and Canonical Serialization Utilities

## Status

DONE

## Summary

Implemented the shared M2A foundation for JSON-safe value inspection, forbidden-key rejection,
prototype-pollution protection, canonical JSON serialization, and stable JSON path formatting.
The work is intentionally narrow and does not start the Entity Identity, Schema Versioning, Engine
State, Condition, Effect, Command, Transaction, Domain Event, Save, Event Store, UI, editor, or
plugin runtime tasks.

## Scope Delivered

- `packages/core/package.json`
- `packages/core/tsconfig.json`
- `packages/core/src/index.ts`
- `packages/core/src/json/json-safe.ts`
- `packages/core/src/json/canonicalize.ts`
- `packages/core/src/json/path.ts`
- `tests/core/json-safe.test.ts`
- `tsconfig.json`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/review/TASK-016-shared-json-safe-canonical-serialization-utilities.md`

## Key Decisions

- JSON-safe values are validated through explicit inspection helpers.
- Forbidden keys default to `__proto__`, `prototype`, and `constructor`.
- Canonical serialization sorts object keys lexicographically and preserves array order.
- The path helper emits JSON Pointer style paths for diagnostics.
- The new package is `packages/core`, kept isolated from docs, tests, and fixtures at runtime.

## Validation

- `corepack pnpm lint` - passed.
- `corepack pnpm typecheck` - passed.
- `corepack pnpm test` - passed, 281 tests.
- `corepack pnpm build` - passed.
- `corepack pnpm validate` - passed.
- `git diff --check` - passed.

Local note: the workstation is on Node `v24.16.0`, while the repository expects Node 22. The
warning is environment debt only because all checks passed.

## Outcome

Acceptance passed. `Active task` is now `none`, TASK-016 is DONE, and the next step is to create
and activate TASK-017 Entity Identity validator on the updated main branch.

## Next Recommended Task

- `TASK-017 - Entity Identity validator`

## Risks / Follow-up

- The implementation is intentionally minimal; later M2 tasks must not broaden it into a full
  runtime framework.
- `packages/core` is a new production package, so future package boundaries should continue to keep
  docs/tests/fixtures out of runtime imports.
- TASK-016 produced 281 passing tests after validation.
