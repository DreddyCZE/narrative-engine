# TASK-008 Handoff

## Outcome

TASK-008 defines the Effect Contract as a draft contract and is closed as `DONE`.

## Implemented Boundaries

- Effect is declarative candidate-state mutation data only.
- Effect does not commit, roll back, or emit Domain Events.
- Effect is separated from Command intent and Transaction orchestration.
- Guard evaluation uses the Condition Contract and fail-closed behavior.
- Targets are constrained to `domainId + path` under domain data.
- Supported atomic types are `set`, `unset`, `increment`, `append`, `remove-at`, `add-unique`,
  and `remove-value`.
- Runtime-invalid values are rejected before evaluation.

## Changed Files

- `docs/contracts/EFFECT_CONTRACT.md`
- `schemas/effect.schema.json`
- `tests/effect-contract.test.ts`
- `tests/fixtures/contracts/effect/**`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/tasks/review/TASK-008-design-effect-contract.md`
- `docs/status/CURRENT_STATE.md`

## Test Fixtures

### Valid

- `minimal.json`
- `set-string.json`
- `set-boolean.json`
- `set-entity-reference.json`
- `unset-optional.json`
- `increment.json`
- `decrement.json`
- `append.json`
- `remove-at.json`
- `add-unique.json`
- `remove-value.json`
- `guard-true.json`
- `guard-false.json`

### Invalid

- Unknown effect type
- Missing or invalid schema version
- Invalid target and forbidden path segments
- Reserved metadata target paths
- Invalid entity references
- Oversized values
- Executable source fixture

### Semantic Invalid

- Missing state domain
- Missing required target
- Type mismatch
- Unsupported domain schema version
- Access denied
- Guard error
- Numeric overflow
- Array index out of range
- Duplicate set-like collections
- Resulting domain invalid
- Unknown newer schema
- Budget exceeded

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

- Effect contract shape validation
- Valid fixture validation
- Invalid fixture rejection
- Semantic-invalid fixture rejection
- Runtime-invalid pre-serialization rejection
- Deterministic set/unset/numeric/array application
- Fail-closed guard handling
- Canonical serialization stability
- Regression checks for Entity Identity, Schema Versioning, Engine State, and Condition contracts

## Known Limits

- JSON Schema validates structure, not full runtime semantic correctness.
- Semantic invalid cases are enforced by the test oracle, not a production executor.
- No production Effect Executor, Transaction Manager, or Domain Event system exists.

## False Positive / False Negative Risk

- False positives are possible if future domain-specific effect types reuse the same path and value
  shapes as the generic oracle.
- False negatives are possible for graph-level or capability-based semantics that remain deferred to
  later contracts.

## CI Impact

- `lint`, `typecheck`, `test`, `build`, `check:boundaries`, and `validate` all pass on the current
  tree.
- Local Node 24 emits the expected pnpm engine warning against the pinned Node 22 range.

## Security Impact

- The contract rejects executable data, forbidden object keys, and unsupported runtime values.
- It keeps mutation explicit and avoids direct committed-state writes.
- It does not grant authority or capability by itself.

## Recommended Next Task

Create the precise design task for the Command Contract.
