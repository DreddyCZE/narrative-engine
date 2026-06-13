# Condition Contract

## Status

DRAFT

## Contract ID

condition

## Contract Version

condition@0.1.0

## Owner

`packages/engine-rules`; engine rules and contract owners.

## Purpose

Condition defines declarative, data-only predicates that read committed Engine State and return a
deterministic boolean result or an explicit evaluation error. The contract is intentionally read-only and
fail-closed.

## Terminology

- **Condition**: a declarative predicate description.
- **Condition envelope**: the canonical serialized condition object.
- **Named condition**: a reusable condition that carries a stable `conditionId`.
- **Inline condition**: a condition without a `conditionId`.
- **Committed state**: the authoritative Engine State visible to evaluation.
- **Evaluation context**: an explicit, deterministic input object provided by the caller.
- **Selector**: a safe address for reading committed Engine State domain data.
- **Semantic error**: a contract-valid structure whose meaning cannot be resolved safely at runtime.

Normative terms in this document use the usual meaning:

- **MUST** means required.
- **MUST NOT** means forbidden.
- **SHOULD** means recommended but not required.
- **MAY** means optional.

## Evaluation Result Model

Condition evaluation uses a discriminated result, not a bare boolean.

```json
{
  "status": "resolved",
  "value": true
}
```

```json
{
  "status": "error",
  "diagnostics": [
    {
      "code": "STATE_PATH_NOT_FOUND",
      "message": "Condition path could not be resolved",
      "path": "/operands/0/selector/path",
      "conditionId": "condition.core.can-enter"
    }
  ]
}
```

`unknown` is reserved for future use and is not produced by this contract version. A non-boolean outcome
MUST be represented as `error`, not as `false`.

## Condition Envelope

The canonical condition envelope contains:

- `contractVersion`
- `schemaId`
- `schemaVersion`
- optional `conditionId`
- `type`
- type-specific fields

### Named and Inline Conditions

- A reusable named condition SHOULD carry a stable `conditionId`.
- An inline condition MAY omit `conditionId`.
- `conditionId` MUST use the Entity Identity Contract when present.
- `conditionId` MUST be canonical; aliases are resolved before evaluation.
- `conditionId` is for referencability only and MUST NOT change the logical result.

### Contract Identity

- `contractVersion` identifies the Condition Contract specification.
- `schemaVersion` identifies the serialized envelope shape for this contract.
- `schemaVersion` is not the same thing as a referenced state schema version.

## Composition Model

The first contract version supports:

- `all`
- `any`
- `not`

### `all`

- `all` MUST evaluate to `true` when it has zero operands.
- Operand order MUST be preserved for evaluation and diagnostics.
- Production evaluation MAY short-circuit left-to-right.
- Diagnostic evaluation MAY inspect more operands, but the final boolean result MUST stay stable.

### `any`

- `any` MUST evaluate to `false` when it has zero operands.
- Operand order MUST be preserved for evaluation and diagnostics.
- Production evaluation MAY short-circuit left-to-right.
- If an evaluated operand errors, the whole node MUST error.

### `not`

- `not` MUST have exactly one operand.
- `not` MUST NOT convert operand errors into `true`.

## Atomic Condition Types

The first contract version supports:

- `constant`
- `exists`
- `compare`
- `contains`
- `entity-is`
- `domain-exists`
- `condition-ref`

### `constant`

Returns an explicit boolean value.

### `exists`

Checks whether a selector resolves to a present value in committed state. Presence is not truthiness.

### `compare`

Compares two operands with an explicit operator:

- `eq`
- `neq`
- `lt`
- `lte`
- `gt`
- `gte`

### `contains`

Checks membership of a member in a supported collection or substring containment in an explicitly declared
string collection.

### `entity-is`

Compares canonical entity references for exact identity equality.

### `domain-exists`

Checks whether a declared state domain is present in committed state.

### `condition-ref`

References another named condition by canonical `targetConditionId`.

## Operand Model

Operands use a discriminated union.

- `literal`
- `state-value`
- `entity-reference`
- `context-value`
- `condition-ref`

### Literal

Literal operands MUST be JSON-safe and MUST NOT contain executable code.

### State Value

State-value operands read from a safe selector rooted at a declared state domain.

### Entity Reference

Entity-reference operands MUST use canonical Entity Identity IDs.

### Context Value

Context-value operands read from the explicit evaluation context only. They MUST NOT read hidden global
state.

### Condition Reference

Condition-reference operands point to a named condition. Cycles are forbidden and are semantic blockers.

## State Selector

Condition state selectors address committed Engine State domain data, not root envelope internals.

Selector shape:

```json
{
  "domainId": "state-domain.core.clock",
  "path": "/tick"
}
```

Rules:

- `domainId` MUST use the Engine State domain identifier grammar.
- `path` MUST be a JSON Pointer-like path relative to the domain `data` root.
- `path` MUST start with `/`.
- `path` `/` addresses the domain data root.
- `..` segments are forbidden.
- `__proto__`, `prototype`, and `constructor` segments are forbidden.
- Selector evaluation MUST distinguish missing paths from `null`.
- Selector evaluation MUST NOT use JavaScript property expressions.
- Selector evaluation MUST NOT grant access rights by itself.

## Evaluation Context

The evaluation context is explicit input and is optional unless the selected condition type needs it.
The context MAY contain:

