# Command Contract

## Status

DRAFT

## Contract ID

command

## Contract Version

command@0.1.0

## Owner

`packages/engine-contracts`; engine owner and command pipeline owners.

## Purpose

Command defines a serializable request that expresses intent from an actor, an initiator, or a
planner. A Command does not mutate Engine State directly. It carries inputs, optional preconditions,
and enough metadata for a future handler to produce a deterministic Command Plan.

## Terminology

- **Command**: a declarative request to do something.
- **Command type**: the stable, namespaced behavior key for a family of Commands.
- **Invocation**: one submitted instance of a Command.
- **Invocation identity**: a stable ID for a specific invocation, when required.
- **Actor**: the in-world entity that the request is attributed to, if one exists.
- **Initiator**: the technical or system source that submitted the request.
- **Target**: an entity reference addressed by the Command.
- **Payload**: the type-specific input object.
- **Precondition**: a Condition that must resolve before planning can continue.
- **Command Plan**: the ordered, unconfirmed Effect proposal returned by a handler.
- **Duplicate**: a known idempotent replay of a previously processed invocation.

Normative terms use the usual meaning:

- **MUST** means required.
- **MUST NOT** means forbidden.
- **SHOULD** means recommended but not required.
- **MAY** means optional.

## Boundary to Handler, Condition, Effect, Transaction, and Domain Event

- Command declares intent and inputs.
- Command Handler is future registered logic that validates the command and produces a plan or a
  rejection.
- Condition expresses declarative preconditions.
- Effect expresses atomic candidate-state changes.
- Transaction orders Effects, validates the candidate state, commits or rolls back, and owns
  revision changes.
- Domain Event records the confirmed result after commit.

Command MUST NOT commit, roll back, apply Effects, emit a confirmed Domain Event, or contain
executable handler code.

## Command Result Model

Command planning returns a discriminated result, not a bare boolean.

```json
{
  "status": "accepted",
  "plan": {
    "commandId": "command.runtime.open-main-door",
    "baseRevision": 42,
    "effects": []
  }
}
```

```json
{
  "status": "rejected",
  "reason": "precondition-false",
  "diagnostics": []
}
```

```json
{
  "status": "error",
  "diagnostics": []
}
```

```json
{
  "status": "duplicate",
  "originalCommandId": "command.runtime.open-main-door"
}
```

The first contract version recognizes:

- `accepted`
- `rejected`
- `error`
- `duplicate`

`accepted` means the Command produced a valid, ordered, unconfirmed Command Plan. An empty effect
plan is allowed only when the command type explicitly defines that meaning.

`rejected` is a legitimate refusal, such as a false precondition.

`error` is a contract, processing, or semantic failure.

`duplicate` is reserved for a known idempotent replay of the same logical invocation.

## Envelope

The canonical Command envelope contains:

- `contractVersion`
- `schemaId`
- `schemaVersion`
- optional `commandId`
- `commandType`
- optional `expectedRevision`
- optional `actor`
- optional `initiator`
- optional `targets`
- optional `preconditions`
- `payload`
- optional `correlationId`
- optional `causationId`
- optional `idempotencyKey`

### Named and Inline Commands

- A reusable or externally submitted Command SHOULD carry a stable `commandId`.
- A local inline Command MAY omit `commandId`.
- `commandId` MUST use the Entity Identity Contract when present.
- `commandId` is for invocation identity only and MUST NOT change planning semantics.

### Contract Identity

- `contractVersion` identifies the Command Contract specification.
- `schemaVersion` identifies the serialized Command envelope shape and command-type payload contract.
- `schemaVersion` is not the same thing as `expectedRevision` or any state schema version.

## Command Type Model

`commandType` is a stable namespaced key for a command family.

- `commandType` MUST be lowercase and case-sensitive.
- `commandType` MUST use a collision-safe namespace.
- The canonical grammar is a dot-separated lowercase namespace key such as
  `<namespace>.<local-name>`.
- `commandType` is not an Entity ID.
- Unknown `commandType` values MUST be errors.
- The same `commandType` and `schemaVersion` MUST NOT change meaning.
- Ownership metadata is not automatic permission.

