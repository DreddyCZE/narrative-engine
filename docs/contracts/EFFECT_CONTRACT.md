# Effect Contract

## Status

DRAFT

## Contract ID

effect

## Contract Version

effect@0.1.0

## Owner

`packages/engine-rules`; engine state owners and transaction boundary owners.

## Purpose

Effect defines declarative candidate-state changes. An Effect describes what should change in a
working or candidate Engine State; it does not commit, roll back, or emit a confirmed Domain Event.

## Terminology

- **Effect**: a declarative mutation request for a candidate state.
- **Committed state**: the authoritative Engine State already accepted by a prior transaction.
- **Working state**: a mutable or copy-on-write state used to prepare changes.
- **Candidate state**: a state that has been changed but not yet committed.
- **Target**: a safe location inside a state domain.
- **Guard**: an optional Condition that must resolve before the Effect can apply.
- **No-op**: a successful outcome where the Effect changes nothing because the candidate data already
  matches the requested result.

Normative terms use the usual meaning:

- **MUST** means required.
- **MUST NOT** means forbidden.
- **SHOULD** means recommended but not required.
- **MAY** means optional.

## Boundary to Command, Transaction, and Domain Event

- Command expresses intent.
- Effect expresses a concrete declarative change.
- Transaction applies a sequence of Effects atomically, validates the candidate state, and owns commit
  or rollback.
- Domain Event records the confirmed result after commit.

Effect MUST NOT commit, roll back, or emit a confirmed event by itself.

## Effect Result Model

An Effect application returns a discriminated result, not a bare boolean.

```json
{
  "status": "applied",
  "changes": [
    {
      "path": "/doors/main/state",
      "before": "closed",
      "after": "open"
    }
  ]
}
```

```json
{
  "status": "skipped",
  "reason": "guard-false",
  "changes": []
}
```

```json
{
  "status": "error",
  "diagnostics": [
    {
      "code": "STATE_PATH_NOT_FOUND",
      "message": "Effect target path could not be resolved",
      "path": "/target/path",
      "effectId": "effect.core.set-door-state"
    }
  ]
}
```

The first contract version recognizes:

- `applied`
- `no-op`
- `skipped`
- `error`

`no-op` is a success outcome. `no-op` does not by itself decide revision; Transaction will decide
commit semantics later.

## Effect Envelope

The canonical Effect envelope contains:

- `contractVersion`
- `schemaId`
- `schemaVersion`
- optional `effectId`
- `type`
- `target`
- type-specific fields
- optional `guard`

### Named and Inline Effects

- A reusable Effect SHOULD carry a stable `effectId`.
- An inline Effect MAY omit `effectId`.
- `effectId` MUST use the Entity Identity Contract when present.
- `effectId` is for referencability only and MUST NOT change the mutation result.

### Contract Identity

- `contractVersion` identifies the Effect Contract specification.
- `schemaVersion` identifies the serialized Effect envelope shape.
- `schemaVersion` is independent from any target domain schema version.
- Provenance and diagnostic annotations MAY be attached by future tooling, but they are not part of
  the mutation semantics defined here.

## Guard Policy

An Effect MAY include an optional `guard` Condition.

- `true` allows the Effect to apply.
- `false` returns `skipped` with reason `guard-false`.
- `error` returns `error` and MUST preserve diagnostics.
- A guard error MUST NOT be silently downgraded to `false`.
- A guard MUST be evaluated against the current candidate state as seen by the surrounding transaction
  pipeline.

## Target Model

Effect targets use a safe selector rooted at a declared state domain.

Canonical shape:

```json
{
  "domainId": "state-domain.core.world",
  "path": "/doors/main/state"
}
```

Rules:

- `domainId` MUST use the Engine State domain identifier grammar.
- `path` MUST be relative to the domain `data` root.
- `path` MUST follow the same JSON Pointer-like constraints as the Condition Contract.
- `path` value `/` addresses the domain data root. `set` MAY replace the full domain data object;
  `unset` MUST NOT target `/`.
- `path` MUST NOT address root envelope metadata.
- `path` MUST NOT target reserved metadata names such as `revision`, `schemaVersion`, `domainId`,
  `owner`, `authority`, or `persistence` when those names would be used to mimic envelope or domain
  descriptor metadata.
- `path` MUST NOT mutate `revision`, `schemaVersion`, `domainId`, ownership metadata, or authority
  metadata.
- `path` MUST reject prototype-pollution segments.
- The selector itself is not a permission grant.

## Atomic Effect Types

The first contract version supports:

- `set`
- `unset`
- `increment`
- `append`
- `remove-at`
- `add-unique`
- `remove-value`

The following are deferred:

- `merge-object`
- `copy`
- `insert`
- any game-specific mutation type

### `set`

- Replaces the target value.
- MAY create a leaf at an existing parent path if the target schema later allows it.
- MUST NOT create missing intermediate objects.
- If the canonical value is unchanged, the Effect returns `no-op`.

### `unset`

- Removes a present optional field.
- Missing optional targets return `no-op`.
- Required fields MUST NOT be removed.
- Root domain data MUST NOT be unset in v0.1.0.

