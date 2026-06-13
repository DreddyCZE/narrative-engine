# Domain Event Contract

## Status

DRAFT

## Contract ID

domain-event

## Contract Version

domain-event@0.1.0

## Owner

`packages/engine-contracts`; engine contract owners and event boundary owners.

## Purpose

Domain Event defines immutable, serializable records of confirmed facts that exist only after a
successful Transaction commit. A Domain Event describes what happened in the past. It does not
change Engine State, does not execute work, and does not act as a Command or Effect.

## Terminology

- **Domain Event**: an immutable record of a confirmed fact after commit.
- **Confirmed event**: a Domain Event that has passed the commit boundary.
- **Event envelope**: the canonical serialized Domain Event object.
- **Event batch**: an ordered group of confirmed events that share a single transaction and
  revision boundary.
- **Event identity**: the stable identity of one confirmed Domain Event.
- **Event type**: the namespaced type key describing the kind of confirmed fact.
- **Revision boundary**: the `previousRevision` and `revision` pair that binds the event to the
  committed Engine State.
- **Sequence**: the non-negative order index of one event within a transaction batch.
- **Materialization**: the conversion of a committed transaction result into confirmed Domain Event
  data.
- **Audit Event**: a technical record of a request, failure, or operational action.
- **Integration Event**: an external message with its own contract and lifecycle.

Normative terms use the usual meaning:

- **MUST** means required.
- **MUST NOT** means forbidden.
- **SHOULD** means recommended but not required.
- **MAY** means optional.

## Boundary to Other Messages

- Command expresses intent before work is done.
- Effect expresses a declarative candidate-state change.
- Transaction Result describes the commit pipeline outcome.
- Domain Event records a confirmed fact after a successful commit.
- Audit Event records technical or operational history.
- Integration Event is an external contract and is not automatically a Domain Event.

Domain Event MUST NOT be confused with a Command, Effect, or generic log record.

## Event Envelope

The canonical confirmed Domain Event is an immutable envelope.

```json
{
  "contractVersion": "domain-event@0.1.0",
  "schemaId": "domain-event",
  "schemaVersion": 1,
  "eventId": "domain-event.engine.main-door-opened-0",
  "eventType": "core.door-opened",
  "transactionId": "transaction.runtime.open-main-door",
  "previousRevision": 42,
  "revision": 43,
  "sequence": 0,
  "payload": {
    "door": {
      "id": "device.example.main-door",
      "entityType": "device"
    }
  }
}
```

## Event Identity

- `eventId` MUST be present on every confirmed event.
- `eventId` MUST use the Entity Identity Contract.
- The canonical event identity entity type is `domain-event`.
- The namespace is the event-owning namespace, usually the domain or engine namespace that owns the
  confirmed fact vocabulary.
- The local name MUST be a stable slug for the confirmed fact and MUST NOT depend on mutable
  runtime data.
- The commit pipeline MUST assign `eventId` deterministically or through a stable transactional
  service. The exact slug algorithm is deferred, but the same confirmed event batch MUST reproduce
  the same canonical `eventId` on retry.
- Event payload MUST NOT determine how the `eventId` is generated.

## Event Type

- `eventType` MUST be present.
- `eventType` MUST use a lowercase namespaced key.
- `eventType` MUST describe a confirmed fact, not an imperative action.
- `eventType` MUST NOT be an event instance ID.
- `eventType + schemaVersion` determines the payload schema for that event type.
- The first stable version uses fact-shaped names such as `core.door-opened`, not command-shaped
  names such as `open-door`.
- `eventType` MUST be ASCII lowercase in canonical form.
- `eventType` MUST NOT contain whitespace.
- `eventType` SHOULD identify a specific confirmed fact instead of a generic `state-changed` form
  unless the fact itself is genuinely generic.

## Revision Boundary