Core command types are deferred to future handlers; this contract does not reserve specific game
commands.

## Invocation Identity

- `commandId` identifies one invocation.
- External, asynchronous, or replayable Commands SHOULD carry `commandId`.
- `commandId` MAY be assigned when a Command enters a pipeline, but the Command Contract does not
  define the generator.
- `commandId` MAY be used for audit, deduplication, causation, and replay correlation.
- `commandId` MUST NOT be a random, handler-defined, or mutable value.

## Actor and Initiator Model

- `actor` is the in-world entity that the Command is issued on behalf of.
- `initiator` is the technical source of the request.
- A Command MUST include at least one of `actor` or `initiator`.
- `actor` MUST use the Entity Identity Contract when present.
- `initiator` metadata MUST NOT be treated as authority by itself.
- UI is not an actor.
- Actor validation and authorization are deferred to future pipeline rules.

## Target Model

- Commands MAY carry zero, one, or many targets depending on the command type.
- `targets` is an ordered array.
- Order MUST be preserved and MAY be semantically meaningful.
- Duplicate targets are forbidden by default.
- Each target MUST use the Entity Identity Contract.
- A target reference is not a state path.
- Alias targets MUST be resolved to canonical IDs before planning continues.

## Payload Model

- `payload` MUST be JSON-safe.
- `payload` MUST be validated by the command-type schema for the current `schemaVersion`.
- `payload` MUST NOT contain executable code.
- Unknown payload fields are forbidden unless the command type explicitly allows extension.
- `commandType + schemaVersion` identifies the payload schema for a command family.

The root schema validates the envelope. Type-specific semantics are deferred to the handler and its
payload schema.

## Expected Revision

- `expectedRevision` is an optimistic concurrency precondition.
- `expectedRevision` MUST be a non-negative integer when present.
- `expectedRevision` is compared against the committed Engine State revision before planning.
- A mismatch MUST return `REVISION_CONFLICT` and MUST NOT produce an Effect Plan.
- `expectedRevision` is not a transaction ID, schema version, or content revision.
- Critical command types MAY require `expectedRevision`.
- A second revision check belongs to the future Transaction Contract.

## Preconditions

- `preconditions` are Conditions evaluated before planning continues.
- Preconditions are evaluated against the committed snapshot for the same planning request.
- All preconditions MUST resolve to true for planning to continue.
- false is a legitimate rejection.
- error is a command error, not a rejection.
- Preconditions MAY be inline Conditions or named Condition references, because the Condition Contract
  already defines both forms.
- Preconditions MUST preserve evaluation order.
- Preconditions MUST use the Condition Contract and MUST NOT introduce a second guard language.

## Command Plan Boundary

The handler output boundary is an unconfirmed Command Plan.

- The plan MUST carry the Command identity and the base revision used for planning.
- The plan MUST carry an ordered list of unconfirmed Effects when any are needed.
- The plan MAY carry planned metadata for diagnostics or future transaction handoff.
- The plan MUST NOT claim that any Effect has already been committed.
- The plan MUST NOT claim that a Domain Event already exists.

## Idempotence and Deduplication

- `idempotencyKey` MAY be present.
- `idempotencyKey` SHOULD be scoped by initiator and command type.
- The same `idempotencyKey` with a different canonical payload MUST be an error.
- A known replay of the same logical invocation MAY return `duplicate`.
- The deduplication store and retention policy are deferred.

## Retry Boundary

- Revision conflict is not automatically a safe retry.
- Retrying a Command MAY require re-evaluating preconditions.
- Retry count, backoff, and scheduling are deferred to future orchestration contracts.

## Registry Boundary

The future command registry descriptor MAY record:

- `commandType`
- `schemaId`
- `schemaVersion`
- owner package or module
- payload schema location
- actor requirement
- target cardinality
- expectedRevision policy
- handler capability
- lifecycle status

The registry descriptor MUST NOT contain executable code.
The registry implementation is out of scope.

## Authorization Boundary

