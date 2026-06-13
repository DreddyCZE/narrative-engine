# TASK-009 - Design Command Contract

## ID

TASK-009

## Title

Design Command Contract

## Milestone

M1 - Core Foundation

## Status

REVIEW

## Priority

P1

## Objective

Design a public, versioned Command Contract that captures intent, targets, payloads, preconditions,
revision preconditions, and idempotence metadata without mutating Engine State directly.

## Context

Commands are the intake boundary for intent entering the future engine pipeline. This task defines
the data contract for command submission, planning, and rejection while staying strictly separate
from handlers, transactions, state mutation, and domain events.

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
- `schemas/entity-identity.schema.json`
- `schemas/schema-versioning.schema.json`
- `schemas/engine-state.schema.json`
- `schemas/condition.schema.json`
- `schemas/effect.schema.json`
- `docs/handoffs/TASK-004-HANDOFF.md`
- `docs/handoffs/TASK-005-HANDOFF.md`
- `docs/handoffs/TASK-006-HANDOFF.md`
- `docs/handoffs/TASK-007-HANDOFF.md`
- `docs/handoffs/TASK-008-HANDOFF.md`

## Dependencies

- TASK-004 - Design Entity Identity Contract
- TASK-005 - Design Schema Versioning Contract
- TASK-006 - Design Engine State Contract
- TASK-007 - Design Condition Contract
- TASK-008 - Design Effect Contract

## Scope

- Define the Command envelope, type model, invocation identity, actor and initiator model, target
  model, payload model, expected revision policy, precondition policy, planning result, idempotence
  metadata, and canonical serialization rules.
- Define the boundary between Command, Handler, Condition, Effect, Transaction, and Domain Event.
- Provide a command contract document, schema, fixtures, tests, inventory updates, current-state
  updates, and a handoff.

## Out of Scope

- Production Command Bus, handler registry, Transaction Manager, State Store, Effect Executor, or
  Domain Event system.
- Commit or rollback semantics, state mutation, and revision ownership.
- Concrete game-specific command families, plugin lifecycle logic, or tracing infrastructure.
- Runtime idempotency storage or authorization implementation.

## Acceptance Criteria

- The contract document clearly separates Command from Handler, Condition, Effect, Transaction, and
  Domain Event.
- The contract documents the envelope, type grammar, invocation identity, actor/initiator model,
  target model, payload model, expected revision semantics, precondition semantics, command plan
  boundary, idempotence, retry boundary, registry boundary, authorization boundary, determinism, and
  deferred decisions.
- The schema validates the envelope, type, invocation identity, actor and target references, payload
  shape, expected revision, preconditions, and correlation/idempotence metadata.
- Valid fixtures, invalid fixtures, semantic-invalid fixtures, and runtime-invalid fixtures exist and
  are exercised by tests.
- Tests prove deterministic planning, precondition handling, revision conflict handling, duplicate
  handling, immutable inputs, canonical serialization, and regression compatibility with prior
  contracts.
- The task ends with no ACTIVE task and a handoff that records the design decisions and limits.

## Required Fixtures and Tests

- Valid fixtures for minimal system command, actor command, single-target command, multi-target
  command, payload command, expectedRevision `0`, inline precondition, named precondition reference,
  idempotency key, and correlation/causation metadata.
- Invalid fixtures for unknown root field, missing or invalid schemaVersion, invalid command type,
  invalid invocation ID, invalid actor reference, duplicate target, too many targets, invalid
  expectedRevision, executable field, forbidden nested payload key, invalid Condition shape, and
  oversized payload.
- Semantic-invalid fixtures for unknown command type, missing handler, actor not found, target not
  found, revision conflict, precondition false, precondition error, access denied, duplicate command
  ID, idempotency conflict, unsupported schema version, invalid planned Effect, plan budget exceeded,
  and non-deterministic context.
- Runtime-invalid fixtures for function, Date, Map, Set, NaN, Infinity, cyclic object, and forbidden
  nested object key values.
- Tests for deterministic planning, duplicate detection, precondition handling, revision conflict
  handling, plan validation, immutable input handling, canonical serialization, and regression
  consistency with prior contracts.

## Allowed Files

- `docs/contracts/COMMAND_CONTRACT.md`
- `schemas/command.schema.json`
- `tests/command-contract.test.ts`
- `tests/fixtures/contracts/command/**`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/review/TASK-009-design-command-contract.md`
- `docs/tasks/ready/TASK-009-design-command-contract.md`
- `docs/tasks/active/TASK-009-design-command-contract.md`
- `docs/tasks/done/TASK-009-design-command-contract.md`
- `docs/handoffs/TASK-009-HANDOFF.md`

## Forbidden Changes

- Production Command Bus, handler registry, transaction, effect, state, or event implementations.
- Commit, rollback, and revision semantics owned by the future Transaction Contract.
- Unrelated subsystems, game-specific command logic, or executable command code.
- Changes to prior contracts unless a real cross-contract conflict is discovered.

## Risks

- A too-permissive command envelope could hide handler-specific validation mistakes.
- Treating precondition errors as false would create unsafe fail-open planning behavior.
- Allowing command IDs or idempotency metadata to drift from canonical form would undermine
  deduplication and replay safety.
- Overloading initiator metadata as authority would weaken the authorization boundary.

## Compatibility and Migration Impact

- Breaking changes require a new Command Contract version and updated schema/fixtures.
- New command types or payload shapes must preserve deterministic planning and explicit rejection
  semantics.
- The envelope must remain compatible with future Transaction and Domain Event contracts.

## Output Artifacts

- Command contract document.
- Command JSON Schema.
- Contract fixtures.
- Contract tests.
- Updated inventory and current state.
- Handoff for TASK-009.

## Definition of Done

- All acceptance criteria are met.
- Required checks pass.
- TASK-009 is moved to `docs/tasks/review/` with status `REVIEW`.
- The handoff documents the design decisions and known limits.
