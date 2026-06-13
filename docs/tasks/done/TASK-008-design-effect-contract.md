# TASK-008 - Design Effect Contract

## ID

TASK-008

## Title

Design Effect Contract

## Milestone

M1 - Core Foundation

## Status

DONE

## Priority

P1

## Objective

Design a public, versioned, deterministic Effect Contract that describes candidate state changes as
serializable data and remains strictly separate from command intent, transaction orchestration, and
confirmed domain events.

## Context

Effects are the declarative mutation primitives that will later be assembled and committed by
Transaction logic. The contract must support guarded state changes without introducing a production
executor, transaction manager, or commit semantics.

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
- `schemas/entity-identity.schema.json`
- `schemas/schema-versioning.schema.json`
- `schemas/engine-state.schema.json`
- `schemas/condition.schema.json`
- `docs/handoffs/TASK-004-HANDOFF.md`
- `docs/handoffs/TASK-005-HANDOFF.md`
- `docs/handoffs/TASK-006-HANDOFF.md`
- `docs/handoffs/TASK-007-HANDOFF.md`

## Dependencies

- TASK-004 - Design Entity Identity Contract
- TASK-005 - Design Schema Versioning Contract
- TASK-006 - Design Engine State Contract
- TASK-007 - Design Condition Contract

## Scope

- Define a declarative Effect Contract for candidate state mutation.
- Define the effect envelope, target model, guard policy, result model, value model, and no-op policy.
- Define a limited, safe set of atomic Effect types suitable for M1.
- Define canonical serialization, diagnostic categories, evaluation budgets, and access boundaries.
- Provide contract documentation, schema, fixtures, tests, inventory updates, and a handoff.

## Out of Scope

- Production Effect Executor, Transaction Manager, Command pipeline, State Store, or Domain Event system.
- Commit, rollback, revision ownership, and transaction sequencing semantics.
- Game-specific effect types or plugin lifecycle/runtime execution.
- Runtime registry or capability enforcement implementation.

## Acceptance Criteria

- The contract document defines the boundary against Command, Transaction, and Domain Event.
- The contract documents the effect result model, guard policy, state target model, atomic effect
  types, value model, no-op policy, diagnostics, determinism, canonical serialization, budgets, and
  deferred decisions.
- The schema validates the effect envelope, discriminated effect forms, guards, targets, and values.
- Valid fixtures, invalid fixtures, semantic-invalid fixtures, and runtime-invalid fixtures exist and
  are exercised by tests.
- Tests prove deterministic application behavior, guard handling, no-op behavior, partial mutation
  rejection, budget handling, and regression compatibility with prior contracts.
- The task ends with no additional ACTIVE task and a handoff that records the design decisions.

## Required Fixtures and Tests

- Valid fixtures for set, unset, increment, append, remove-at, add-unique, remove-value, and guard
  outcomes.
- Invalid fixtures for unknown effect type, missing or invalid schemaVersion, invalid target, forbidden
  target segments, metadata/root mutations, unknown field, executable source, invalid entity reference,
  and invalid indices or values.
- Semantic-invalid fixtures for missing state domain, missing required target, type mismatch,
  unsupported domain schema version, access denied, guard error, numeric overflow, array index out of
  range, duplicate add-unique, resulting domain invalidity, unknown newer schema, and budget exceeded.
- Runtime-invalid fixtures for non-JSON-safe values such as function, Date, Map, Set, NaN, Infinity,
  cyclic object, and nested forbidden keys.
- Tests for deterministic application, guard evaluation, no-op handling, atomic rollback of partial
  mutation, canonical serialization idempotence, and immutability of committed input.

## Allowed Files

- `docs/contracts/EFFECT_CONTRACT.md`
- `schemas/effect.schema.json`
- `tests/effect-contract.test.ts`
- `tests/fixtures/contracts/effect/**`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/ready/TASK-008-design-effect-contract.md`
- `docs/tasks/active/TASK-008-design-effect-contract.md`
- `docs/tasks/review/TASK-008-design-effect-contract.md`
- `docs/tasks/done/TASK-008-design-effect-contract.md`
- `docs/handoffs/TASK-008-HANDOFF.md`

## Forbidden Changes

- Production Effect Executor implementation.
- Production Transaction Manager, Command pipeline, State Store, or Domain Event system.
- Commit or rollback semantics owned by Transaction.
- Engine State, Condition, Entity Identity, or Schema Versioning semantics unless a real conflict is found.
- Unrelated subsystems, game-specific mutation helpers, or executable effect code.

## Risks

- Overly broad target selectors could allow unsafe writes if later executors are careless.
- Treating guard errors as false would create unsafe fail-open behavior.
- Array/object mutation semantics can become ambiguous without tight type and path rules.
- Copy/merge semantics can introduce aliasing or hidden deep-merge behavior if included too early.

## Compatibility and Migration Impact

- Breaking changes require a new Effect Contract version and updated schema/fixtures.
- New effect types or target forms must preserve deterministic, fail-closed application semantics.
- Candidate state semantics must remain compatible with future Transaction and Domain Event contracts.

## Output Artifacts

- Effect contract document.
- Effect JSON Schema.
- Contract fixtures.
- Contract tests.
- Updated inventory and current state.
- Handoff for TASK-008.

## Definition of Done

- All acceptance criteria are met.
- Required checks pass.
- TASK-008 is moved to `docs/tasks/active/` with status `ACTIVE` during the design work, then to
  review or done as appropriate.
- The handoff documents the contract decisions and known limits.
