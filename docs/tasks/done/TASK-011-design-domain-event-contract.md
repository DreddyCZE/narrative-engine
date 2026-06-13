# TASK-011 - Design Domain Event Contract

## ID

TASK-011

## Title

Design Domain Event Contract

## Milestone

M1 - Core Foundation

## Status

DONE

## Priority

P1

## Objective

Design a public, versioned Domain Event Contract that defines immutable, serializable records of
confirmed facts emitted only after a successful Transaction commit.

## Context

Domain Events are the post-commit record of what happened. They are not Commands, not Effects, and
not a replay engine. This task defines the boundary between committed state, confirmed facts, and
future projection or integration consumers while keeping event persistence and delivery out of
scope.

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
- `docs/contracts/TRANSACTION_CONTRACT.md`
- `schemas/entity-identity.schema.json`
- `schemas/schema-versioning.schema.json`
- `schemas/engine-state.schema.json`
- `schemas/condition.schema.json`
- `schemas/effect.schema.json`
- `schemas/command.schema.json`
- `schemas/transaction.schema.json`
- `docs/handoffs/TASK-004-HANDOFF.md`
- `docs/handoffs/TASK-005-HANDOFF.md`
- `docs/handoffs/TASK-006-HANDOFF.md`
- `docs/handoffs/TASK-007-HANDOFF.md`
- `docs/handoffs/TASK-008-HANDOFF.md`
- `docs/handoffs/TASK-009-HANDOFF.md`
- `docs/handoffs/TASK-010-HANDOFF.md`

## Dependencies

- TASK-004 - Design Entity Identity Contract
- TASK-005 - Design Schema Versioning Contract
- TASK-006 - Design Engine State Contract
- TASK-007 - Design Condition Contract
- TASK-008 - Design Effect Contract
- TASK-009 - Design Command Contract
- TASK-010 - Design Transaction Contract

## Scope

- Define the Domain Event envelope, identity, type model, revision boundary, payload model,
  transaction binding, sequence ordering, batch model, immutability, schema evolution, replay
  boundary, delivery boundary, consumer boundary, timestamp policy, diagnostics, and canonical
  serialization.
- Provide a contract document, schema, fixtures, tests, inventory updates, state updates, and a
  handoff.

## Out of Scope

- Event Bus.
- Event Store.
- Event replay engine.
- Projection runtime.
- Subscriber system.
- Scheduler.
- Save system.
- Integration Event Contract.
- Audit Event Contract.
- Production persistence or delivery implementation.

## Acceptance Criteria

- The Domain Event Contract is publicly documented and versioned.
- Confirmed events only arise after successful Transaction commit.
- Event identity, event type, revision boundary, and transaction binding are explicit.
- Domain Events are immutable and JSON-safe.
- Event batches, if present, are canonical and deterministic.
- No confirmed event exists for no-op, rejected, rolled-back, or error transaction outcomes.
- The contract clearly separates Domain Events from commands, effects, audit logs, integration
  messages, and replay infrastructure.

## Mandatory Tests and Fixtures

- Valid fixtures for confirmed events, revision boundaries, transaction binding, sequence ordering,
  typed references, and optional batch output.
- Invalid fixtures for malformed envelopes, invalid IDs, invalid types, invalid revision
  boundaries, and payload limits.
- Semantic-invalid fixtures for event/transaction mismatch, duplicate IDs, unsupported schema
  versions, batch ordering issues, premature publication, and non-committed sources.
- Runtime-invalid fixtures for non-JSON host values and forbidden nested keys.
- Contract tests for immutability, revision boundary, batch ordering, no-op exclusion, replay
  boundary, and canonical serialization.

## Allowed Files

- `docs/contracts/DOMAIN_EVENT_CONTRACT.md`
- `schemas/domain-event.schema.json`
- `tests/domain-event-contract.test.ts`
- `tests/fixtures/contracts/domain-event/**`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/status/CURRENT_STATE.md`
- `docs/handoffs/TASK-011-HANDOFF.md`
- `docs/tasks/done/TASK-011-design-domain-event-contract.md`
- `packages/test-support/**` for test-only oracle helpers

## Forbidden Changes

- Production Event Bus implementation.
- Event Store implementation.
- Replay engine implementation.
- Projection runtime implementation.
- Subscriber registry or delivery implementation.
- Save system implementation.
- Scheduler implementation.
- Runtime authorization or plugin capability system.

## Risks

- Confusing Domain Events with state diffs or generic logs.
- Leaking sensitive state through payloads or diagnostics.
- Inventing an event store contract too early.
- Making event identity nondeterministic.
- Accidentally implying event sourcing as the default architecture.

## Compatibility and Migration Impact

- Event type and event schema versioning must align with the Schema Versioning Contract.
- Event identity and typed references must align with the Entity Identity Contract.
- Event revision boundaries must align with the Transaction Contract and Engine State Contract.
- Future migration rules must preserve historical facts and replay meaning.

## Output Artifacts

- Domain Event contract document.
- Domain Event JSON Schema.
- Domain Event contract test suite.
- Domain Event fixtures.
- Updated contract inventory.
- Updated current state.
- Task handoff.

## Definition of Done

- Contract document, schema, fixtures, and tests exist.
- Inventory and current state are updated.
- Handoff is complete.
- No production Event Bus or Event Store exists.
- No second ACTIVE task exists.
- The task is done and ready for final acceptance review closure.
