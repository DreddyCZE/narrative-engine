# Current State

**Date:** 2026-06-13
**Milestone:** M1 - Core Foundation
**Active task:** none
**Status:** TASK-006 is done. It is a design-only contract task for Engine State.

## Five Questions

1. **Current milestone:** M1 - Core Foundation.
2. **Current state:** TASK-004 produced and reviewed a draft Entity Identity Contract. TASK-005
   produced a draft Schema Versioning Contract, descriptor schema, fixtures, and contract tests.
   TASK-006 is now defining the Engine State Contract.
3. **Single next most important task:** Create the precise Condition Contract task.
4. **What the next task must not change:** It must not implement runtime registries, State Store,
   Condition Resolver, Effect Executor, concrete game entities, editor UI, or save migration code.
5. **How done is recognized:** The Engine State Contract document, schema, fixtures, and tests
   exist; TASK-006 is done; and no ACTIVE task remains.

## Notes

- Git is the canonical source of project truth.
- The repository is greenfield and must remain independent from existing game projects.
- Runtime and editor framework choices are intentionally deferred.

## Last Checks

- `corepack pnpm lint` - passed on 2026-06-13.
- `corepack pnpm typecheck` - passed on 2026-06-13.
- `corepack pnpm test` - passed on 2026-06-13.
- `corepack pnpm build` - passed on 2026-06-13.
- `corepack pnpm check:boundaries` - passed on 2026-06-13.
- `corepack pnpm validate` - passed on 2026-06-13.

Local note: checks were run through `corepack pnpm` because `pnpm` was not directly available in
PATH. The local Node runtime was `v24.16.0`, so pnpm emitted an engine warning; CI is pinned to
Node 22 via `.nvmrc`.

## Next Task Boundary

Do not start another contract task or M1 implementation work.
