# TASK-004: Design Entity Identity Contract

## Milestone

M1 - Core Foundation

## Status

READY

## Objective

Design the Entity Identity Contract as the first M1 contract. This is a contract design task only,
not an engine implementation task.

## Scope

- Define stable ID format and namespace rules.
- Define supported entity type markers.
- Define schema version metadata required on identity-bearing records.
- Define tags and their intended validation behavior.
- Define source provenance linkage required by identity records.
- Define change metadata for authorship, task, commit, and approval state.
- Define alias records and compatibility rules.
- Define published ID rename rules.
- Define validation diagnostics for malformed IDs, collisions, aliases, and unsupported versions.
- Define serialization expectations for canonical files and fixtures.
- Define contract fixtures:
  - minimal valid identity,
  - representative valid identity,
  - invalid ID syntax,
  - duplicate ID,
  - alias to missing target,
  - renamed published ID with valid alias,
  - incompatible schema version.
- Define compatibility expectations with Schema Versioning, Source Provenance, Validation
  Diagnostic, Game Data Schema, Engine State, Event, Save, and Migration contracts.

## Out of Scope

- Runtime registry implementation.
- State Store implementation.
- Condition Resolver.
- Effect Executor.
- Concrete game entities.
- Editor UI.
- Save migration implementation.
- Runtime loading or command pipeline implementation.

## Acceptance Criteria

- `docs/contracts` contains a draft Entity Identity Contract document.
- The draft defines ID format, entity type, schema version, tags, provenance, change metadata,
  aliases, rename rules, validation, serialization, fixtures, and compatibility.
- The draft clearly distinguishes public contract requirements from future implementation.
- Required fixture names and purposes are documented.
- No engine runtime system is implemented.
- Required checks pass.

## Required Checks

- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm build`
- `corepack pnpm check:boundaries`
- `corepack pnpm validate`

## Handoff

Create `docs/handoffs/TASK-004-HANDOFF.md` when the task is complete.
