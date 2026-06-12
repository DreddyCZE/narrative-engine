# Handoff: TASK-001 Repository and Workspace Foundation

## Task

TASK-001 - repository and workspace foundation

## Summary

Bootstrapped the greenfield repository for M0. Added governance documents, task flow, initial ADR,
neutralized master specification copy, TypeScript workspace skeleton, validation script, CI
workflow, and minimal test coverage.

## Files Changed

- Root governance and workspace files.
- `docs/spec/MASTER_SPEC.md` as a neutralized copy of the provided specification.
- M0 roadmap, status, risk, tech debt, task, idea, ADR, and handoff documents.
- Initial package skeletons under `packages`.
- CI workflow under `.github/workflows/ci.yml`.

## Checks

- `corepack pnpm lint` - passed.
- `corepack pnpm typecheck` - passed.
- `corepack pnpm test` - passed.
- `corepack pnpm build` - passed.
- `corepack pnpm validate` - passed.

## Decisions

- Runtime and editor UI frameworks remain intentionally undecided.
- The repository is greenfield and prohibits copying existing game content or source.
- Validation runs against tracked files and permits legacy terms only inside enforcement or
  explanatory governance text.

## Known Limits

- Package implementation is skeleton-only.
- Contract inventory is seeded in code but not yet documented in `docs/contracts`.
- Full architecture boundary validation is deferred to TASK-003.
- Local checks used Node `v24.16.0`; project and CI target Node 22.

## Recommended Next Task

TASK-002 - core contract inventory.