### `increment`

- Adds a finite numeric delta to the current numeric target.
- Delta MAY be negative.
- A zero delta returns `no-op`.
- Non-finite results or integer overflow are errors.

### `append`

- Appends a JSON-safe value to the end of a list-like array.
- The target MUST be an array.
- `append` returns `applied` when it changes the array.

### `remove-at`

- Removes the element at a concrete array index.
- The index MUST be a non-negative integer in range.
- Out-of-range indices are errors.

### `add-unique`

- Adds a value only if it does not already exist in the collection.
- If the value already exists, the result is `no-op`.
- Mixed-type membership and duplicate-only ambiguities are errors.

### `remove-value`

- Removes a matching value from a set-like collection.
- If the value is absent, the result is `no-op`.
- Mixed-type membership and duplicate-only ambiguities are errors.

## Value Model

Effect values MUST use the same JSON-safe model as Engine State:

- object
- array
- string
- boolean
- integer
- finite number
- null only where explicitly allowed

When an Effect value is intended to carry a canonical entity reference, it MUST satisfy the Entity
Identity Contract. The Effect Contract itself does not reinterpret arbitrary values as references.

Effect values MUST NOT contain:

- `undefined`
- `NaN`
- `Infinity`
- `-Infinity`
- `bigint`
- function
- symbol
- Date
- Map
- Set
- class instances
- cyclic graphs
- executable code
- binary payloads without a dedicated contract

The object keys `__proto__`, `prototype`, and `constructor` are forbidden at any depth.

## No-op Policy

- `set` to the same canonical value returns `no-op`.
- `unset` of a missing optional field returns `no-op`.
- `increment` with a zero delta returns `no-op`.
- `add-unique` for an existing value returns `no-op`.
- `remove-value` for an absent value returns `no-op`.
- `remove-at` does not return `no-op` when the index is valid; it changes the array.

## Validation Boundary

- Local Effect application MAY produce a candidate value.
- Transaction validation MUST later verify the resulting candidate state.
- Effect success does not imply a valid transaction.
- Effect failure MUST leave the committed input unchanged.

## Access Boundary

- Targets do not grant permission.
- UI is not a muta­tion authority.
- Game data are not runtime mutation authority.
- Plugins MAY only mutate through future declared boundaries.
- Capability and permission rules are deferred.

## Determinism

An Effect result MUST depend only on:

- the explicit Effect
- the current candidate state
- the explicit guard
- the explicit caller context if one is later introduced by a future contract

An Effect MUST NOT depend on wall-clock time, randomness, filesystem, network, locale, or hidden
global mutable state.

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
  4. `effectId`
  5. `type`
  6. `target`
  7. `guard`
  8. `value`
  9. `delta`
  10. `index`
- Canonical `target` key order is `domainId`, then `path`.
- Operand arrays preserve authored order.
- Optional empty metadata blocks MAY be omitted.
- `undefined` MUST NOT appear.
- `null` MAY appear only where explicitly allowed.
- Object keys MUST be emitted in a stable canonical order.

## Budgets

The contract expects configurable budgets for:

- target path length
- value depth
- value size
- string length
- array length
- changed-node count
- diagnostic output size

Budget overflow MUST return `EFFECT_BUDGET_EXCEEDED`, not `no-op`.

## Diagnostics

Minimum diagnostic shape:

```json
{
  "code": "INVALID_EFFECT_SHAPE",
  "message": "Invalid effect declaration",
  "path": "/value",
  "effectId": "effect.core.set-door-state",
  "expected": "json-safe value",
  "actual": "function"
}
```

Diagnostics MUST NOT be localized player text.
Diagnostics SHOULD avoid copying sensitive state data.
Diagnostics MAY be used by editor and validation tools to explain why an Effect was skipped or failed.

## Security Considerations

- Path traversal and prototype pollution MUST be blocked.
- Effect data MUST NOT carry executable code.
- Root envelope metadata MUST be immutable from Effects.
- Schema downgrade and unknown newer schema handling MUST be explicit, not silent.
- Large values and deep objects MUST respect configured budgets.
- Diagnostics MUST avoid leaking secrets or hidden content.

## Examples

Set a flag:

```json
{
  "contractVersion": "effect@0.1.0",
  "schemaId": "effect",
  "schemaVersion": 1,
  "type": "set",
  "target": { "domainId": "state-domain.core.flags", "path": "/paused" },
  "value": true
}
```

Increment a counter:

```json
{
  "contractVersion": "effect@0.1.0",
  "schemaId": "effect",
  "schemaVersion": 1,
  "type": "increment",
  "target": { "domainId": "state-domain.core.clock", "path": "/tick" },
  "delta": 1
}
```

## Known Limitations

- The contract does not define transaction ordering.
- The contract does not define commit or rollback.
- The contract does not define production registry lookup.
- The contract does not define copy or merge semantics.
- The contract does not define contextual reads from state or caller context in the first version.

## Deferred Decisions

- Context-based effect operands.
- Copy and merge object effects.
- Insert semantics for arrays.
- Registry implementation and capability enforcement.
- Effect sequencing and transaction composition.