- `previousRevision` and `revision` MUST be present on confirmed Domain Events.
- `revision` MUST equal `previousRevision + 1`.
- `revision` MUST match the resulting committed Engine State revision.
- The event MUST be materialized only after the Transaction has committed successfully.
- A no-op Transaction MUST NOT produce a confirmed Domain Event.
- A rolled-back, rejected, or errored Transaction MUST NOT produce a confirmed Domain Event.
- Multiple events from the same commit batch share the same revision boundary.
- `revision` is not an Event Store position and is not a sequence number.

## Sequence and Ordering

- Every confirmed event MUST carry a `sequence`.
- `sequence` MUST be a non-negative integer.
- `sequence` MUST be unique within one confirmed event batch.
- The canonical order of a confirmed event batch is ascending `sequence`.
- `sequence` MUST NOT be implicitly re-sorted by `eventType`.
- `sequence` MAY start at `0`.
- A single-event batch SHOULD use `sequence: 0`.

## Transaction Binding

- `transactionId` MUST be present on confirmed events and confirmed batches.
- `transactionId` MUST identify the successful Transaction commit that produced the event data.
- If a transaction input did not carry a `transactionId`, the commit pipeline MUST assign one before
  confirmed events are materialized.
- A confirmed Domain Event MUST NOT exist without a clear transaction binding.
- `commandId` is optional because a Transaction may originate from a system source.
- If `commandId` is present, it MUST match the originating Command Plan or command-caused source.
- Duplicate Transaction materialization MUST NOT create a second confirmed event batch.

## Correlation and Causation

- `correlationId` MAY be present to group related commands, transactions, and events.
- `correlationId` MUST NOT change domain meaning.
- `causationId` MAY be present to point to the immediate cause.
- `causationKind` MUST be present when `causationId` is present.
- `causationKind` MUST be one of `command`, `event`, or `transaction`.
- `causationId` MUST reference the declared `causationKind`.
- `causation` metadata is linkage metadata, not authorization.
- Missing referenced messages are referential problems, not JSON shape problems.

## Event Payload

- `payload` MUST be JSON-safe.
- `payload` MUST be immutable after confirmation.
- `payload` MUST be valid for the specific `eventType + schemaVersion` pair.
- `payload` SHOULD be minimal and domain meaningful.
- `payload` MUST NOT contain executable code.
- `payload` MUST NOT be a full Engine State snapshot by default.
- `payload` MUST NOT automatically expose sensitive state.
- A Domain Event is not a generic JSON Patch and MUST NOT imply blind state replay semantics.

The root schema validates only the generic JSON-safe payload shape. Type-specific payload meaning is
validated by event-type-specific schema and contract tests.

## Event versus State Diff

- Transaction may internally know a state diff.
- Domain Event MAY be derived from transaction facts or proposals.
- Domain Event MUST NOT be treated as a state diff API.
- Domain Event MUST NOT bypass Effect and Transaction rules.
- Domain Event MAY name a confirmed fact instead of describing path/value deltas.
- A generic `state-changed` event is only acceptable as a technical internal fact, not as the only
  public taxonomy.

## Event Proposals

- Event proposals are not confirmed Domain Events.
- Event proposals MUST NOT carry confirmed event identity or confirmed revision.
- Event proposals MAY be deferred to a future contract.
- This contract defines only confirmed Domain Events.

## Event Materialization

Confirmed Domain Events are materialized from a successful Transaction commit.

- Successful Transaction Result + committed revision + validated event facts or proposals MAY produce
  a confirmed event batch.
- A confirmed event MUST NOT be observable before the committed state exists.
- Event materialization MUST NOT claim to solve persistence atomicity by itself.
- A test oracle MAY simulate materialization, but production persistence and recovery are deferred.

## Event Batch

The canonical commit output is an optional confirmed event batch.

```json
{
  "contractVersion": "domain-event@0.1.0",
  "schemaId": "domain-event",
  "schemaVersion": 1,
  "transactionId": "transaction.runtime.open-main-door",
  "previousRevision": 42,
  "revision": 43,
  "events": []
}
```

