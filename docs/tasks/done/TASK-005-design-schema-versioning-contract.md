# TASK-005 - Design Schema Versioning Contract

## ID

TASK-005

## Title

Design Schema Versioning Contract

## Milestone

M1 - Core Foundation

## Status

DONE

## Priority

P1

## Objective

Define the public, versioned Schema Versioning Contract that governs how serialized data schemas
declare, compare, migrate, deprecate, and publish `schemaVersion` values across engine contracts,
game data, plugins, saves, and validation tooling.

## Context

TASK-004 completed the draft Entity Identity Contract and established that `schemaVersion` is a
positive integer scoped to a concrete entity schema, separate from contract version, package
version, save format version, and content revision. TASK-005 must turn that local rule into a
project-wide contract without implementing a runtime registry, migration runner, save system, or
engine pipeline.

## Authoritative References

- `PROJECT_CHARTER.md`
- `AGENTS.md`
- `docs/spec/MASTER_SPEC.md`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`
- `docs/contracts/CONTRACT_VERSIONING_POLICY.md`
- `docs/contracts/ENTITY_IDENTITY_CONTRACT.md`
- `schemas/entity-identity.schema.json`
- `docs/handoffs/TASK-004-HANDOFF.md`

## Dependencies

- TASK-004 - Design Entity Identity Contract: DONE.

## Scope

- Define the meaning, ownership, comparison, compatibility, and migration implications of
  `schemaVersion`.
- Distinguish contract version, schema version, package version, engine version, game package
  version, save format version, plugin API version, and content revision.
- Define reader and writer compatibility behavior.
- Define machine-readable compatibility status values.
- Define migration descriptor metadata without implementing migrations.
- Define a future Schema Registry descriptor contract without implementing a runtime registry.
- Define deprecation and removal policy for published schema versions.
- Add JSON Schema for schema versioning descriptors.
- Add fixtures and contract tests proving the declared rules.
- Update only directly related governance status and contract inventory documents.

## Out of Scope

- Runtime Schema Registry implementation.
- Migration runner.
- Save migrations or save format implementation.
- Entity Registry.
- State Store.
- Condition Resolver.
- Effect Executor.
- Command or Transaction pipeline.
- Plugin loader.
- Editor UI.
- Game data editor.
- Automatic rewriting of game data.
- Downgrade export implementation.
- Networked schema registry.
- npm package publishing.

## Acceptance Criteria

- `docs/contracts/SCHEMA_VERSIONING_CONTRACT.md` defines the public draft contract with status,
  contract ID, contract version, owner, purpose, terminology, version taxonomy, schema version
  rules, compatibility model, reader/writer policy, change classification, migration metadata,
  registry descriptor rules, deprecation policy, determinism, security, examples, known limits, and
  deferred decisions.
- `schemas/schema-versioning.schema.json` validates schema descriptor, reader support, writer
  version, migration descriptor, and status shape with stable `$schema`, `$id`,
  `additionalProperties: false`, bounded lengths/counts, and positive integer versions.
- Fixtures under `tests/fixtures/contracts/schema-versioning/` include valid, invalid, and
  semantic-invalid examples required by the task.
- `tests/schema-versioning-contract.test.ts` proves real contract rules, including fixture validity,
  semantic graph checks, monotonic integer versions, reader/writer consistency, migration direction,
  stable serialization, and compatibility with Entity Identity `schemaVersion`.
- `CONTRACT_INVENTORY.md` updates only the Schema Versioning Contract entry to reference the new
  draft artifacts and status.
- No runtime registry, migration engine, save system, or unrelated engine implementation is added.
- TASK-005 ends in `REVIEW`, with no ACTIVE task left.

## Required Tests and Fixtures

Valid fixtures:

- schema version 1
- exact reader support
- reader range support
- current writer version
- deterministic upgrade migration
- explicitly lossy migration
- deprecated schema descriptor

Invalid fixtures:

- schemaVersion 0
- negative schemaVersion
- decimal schemaVersion
- string schemaVersion
- reader minimum greater than maximum
- writer outside supported range
- migration with identical source and target versions
- downgrade represented as upgrade
- unknown field
- missing schema ID
- invalid status
- lossy migration without explicit loss description

Semantic-invalid fixtures:

- migration cycle
- missing upgrade step
- duplicate schema ID and version
- reused version with different hash or meaning

## Allowed Files

- `docs/contracts/SCHEMA_VERSIONING_CONTRACT.md`
- `schemas/schema-versioning.schema.json`
- `tests/schema-versioning-contract.test.ts`
- `tests/fixtures/contracts/schema-versioning/**`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`, only if a real ordering error is found
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/active/TASK-005-design-schema-versioning-contract.md`
- `docs/tasks/review/TASK-005-design-schema-versioning-contract.md`
- `docs/handoffs/TASK-005-HANDOFF.md`
- Test-scoped support utilities, only if needed

## Forbidden Changes

- Do not change Entity Identity Contract unless a concrete contradiction is found.
- Do not create a new ADR unless the work reveals a real architectural conflict.
- Do not create runtime migration, registry, save, state, command, transaction, plugin, editor, or
  UI implementation.
- Do not start another contract task.
- Do not change Node, pnpm, workspace, or framework choices.

## Risks

- Confusing `schemaVersion` with contract, package, save, plugin API, or content revision.
- Encoding migration implementation details into a design-only contract.
- Treating future Schema Registry descriptors as an implemented runtime registry.
- Overstating JSON Schema coverage for semantic graph constraints.
- Creating too-wide M1 scope by mixing contract design and engine implementation.

## Migration Impact

The task defines migration metadata and compatibility policy only. It does not migrate existing data.
Future incompatible schema changes must follow `CONTRACT_VERSIONING_POLICY.md` and this contract.

## Output Artifacts

- `docs/contracts/SCHEMA_VERSIONING_CONTRACT.md`
- `schemas/schema-versioning.schema.json`
- `tests/schema-versioning-contract.test.ts`
- `tests/fixtures/contracts/schema-versioning/**`
- Updated `docs/contracts/CONTRACT_INVENTORY.md`
- Updated `docs/status/CURRENT_STATE.md`
- `docs/handoffs/TASK-005-HANDOFF.md`

## Required Checks

- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm build`
- `corepack pnpm check:boundaries`
- `corepack pnpm validate`
- `git diff --check`

## Definition of Done

- All acceptance criteria are met.
- Required checks pass.
- TASK-005 is moved to `docs/tasks/review/` with status `REVIEW`.
- `docs/handoffs/TASK-005-HANDOFF.md` summarizes decisions, fixtures, tests, limits, and next step.
- `docs/status/CURRENT_STATE.md` records no ACTIVE task and recommends review of TASK-005.
- No commit is created.
