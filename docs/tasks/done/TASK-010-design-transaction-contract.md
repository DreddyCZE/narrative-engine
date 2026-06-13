# TASK-010 - Design Transaction Contract

## ID

TASK-010

## Title

Design Transaction Contract

## Milestone

M1 - Core Foundation

## Status

DONE

## Priority

P1

## Objective

Design a public, versioned Transaction Contract that atomically applies an ordered Effect plan to a
working or candidate Engine State, validates the candidate result, and either commits a new
committed state or rolls back without mutating the original committed state.

## Context

Transaction is the atomic boundary between ordered Effect application and a committed Engine State.
It must stay declarative and deterministic while leaving Command planning, Domain Event emission,
and save persistence to future contracts.

## Authoritative References

- `PROJECT_CHARTER.md`
- `AGENTS.md`
- `docs/spec/MASTER_SPEC.md`
- `docs/roadmap/ROADMAP.md`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`
- `docs/contracts/CONTRACT_VERSIONING_POLICY.md`
- `docs/contracts/ENTITY_IDENTITY_CONTRACT.md`
- `docs/contracts/SCHEMA_VERSIONING_CONTRACT.md`
- `docs/contracts/ENGINE_STATE_CONTRACT.md`
- `docs/contracts/CONDITION_CONTRACT.md`
- `docs/contracts/EFFECT_CONTRACT.md`
- `docs/contracts/COMMAND_CONTRACT.md`
- `schemas/entity-identity.schema.json`
- `schemas/schema-versioning.schema.json`
- `schemas/engine-state.schema.json`
- `schemas/condition.schema.json`
- `schemas/effect.schema.json`
- `schemas/command.schema.json`
- `docs/handoffs/TASK-004-HANDOFF.md`
- `docs/handoffs/TASK-005-HANDOFF.md`
- `docs/handoffs/TASK-006-HANDOFF.md`
- `docs/handoffs/TASK-007-HANDOFF.md`
- `docs/handoffs/TASK-008-HANDOFF.md`
- `docs/handoffs/TASK-009-HANDOFF.md`

## Dependencies

- TASK-004 - Design Entity Identity Contract
- TASK-005 - Design Schema Versioning Contract
- TASK-006 - Design Engine State Contract
- TASK-007 - Design Condition Contract
- TASK-008 - Design Effect Contract
- TASK-009 - Design Command Contract

## Scope

- Define the Transaction input envelope, lifecycle, revision policy, atomicity policy, effect
  ordering, validation layers, rollback behavior, no-op policy, idempotence boundary, and result
  model.
- Define the boundary between Command Plan, Effect, Transaction, Domain Event, and Save.
- Provide a transaction contract document, schema, fixtures, tests, inventory updates, current-state
  updates, and a handoff.

## Out of Scope

- Production Transaction Manager, State Store, Command Bus, Effect Executor, Event Store, or Save
  system.
- Domain Event schema or event emission implementation.
- Command planning, handler registry, authorization implementation, or replay storage.
- Plugin lifecycle logic or scheduler implementation.

## Acceptance Criteria

- The contract document clearly separates Transaction from Command, Effect, Domain Event, and Save.
- The contract documents the input envelope, lifecycle, revision policy, atomicity policy, effect
  ordering, validation layers, protected metadata, no-op policy, concurrency model, idempotence
  boundary, event boundary, save boundary, determinism, and deferred decisions.
- The schema validates the transaction envelope, base revision, ordered effects, source metadata,
  optional transaction identity, and JSON-safe transaction metadata.
- Valid fixtures, invalid fixtures, semantic-invalid fixtures, and runtime-invalid fixtures exist and
  are exercised by tests.
- Tests prove deterministic application order, rollback on failure, candidate validation, revision
  handling, no-op handling, immutable committed input, canonical serialization, and regression
  compatibility with prior contracts.

## Required Fixtures and Tests

- Valid fixtures for single-effect transaction, multi-effect ordered transaction, baseRevision `0`,
  command-plan source, system source, no-op transaction, transaction with transactionId, and
  transaction without transactionId.
- Invalid fixtures for missing or invalid schemaVersion, invalid transactionId, negative or decimal
  baseRevision, invalid or unordered effects, unknown root field, executable field, invalid effect
  shape, oversized effect list, and invalid source.
- Semantic-invalid fixtures for revision conflict, unknown effect type, effect error, guard error,
  candidate state invalid, protected metadata mutation, access denied, transaction budget exceeded,
  duplicate transactionId with conflicting input, no-op plan not allowed, effect order ambiguity, and
  unsupported schema version.
- Runtime-invalid fixtures for function, Date, Map, Set, NaN, Infinity, cyclic object, and forbidden
  nested key values.
- Tests for rollback atomicity, ordered effect application, candidate validation, revision conflict
  handling, no-op policy, duplicate transaction handling, canonical serialization, and regression
  consistency with prior contracts.

## Allowed Files

- `docs/contracts/TRANSACTION_CONTRACT.md`
- `schemas/transaction.schema.json`
- `tests/transaction-contract.test.ts`
- `tests/fixtures/contracts/transaction/**`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/active/TASK-010-design-transaction-contract.md`
- `docs/tasks/ready/TASK-010-design-transaction-contract.md`
- `docs/tasks/review/TASK-010-design-transaction-contract.md`
- `docs/tasks/done/TASK-010-design-transaction-contract.md`
- `docs/handoffs/TASK-010-HANDOFF.md`

## Forbidden Changes

- Production Transaction Manager, State Store, Command Bus, Effect Executor, Event Store, or Save
  implementations.
- Unrelated subsystems or executable code paths.
- Changes to prior contracts unless a real cross-contract conflict is discovered.

## Risks

- A too-permissive transaction envelope could hide candidate validation mistakes.
- Treating revision conflicts as successful retries would weaken optimistic concurrency.
- Allowing partial commits would violate the atomic boundary and corrupt state.
- Overloading transaction identity or idempotence metadata would make replay behavior ambiguous.

## Compatibility and Migration Impact

- Breaking changes require a new Transaction Contract version and updated schema/fixtures.
- New transaction input forms must preserve deterministic ordered effect application and atomic
  rollback semantics.
- The transaction boundary must remain compatible with future Domain Event and Save contracts.

## Output Artifacts

- Transaction contract document.
- Transaction JSON Schema.
- Contract fixtures.
- Contract tests.
- Updated inventory and current state.
- Handoff for TASK-010.

## Definition of Done

- All acceptance criteria are met.
- Required checks pass.
- TASK-010 is moved to `docs/tasks/active/` with status `ACTIVE`.
- The handoff documents the design decisions and known limits.