- `schemaVersion`
- `actor`
- `target`
- `location`
- `source`
- `initiator`
- `mode`

Context values MUST be JSON-safe.
Context MUST NOT contain callbacks, system time, RNG, filesystem access, network access, or environment
access.
The same committed state, same condition, and same context MUST produce the same result.

## Type and Comparison Rules

- No implicit coercion is allowed between string, number, and boolean values.
- `1` is not equal to `"1"`.
- `true` is not equal to `1`.
- String comparison MUST be deterministic and locale-independent.
- Numeric comparison MUST reject non-finite numbers.
- Entity IDs MUST compare by canonical byte-for-byte equality.
- `-0` MUST be canonicalized or rejected consistently with the Engine State Contract.

## Reference Policy

- Named conditions MAY reference other named conditions.
- `condition-ref` MUST resolve to a canonical `conditionId`.
- Aliases MUST be resolved before evaluation.
- Dangling references are semantic errors.
- Reference cycles are semantic blockers.
- Condition references MUST NOT silently fall back to `false`.

## Registry Boundary

This contract defines the boundary for a future condition type registry only.

- Built-in types are reserved by the engine.
- Game or module condition types MUST use their own declared ownership namespace.
- Unknown condition types are errors.
- A type MUST NOT be silently reinterpreted with a different meaning at the same version.

The runtime registry itself is out of scope.

## Error Propagation

- A condition error MUST remain distinguishable from `false`.
- Fail-closed behavior is the default for public gameplay decisions.
- UI or preview callers MAY map an error to an unavailable choice, but they MUST preserve diagnostics.
- In `all` and `any`, an evaluated operand error aborts the node.
- A non-evaluated branch in short-circuit mode MUST NOT invent an error.

## Canonical Serialization

Canonical serialization MUST be:

- UTF-8
- LF line endings
- 2-space indentation
- final newline present
- stable key order
- idempotent

Rules:

- Operand arrays preserve authored order.
- `all` and `any` operands MUST NOT be auto-sorted.
- Optional empty metadata blocks MAY be omitted.
- `undefined` MUST NOT appear.
- `null` MAY appear only where explicitly allowed.
- Object keys in serialized JSON MUST be emitted in a stable canonical order.

## Evaluation Budgets

Budgets are configurable and versioned by the evaluator, not by state.

The contract expects limits for:

- condition tree depth
- node count
- operand count
- state reads
- path length
- literal size
- reference depth
- diagnostic output size

Budget overflow MUST be an error, not `false`.

## Diagnostics

Minimum diagnostic shape:

```json
{
  "code": "UNKNOWN_CONDITION_TYPE",
  "message": "Unsupported condition type",
  "path": "/type",
  "conditionId": "condition.core.example",
  "expected": "all|any|not|constant|exists|compare|contains|entity-is|domain-exists|condition-ref",
  "actual": "unexpected-type"
}
```

Diagnostics MUST NOT be treated as localized player text.
Diagnostics SHOULD avoid copying sensitive state data.
Explain mode MAY include child results and evaluated paths, but it MUST NOT change the final boolean result.

## Determinism

Condition evaluation MUST depend only on:

- the committed snapshot
- the condition declaration
- the explicit evaluation context

It MUST NOT depend on:

- host time
- RNG
- filesystem
- network
- environment variables
- hidden mutable singleton state

## Security Considerations

- Expression injection is forbidden.
- Selector traversal outside the declared domain is forbidden.
- Prototype pollution keys are forbidden.
- Recursive references must be bounded.
- ReDoS-prone regex support is deferred.
- Condition data MUST NOT determine executable code loading.
- Access policy is deferred to a future capability contract; selector syntax is not authorization.

## Examples

```json
{
  "contractVersion": "condition@0.1.0",
  "schemaId": "condition",
  "schemaVersion": 1,
  "type": "constant",
  "value": true
}
```

```json
{
  "contractVersion": "condition@0.1.0",
  "schemaId": "condition",
  "schemaVersion": 1,
  "type": "exists",
  "selector": {
    "domainId": "state-domain.core.clock",
    "path": "/tick"
  }
}
```

```json
{
  "contractVersion": "condition@0.1.0",
  "schemaId": "condition",
  "schemaVersion": 1,
  "conditionId": "condition.core.can-enter",
  "type": "all",
  "operands": [
    {
      "type": "domain-exists",
      "domainId": "state-domain.world.rooms"
    },
    {
      "type": "not",
      "operands": [
        {
          "type": "constant",
          "value": false
        }
      ]
    }
  ]
}
```

```json
{
  "contractVersion": "condition@0.1.0",
  "schemaId": "condition",
  "schemaVersion": 1,
  "conditionId": "condition.core.can-enter",
  "type": "condition-ref",
  "targetConditionId": "condition.core.check-guard"
}
```

## Known Limitations

- The runtime resolver does not exist yet.
- This contract does not implement a capability system.
- Regex-based matching is deferred.
- The contract does not define the full Validation Diagnostic Contract.
- The contract does not define game-specific condition semantics.

## Deferred Decisions

- Final condition type registry model.
- Capability and permission contract for cross-domain reads.
- Regex support, if any.
- Future explain trace envelope.
- Whether additional count-based combinators beyond `all`, `any`, and `not` are needed.
- Whether context can include future call-site hints beyond the listed bindings.
