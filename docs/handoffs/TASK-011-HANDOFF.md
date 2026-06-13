# TASK-011 Handoff - Domain Event Contract

## Status

DONE. No commit has been created for this task.

## Scope Delivered

- `docs/contracts/DOMAIN_EVENT_CONTRACT.md`
- `schemas/domain-event.schema.json`
- `tests/domain-event-contract.test.ts`
- `tests/fixtures/contracts/domain-event/**`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-011-design-domain-event-contract.md`

## Core Decisions

- Domain Events are immutable, JSON-safe records of confirmed facts that exist only after a
  successful Transaction commit.
- `eventId` is required and uses the Entity Identity Contract. The canonical event entity type is
  `domain-event`.
- `eventType` is a lowercase namespaced confirmed-fact key such as `core.door-opened`.
- `transactionId` is required and binds every confirmed event to the successful Transaction that
  produced it.
- `commandId` is optional because a committed transaction may originate from a system source.
- `previousRevision` and `revision` are required; `revision` must equal `previousRevision + 1`.
- `sequence` is required, non-negative, and defines deterministic ordering within a transaction
  batch.
- Confirmed events are never emitted for no-op, rejected, rolled-back, or errored transactions.
- Event batches are canonical, deterministic, and ordered by `sequence`. An empty confirmed batch
  may exist for a committed transaction that has no public Domain Event.
- Domain Events do not define Event Bus, Event Store, replay, projection, subscriber, scheduler, or
  save behavior.

## Test Oracle Boundary

- The domain-event test helper is a contract oracle only.
- It is not a production Event Bus, Event Store, replay engine, projection runtime, or subscriber
  system.
- It does not emit events into a live delivery pipeline and does not mutate Engine State.
- It simulates confirmed-event materialization from committed Transaction results only.
- It uses explicit test fixtures and deterministic helpers to prove contract behavior.

## Fixture Coverage

- Valid fixtures cover confirmed events, command binding, revision boundaries, sequence ordering,
  typed references, and empty confirmed batches.
- Invalid fixtures cover malformed envelopes, invalid IDs, invalid types, root-field rejection,
  forbidden nested keys, and payload-size limits.
- Semantic-invalid fixtures cover transaction/state mismatch, duplicate IDs, duplicate sequences,
  sequence gaps, unsupported event types, unsupported schema versions, premature publication,
  duplicate materialization, and non-committed sources.
- Runtime-invalid fixtures cover non-JSON host values and cyclic or forbidden-key payloads.

## Known Limits

- There is no production Event Bus or Event Store.
- There is no replay engine or projection runtime.
- Delivery semantics, acknowledgments, and checkpoints remain deferred.
- The oracle is intentionally scoped to contract validation and does not model persistent delivery.

## Next Step

Final acceptance review TASK-011 is complete.
