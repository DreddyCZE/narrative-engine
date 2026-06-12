# Current State

**Date:** 2026-06-12  
**Milestone:** M0 - Governance and Contracts  
**Active task:** TASK-001 - repository and workspace foundation  
**Status:** M0 bootstrap completed; TASK-001 ready for review.

## Five Questions

1. **Current milestone:** M0 - Governance and Contracts.
2. **Current state:** Repository skeleton, governance documents, initial ADR, M0 task queue,
   TypeScript workspace, validation script, and CI workflow are in place.
3. **Single next most important task:** TASK-002 - core contract inventory.
4. **What the next task must not change:** It must not implement runtime UI, editor UI, concrete
   game content, genre-specific mechanics, or public contract behavior beyond inventory documents.
5. **How done is recognized:** `docs/contracts` contains a reviewed inventory of initial public
   contracts, ownership, versioning expectations, and open ADR needs.

## Notes

- Git is the canonical source of project truth.
- The repository is greenfield and must remain independent from existing game projects.
- Runtime and editor framework choices are intentionally deferred.

## Last Checks

- `pnpm lint` - passed on 2026-06-12.
- `pnpm typecheck` - passed on 2026-06-12.
- `pnpm test` - passed on 2026-06-12.
- `pnpm build` - passed on 2026-06-12.
- `pnpm validate` - passed on 2026-06-12.

Local note: checks were run through `corepack pnpm` because `pnpm` was not directly available in
PATH. The local Node runtime was `v24.16.0`, so pnpm emitted an engine warning; CI is pinned to
Node 22 via `.nvmrc`.