- A batch MAY be empty when a committed transaction has no public confirmed event.
- An empty batch is not the same thing as a no-op Transaction.
- If a batch contains events, each event MUST be canonical and ordered by `sequence`.
- A batch MUST NOT contain duplicate `eventId` values.
- A batch MUST NOT contain duplicate `sequence` values.
- The batch boundary is not an Event Store position.

## Empty Batch Policy

- A state-changing commit MAY produce an empty confirmed event batch.
- A no-op Transaction MUST NOT produce a confirmed event batch.
- Rejected, rolled-back, and errored transactions MUST NOT produce a confirmed batch.
- Whether a specific game rule requires at least one confirmed Domain Event is a later domain policy,
  not a core contract requirement.

## Immutability

- Confirmed Domain Events MUST be immutable.
- The canonical serialized event MUST remain stable across repeated serialization.
- The event payload MUST NOT be rewritten in place.
- Test helpers MUST NOT be able to mutate a confirmed event through a shared mutable reference.
- If the meaning changes, a new event or a schema migration policy is required.

## Schema Evolution

- Event schema versioning is scoped by `eventType`.
- `eventType + schemaVersion` determines compatibility.
- The Schema Versioning Contract governs `exact`, `readable`, `migration-required`, and
  `unsupported` outcomes.
- Old confirmed events MUST not be silently rewritten.
- Lossy migration MUST be explicit.
- Event type ownership is stable unless a future registry or migration contract says otherwise.

## Replay Boundary

- Event replay for projections is a future consumer concern.
- Rebuilding Engine State from Domain Events is event sourcing and is not implied by this contract.
- Engine State snapshots remain authoritative according to the Engine State Contract.
- A confirmed event MAY be replayed into projections, analytics, or audit tools.
- The contract does not promise that the full Engine State can be reconstructed from Domain Events.

## Delivery Boundary

- This contract defines event identity and canonical data, not delivery mechanics.
- At-least-once delivery may repeat a confirmed `eventId`.
- Exactly-once delivery MUST NOT be claimed without infrastructure that enforces it.
- Global ordering across independent transactions is not guaranteed here.
- Delivery attempts, acknowledgments, and checkpoints belong to a future Event Store or delivery
  contract.

## Consumer Boundary

Consumers MAY use confirmed events to:

- update projections or view models,
- write audit records,
- trigger external integrations,
- schedule a new Command,
- measure analytics.

Consumers MUST NOT:

- mutate Engine State directly,
- treat an unrecognized required event type as a silent no-op,
- modify confirmed events in place,
- confuse Domain Events with Integration Events.

## Timestamp Policy

- Wall-clock timestamps are not required in the core canonical event envelope.
- If a future transport or store metadata layer adds a timestamp, it MUST be explicit and MUST NOT be
  generated implicitly by `Date.now()` inside a contract oracle.
- Logical ordering is already represented by `previousRevision`, `revision`, and `sequence`.
- Ingestion timestamps belong to storage metadata, not to the confirmed event meaning itself.

## Event Registry Boundary

This contract defines only a future registry descriptor boundary.

- An event registry descriptor MAY list `eventType`, `schemaId`, `schemaVersion`, `owner`, payload
  schema, lifecycle status, sensitivity classification, and retention hint.
- The registry descriptor MUST NOT contain executable subscribers.
- Ownership is not permission.
- Unknown event types are explicit problems, not silent no-ops.
- The registry implementation itself is deferred.

## Materialization Result

The public contract only needs the confirmed event envelope and optional batch. For test or oracle
purposes a small materialization result MAY be used:

- `materialized`
- `empty`
- `error`

- `materialized` means a confirmed batch was created.
- `empty` means a committed transaction produced no confirmed events.
- `error` means the source was not a valid committed transaction or the event data failed
  validation.

## Error Model

Stable error codes include:

