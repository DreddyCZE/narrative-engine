# TASK-001: Repository and Workspace Foundation

## Milestone

M0 - Governance and Contracts

## Status

DONE

## Objective

Create the greenfield repository structure, package workspace, baseline checks, CI workflow, and
initial governance files required before broader implementation.

## Scope

- Initialize Git repository.
- Add required directory structure.
- Add pnpm, TypeScript, ESLint, Prettier, Vitest, and validation skeleton.
- Add CI workflow for install, lint, typecheck, test, build, and validate.
- Add governance and status documents.
- Add initial ADR and M0 task queue.

## Out of Scope

- Runtime UI.
- Editor UI.
- Concrete game data.
- Quest, inventory, NPC, map, minigame, backend, save system, or plugin marketplace.
- Runtime or editor framework selection.

## Acceptance Criteria

- Required files and directories exist.
- Exactly one task is active.
- All required checks pass.
- Independence validation passes on tracked files.
- Handoff is created.

## Required Checks

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm validate`

## Closure

Closed by commit `2849bb8 chore(repo): bootstrap narrative engine governance`.

