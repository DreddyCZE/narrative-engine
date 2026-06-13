# TASK-004: Design Entity Identity Contract

## Milestone

M1 - Core Foundation

## Status

DONE

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

## Dependencies

- `PROJECT_CHARTER.md`
- `docs/spec/MASTER_SPEC.md`
- `docs/adr/ADR-0001-greenfield-independence-and-layer-boundaries.md`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`
- `docs/contracts/CONTRACT_VERSIONING_POLICY.md`
- `docs/reports/M0-GATE-D-REVIEW.md`

## Allowed Files

- `docs/contracts/ENTITY_IDENTITY_CONTRACT.md`
- `schemas/entity-identity.schema.json`
- `tests/fixtures/contracts/entity-identity/**`
- `tests/entity-identity-contract.test.ts`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/active/TASK-004-design-entity-identity-contract.md`
- `docs/tasks/review/TASK-004-design-entity-identity-contract.md`
- `docs/handoffs/TASK-004-HANDOFF.md`

## Forbidden Changes

- Do not implement runtime Entity Registry.
- Do not implement State Store, Condition Resolver, Effect Executor, Command pipeline, Transaction
  pipeline, Event Log, Scheduler, Save migration, plugin lifecycle, runtime UI, or editor UI.
- Do not create concrete game entities or game-specific namespaces.
- Do not change unrelated contracts beyond the inventory status/link for Entity Identity.
- Do not add external validation dependencies unless a concrete need is documented.

## Migration Impact

This task defines a new draft public contract. It does not migrate existing canonical data or saves.
The design identifies future migration implications for published IDs, aliases, references, schema
versions, saves, and event records.

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

## Definition of Done

- TASK-004 is moved to `done`.
- `docs/contracts/ENTITY_IDENTITY_CONTRACT.md` exists and covers all required design questions.
- `schemas/entity-identity.schema.json` validates the basic contract shape.
- Required valid and invalid fixtures exist under `tests/fixtures/contracts/entity-identity`.
- Contract tests prove core rules rather than only file existence.
- `CONTRACT_INVENTORY.md` reflects Entity Identity as drafted and links the contract document.
- `CURRENT_STATE.md` is updated and no active task remains.
- `docs/handoffs/TASK-004-HANDOFF.md` exists.
- All required checks pass.

## Required Checks

- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm build`
- `corepack pnpm check:boundaries`
- `corepack pnpm validate`

## Handoff

`docs/handoffs/TASK-004-HANDOFF.md`