- `INVALID_EVENT_SHAPE`
- `UNKNOWN_EVENT_TYPE`
- `SCHEMA_VERSION_UNSUPPORTED`
- `INVALID_EVENT_ID`
- `INVALID_TRANSACTION_REFERENCE`
- `INVALID_COMMAND_REFERENCE`
- `INVALID_REVISION_BOUNDARY`
- `INVALID_SEQUENCE`
- `DUPLICATE_EVENT_ID`
- `DUPLICATE_EVENT_SEQUENCE`
- `INVALID_EVENT_PAYLOAD`
- `NON_SERIALIZABLE_VALUE`
- `FORBIDDEN_OBJECT_KEY`
- `EVENT_BUDGET_EXCEEDED`
- `EVENT_MATERIALIZATION_FAILED`
- `CONFIRMATION_BOUNDARY_VIOLATION`

Diagnostics MUST be deterministic, redact sensitive values unless explicitly allowed, and use a
stable path format.

## Budgets

Configurable limits SHOULD exist for:

- event envelope size,
- payload depth,
- payload bytes,
- string length,
- events per transaction batch,
- diagnostics count,
- reference count,
- array length.

Budget overflow MUST be an explicit error.

## Canonical Serialization

Confirmed events and event batches MUST be canonical serializable.

- UTF-8
- LF
- 2-space indentation
- final newline
- stable key order
- stable typed reference order
- canonical object-key sorting inside payloads where applicable
- preserved array order
- batch order by `sequence`
- no `undefined`
- explicit `null` policy
- no auto-generated timestamps
- idempotent canonicalization

## Security Considerations

- Event spoofing MUST be blocked by transaction binding and stable identity.
- Published-before-commit MUST be impossible in the contract boundary.
- Duplicate `eventId` values MUST be rejected by tests or semantic validation.
- Event replay abuse MUST be handled by downstream delivery or subscriber contracts.
- Sensitive data MUST NOT leak through payloads or diagnostics without explicit policy.
- Event data MUST NOT choose a subscriber implementation, module, or code path.

## Examples

### Single confirmed event

```json
{
  "contractVersion": "domain-event@0.1.0",
  "schemaId": "domain-event",
  "schemaVersion": 1,
  "eventId": "domain-event.engine.main-door-opened-0",
  "eventType": "core.door-opened",
  "transactionId": "transaction.runtime.open-main-door",
  "previousRevision": 42,
  "revision": 43,
  "sequence": 0,
  "commandId": "command.runtime.open-main-door",
  "payload": {
    "door": {
      "id": "device.example.main-door",
      "entityType": "device"
    }
  }
}
```

### Confirmed event batch

```json
{
  "contractVersion": "domain-event@0.1.0",
  "schemaId": "domain-event",
  "schemaVersion": 1,
  "transactionId": "transaction.runtime.open-main-door",
  "previousRevision": 42,
  "revision": 43,
  "events": [
    {
      "contractVersion": "domain-event@0.1.0",
      "schemaId": "domain-event",
      "schemaVersion": 1,
      "eventId": "domain-event.engine.main-door-opened-0",
      "eventType": "core.door-opened",
      "transactionId": "transaction.runtime.open-main-door",
      "previousRevision": 42,
      "revision": 43,
      "sequence": 0,
      "commandId": "command.runtime.open-main-door",
      "payload": {
        "door": {
          "id": "device.example.main-door",
          "entityType": "device"
        }
      }
    }
  ]
}
```

## Known Limitations

- There is no production Event Bus.
- There is no Event Store or replay engine.
- There is no subscriber delivery implementation.
- There is no promise of event sourcing as the default architecture.
- Event materialization persistence atomicity is deferred.

## Deferred Decisions

- Exact event identity slug algorithm.
- Whether a future event store will require a separate global event position.
- Whether all game domains will require at least one public confirmed event per commit.
- Integration Event contract shape.
- Audit Event contract shape.
- Exact timestamp policy for storage metadata.
