# TASK-025 HANDOFF

## Status

DONE

## Acceptance

TASK-025 was accepted on `main` after merge plus a narrow post-merge contract alignment for sparse
ascending event sequences.

## Summary

TASK-025 adds a deterministic in-memory Domain Event materializer in `packages/engine-kernel`.
It validates a committed transaction wrapper plus a candidate confirmed event or event batch,
normalizes confirmed Domain Event batches in memory, preserves input immutability, and returns
stable diagnostics without introducing Event Store, Save, replay, subscriber delivery, or any
runtime delivery pipeline.

## Changed Files

- `docs/handoffs/TASK-025-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/review/TASK-025-domain-event-materializer.md`
- `packages/engine-kernel/src/domain-event/domain-event.ts`
- `packages/engine-kernel/src/index.ts`
- `tests/domain-event-materializer.test.ts`

## API Summary

- `DOMAIN_EVENT_CONTRACT_VERSION`
- `DOMAIN_EVENT_SCHEMA_ID`
- `DOMAIN_EVENT_SCHEMA_VERSION`
- `materializeDomainEvents()`
- `type DomainEventBatch`
- `type DomainEventEnvelope`
- `type DomainEventMaterializationHistory`
- `type DomainEventMaterializationIssue`
- `type DomainEventMaterializationIssueCode`
- `type DomainEventMaterializationOptions`
- `type DomainEventMaterializationResult`
- `type DomainEventMaterializationStatus`

## Materialization Semantics

- Only committed transactions can materialize confirmed events.
- Transaction wrappers carry revision boundaries and optional transaction binding metadata.
- Candidate single events are normalized into a single-event confirmed batch.
- Candidate batches preserve ascending `sequence` ordering and are validated without re-sorting by
  event type.
- Sparse ascending `sequence` values are accepted; duplicate or descending sequences are rejected.
- Empty confirmed batches are allowed for committed transactions with no public event.
- Duplicate transaction materialization is handled through in-memory history deduplication.

## Supported Event Materialization Inputs

- committed single confirmed event
- committed confirmed event batch
- committed empty confirmed batch
- committed transaction with command-plan source
- committed transaction with system source

## Unsupported / Deferred Semantics

- Event Store
- Event persistence
- subscriber delivery
- event bus
- replay
- Save system
- persistence
- crash recovery
- UI/editor
- gameplay/P0 content
- plugin runtime

## Tests

- committed single event materialization
- committed batch materialization and ordering
- empty confirmed batch materialization
- rejected / rolled-back / no-op / error transaction rejection
- invalid wrapper shape
- invalid / non-JSON candidate rejection
- forbidden key and cyclic input rejection
- unknown event type and invalid payload rejection
- duplicate event id and duplicate sequence rejection
- sparse ascending sequence acceptance
- revision mismatch rejection
- command binding mismatch rejection
- deterministic output
- input immutability
- public result surface minimization
- duplicate transaction materialization history behavior

## Validation

- `corepack pnpm test -- tests/domain-event-materializer.test.ts` - pass, 16 tests
- `corepack pnpm lint` - pass
- `corepack pnpm typecheck` - pass
- `corepack pnpm test` - pass, 21 test files / 378 tests
- `corepack pnpm build` - pass
- `corepack pnpm validate` - pass
- `git diff --check` - pass

## Boundary Notes

- The materializer uses only public exports from `@narrative-engine/core` and the kernel
  transaction boundary.
- It does not import docs, tests, fixtures, UI, save, event store, subscriber delivery, or any
  plugin/runtime system.
- It stays in-memory and does not become a persistence, replay, or delivery boundary.

## Explicit Non-Goals

- No Event Store.
- No Save system.
- No persistence.
- No subscriber delivery.
- No event bus.
- No replay engine.
- No crash recovery.
- No UI/editor.
- No gameplay/P0 content.
- No plugin runtime.
- No TASK-026.

## Known Non-Blockers

- Local Node is `v24.16.0` while the repository expects Node 22.
- `corepack pnpm` emits the corresponding engine warning locally.

## Active Task

none

## Next Recommended Task

`TASK-026 - Minimal end-to-end contract pipeline test`