- A valid JSON Command is not automatically authorized.
- Actor presence does not grant permission.
- Initiator metadata does not grant permission.
- Authorization is distinct from shape validation and precondition evaluation.
- `ACCESS_DENIED` is distinct from `PRECONDITION_FALSE`.
- Capability and permission rules are deferred.

## Determinism

A Command planning result MUST depend only on:

- the canonical Command declaration
- the committed state revision used as the planning base
- the explicit deterministic context passed to planning
- the registered handler version for the command type

A Command MUST NOT depend on wall-clock time, randomness without explicit input, filesystem access,
network access, environment variables, locale, or hidden global mutable state.

## Canonical Serialization

Canonical serialization MUST be:

- UTF-8
- LF line endings
- 2-space indentation
- final newline present
- stable key order
- idempotent

Rules:

- Canonical top-level key order is:
  1. `contractVersion`
  2. `schemaId`
  3. `schemaVersion`
  4. `commandId`
  5. `commandType`
  6. `expectedRevision`
  7. `actor`
  8. `initiator`
  9. `targets`
  10. `preconditions`
  11. `payload`
  12. `correlationId`
  13. `causationId`
  14. `idempotencyKey`
- Canonical actor and target references use `id` followed by `entityType`.
- Ordered lists preserve authoring order.
- Object keys inside payloads are sorted canonically.
- Optional empty metadata blocks MAY be omitted.
- `undefined` MUST NOT appear.
- `null` MAY appear only where explicitly allowed.

## Budgets

The contract expects configurable budgets for:

- envelope size
- payload depth
- target count
- precondition count
- planned effect count
- ID length
- diagnostic size
- state reads during planning
- reference depth

Budget overflow MUST be an explicit error, not a rejection or false value.

## Diagnostics

Minimum diagnostic shape:

```json
{
  "code": "INVALID_COMMAND_SHAPE",
  "message": "Invalid command declaration",
  "path": "/payload/value",
  "commandId": "command.runtime.open-main-door",
  "expected": "json-safe payload",
  "actual": "function"
}
```

Diagnostics MUST NOT be localized player text.
Diagnostics SHOULD avoid copying sensitive state data or secret claims.
Diagnostics MAY be used by editor and validation tools to explain why a Command was rejected or
errored.

## Security Considerations

- Command injection and executable payloads MUST be rejected.
- Actor spoofing and initiator spoofing MUST be validated, not trusted.
- Replay and idempotency collisions MUST be handled explicitly.
- Prototype pollution and path injection MUST be blocked.
- Unknown handlers MUST be errors, not implicit fallbacks.
- Large payloads and deep nesting MUST be bounded.
- Diagnostics MUST avoid leaking secrets or private payload contents.

## Examples

Minimal system command:

```json
{
  "contractVersion": "command@0.1.0",
  "schemaId": "command",
  "schemaVersion": 1,
  "commandType": "core.validate-only",
  "initiator": {
    "kind": "system"
  },
  "payload": {}
}
```

Actor command with targets:

```json
{
  "contractVersion": "command@0.1.0",
  "schemaId": "command",
  "schemaVersion": 1,
  "commandId": "command.runtime.open-main-door",
  "commandType": "core.set-value",
  "expectedRevision": 42,
  "actor": {
    "id": "npc.example.guard",
    "entityType": "npc"
  },
  "targets": [
    {
      "id": "device.example.main-door",
      "entityType": "device"
    }
  ],
  "preconditions": [
    {
      "contractVersion": "condition@0.1.0",
      "schemaId": "condition",
      "schemaVersion": 1,
      "type": "constant",
      "value": true
    }
  ],
  "payload": {
    "value": "open"
  }
}
```

## Known Limitations

- No production Command Bus exists.
- No production handler registry exists.
- No idempotency store or retry scheduler exists.
- No transaction boundary or commit logic is defined here.
- Context metadata is not a separate contract in this task.

## Deferred Decisions

- Concrete handler registry implementation.
- Durable deduplication retention.
- Request-context contract.
- Retry/backoff policy.
- Save/replay metadata policy.
- Plugin and capability ownership policy.
