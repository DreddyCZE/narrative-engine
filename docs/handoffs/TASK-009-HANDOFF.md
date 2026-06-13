# TASK-009 Handoff

## Outcome

TASK-009 defines the Command Contract as a draft contract and is in `REVIEW`.

## Implemented Boundaries

- Command expresses intent only and does not mutate Engine State directly.
- Command is separated from Handler, Condition, Effect, Transaction, and Domain Event semantics.
- Command planning produces a Command Plan with ordered, unconfirmed Effects.
- Preconditions use the Condition Contract and remain fail-closed.
- Invocation identity, idempotence metadata, and revision preconditions are explicit and bounded.
- Target and actor references use canonical entity identity rules.

## Changed Files

- `docs/contracts/COMMAND_CONTRACT.md`
- `schemas/command.schema.json`
- `tests/command-contract.test.ts`
- `tests/fixtures/contracts/command/**`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/tasks/review/TASK-009-design-command-contract.md`
- `docs/status/CURRENT_STATE.md`

## Test Fixtures

### Valid

- Minimal system command
- Command with actor
- Single-target command
- Multi-target command
- Payload command
- Expected revision `0`
- Inline precondition
- Named precondition reference
- Idempotency key
- Correlation and causation metadata

### Invalid

- Unknown root field
- Missing or invalid schemaVersion
- Invalid command type
- Invalid invocation ID
- Invalid actor reference
- Duplicate target
- Too many targets
- Invalid expectedRevision
- Executable field
- Forbidden nested payload key
- Invalid Condition shape
- Oversized payload

### Semantic Invalid

- Unknown command type
- Missing handler
- Actor not found
- Target not found
- Revision conflict
- Precondition false
- Precondition error
- Access denied
- Duplicate command ID
- Idempotency conflict
- Unsupported schema version
- Invalid planned Effect
- Plan budget exceeded
- Non-deterministic context

### Runtime Invalid

- Function
- Date
- Map
- Set
- `NaN`
- `Infinity`
- Cyclic object
- Forbidden nested key

## Test Coverage

- Envelope validation
- Valid fixture validation
- Invalid fixture rejection
- Semantic-invalid rejection
- Runtime-invalid pre-serialization rejection
- Deterministic planning
- Duplicate handling
- Revision conflict handling
- Precondition handling
- Immutable input handling
- Canonical serialization stability
- Regression checks for Entity Identity, Schema Versioning, Engine State, Condition, and Effect
  contracts

## Known Limits

- There is no production Command Bus or handler registry.
- The test planner is a contract oracle, not a production implementation.
- Runtime idempotency storage and scheduling remain deferred.
- Transaction semantics are not implemented here.

## False Positive / False Negative Risk

- False positives are possible if future command types reuse the same generic planning shapes.
- False negatives are possible for registry, authorization, or replay semantics that remain deferred.

## CI Impact

- `lint`, `typecheck`, `test`, `build`, `check:boundaries`, and `validate` are expected to pass on
  the current tree after review edits.
- Local Node 24 still emits the expected pnpm engine warning against the pinned Node 22 range.

## Security Impact

- The contract rejects executable data, forbidden nested keys, and unsupported runtime values.
- It keeps intent explicit and avoids direct committed-state writes.
- It does not grant authority or capability by itself.

## Recommended Next Task

Create the precise design task for the Transaction Contract.
