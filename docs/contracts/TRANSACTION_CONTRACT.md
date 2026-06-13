# Transaction Contract

## Status

DRAFT

## Contract ID

transaction

## Contract Version

transaction@0.1.0

## Owner

`packages/engine-transaction`; engine state owners and transaction boundary owners.

## Purpose

Transaction defines the atomic application boundary for an ordered Effect plan. It accepts a
validated Transaction input, creates a working or candidate state, applies Effects in declared
order, validates the candidate result, and either commits a new committed Engine State or rolls back
without mutating the original committed state.

## Terminology

- **Transaction**: the declarative process that applies ordered Effects atomically.
- **Transaction input**: the canonical envelope describing the committed base revision, source,
  ordered Effects, and transaction metadata.
- **Working state**: a mutable or copy-on-write state used while applying Effects.
- **Candidate state**: a state that has been changed but not yet committed.
- **Committed state**: the authoritative Engine State already accepted by a prior transaction.
- **Transaction result**: the canonical outcome of transaction processing.
- **No-op**: a successful result where the canonical committed state would not change.

Normative terms use the usual meaning:

- **MUST** means required.
- **MUST NOT** means forbidden.
- **SHOULD** means recommended but not required.
- **MAY** means optional.

## Boundary to Command, Effect, Domain Event, and Save

- Command produces a valid Command Plan or equivalent ordered Effect plan.
- Effect expresses one atomic candidate-state change.
- Transaction applies ordered Effects, validates the candidate state, commits or rolls back, and
  owns revision changes.
- Domain Event records the confirmed result only after a successful commit.
- Save stores a committed snapshot in a save envelope outside this contract.

Transaction MUST NOT be a Command Bus, Effect Executor registry, Event Store, or Save system.

## Transaction Input

Transaction accepts a canonical input envelope.

```json
{
  "schemaVersion": 1,
  "transactionId": "transaction.runtime.open-main-door",
  "baseRevision": 42,
  "source": {
    "kind": "command-plan",
    "commandId": "command.runtime.open-main-door"
  },
  "effects": []
}
```

### Input policy

- `baseRevision` MUST be present and MUST be a non-negative integer.
- `effects` MUST be an explicit ordered list.
- `transactionId` MAY be present for audit, replay, or correlation.
- `transactionId` MUST use the Entity Identity Contract when present.
- `transactionId` SHOULD be assigned by ingress or upstream orchestration, not generated inside the
  transaction application step.
- `source` MUST be explicit.
- `source.kind` MAY be `command-plan` or `system`.
- A command-plan source SHOULD carry `commandId` when known.
- A system transaction MUST be explicitly marked and separately authorized by future policy.
- A source MAY set `allowNoOp` to `false` when the caller requires a state change.
- Transaction input MAY carry correlation or idempotence metadata, but those fields are diagnostic
  or deduplication aids and not commit semantics.

## Lifecycle

The normative lifecycle is:

1. received
2. input-validated
3. initial-revision-check
4. working-created
5. effects-applied
6. candidate-validating
7. final-revision-check
8. committed, rolled-back, rejected, or error

Transaction MUST create Working State before applying Effects and MUST keep the original committed
state unchanged if any failure occurs.
Transaction MUST check `baseRevision` before any Working State is created and MUST check the
current committed revision again immediately before any commit path. No-op results MAY exit before
the final commit check because no commit will occur.

## Revision Policy

- The initial committed snapshot has revision `0`.
- `baseRevision` MUST match the current committed revision at the initial revision check.
- A mismatch at the initial revision check MUST return `REVISION_CONFLICT` with a `rejected`
  transaction result.
- The committed revision MUST be checked again immediately before commit on every path that would
  commit.
- A mismatch at the final revision check MUST return `REVISION_CONFLICT` with a `rolled-back`
  transaction result if Working State or Candidate State already existed.
- Revision mismatch MUST be detected before any commit.
- If commit succeeds, revision MUST increase exactly by `1`.
- Revision MUST NOT change on rollback, rejection, or error.
- Revision overflow MUST be an error.
- Revision is not transactionId, commandId, or schemaVersion.

### No-op policy

- If the canonical committed state is byte-for-byte unchanged after processing, the default result is
  `no-op`.
- `no-op` MUST NOT increase revision.
- A transaction with an empty effect list MAY be valid and MAY resolve to `no-op`.
- Audit-only state changes belong to a later event or audit contract, not to implicit revision bumps.

## Atomicity Policy

Transaction MUST be atomic with respect to committed state.

- All Effects apply to Working State or Candidate State.
- Any failure after working state creation MUST roll back the whole transaction.
- The original committed state MUST remain byte-for-byte identical after rollback.
- No partial candidate state MAY be published as committed.
- A transaction result MAY include diagnostics, but diagnostics do not authorize a partial commit.

## Effect Ordering

- Effects MUST apply in the order provided by the input.
- Effects MUST NOT be automatically sorted.
- The effect order is semantic.
- Repeated writes to the same target path in one transaction MAY be rejected as effect-order
  ambiguity in this version if the implementation cannot prove an unambiguous canonical outcome.
- A guard on each Effect is evaluated against the current Candidate State immediately before that
  Effect is considered.
- If an Effect returns `skipped`, processing continues with later Effects.
- If an Effect returns `no-op`, processing continues with later Effects.
- If an Effect returns `error`, Transaction MUST roll back.

## Transaction Result Model

Transaction returns a discriminated result, not a bare boolean.

```json
{
  "status": "committed",
  "baseRevision": 42,
  "newRevision": 43,
  "changes": []
}
```

```json
{
  "status": "no-op",
  "baseRevision": 42,
  "newRevision": 42,
  "changes": []
}
```

```json
{
  "status": "rolled-back",
  "reason": "effect-error",
  "diagnostics": []
}
```

```json
{
  "status": "rejected",
  "reason": "revision-conflict",
  "diagnostics": []
}
```

```json
{
  "status": "error",
  "diagnostics": []
}
```

### Result semantics

- `committed` means the candidate state was valid, different from the original committed state, and
  was atomically committed with revision incremented by `1`.
- `no-op` means the pipeline completed without error but the canonical committed state would not
  change.
- `rolled-back` means an Effect or candidate validation failed after working state creation.
- `rejected` means the transaction was refused before commit, such as a revision conflict or an
  authorization denial.
- `error` means a contract, validation, or processing failure that is not a legitimate rejection.

`REVISION_CONFLICT` is a `rejected` outcome at the initial revision check and a `rolled-back`
outcome at the final revision check when mutational work already occurred.

## Validation Layers

Transaction MUST order validation explicitly.

1. Input validation:
   - transaction envelope
   - schema version
   - baseRevision
   - ordered Effect shapes
   - transaction metadata

2. Pre-application validation:
   - source shape
   - authorization or capability boundary, if simulated
   - effect target availability according to current state

3. Candidate validation:
   - structural validation
   - domain schema validation
   - referential validation
   - semantic invariants
   - protected metadata invariants
   - revision rule

4. Post-commit validation:
   - committed state revision matches the result
   - canonical serialization remains stable
   - result metadata matches the committed outcome

## Protected Metadata

Transaction MUST protect the following metadata from illegal mutation by Effects or Candidate
State:

- root `schemaVersion`
- root `revision` outside the commit step
- root identity or run identity
- domainId
- domain schemaId
- domain schemaVersion
- owner
- authority
- persistence
- other descriptor metadata

An Effect target into protected metadata is an error. If candidate validation detects protected
metadata drift, the transaction MUST fail.

## No-op Transaction Policy

- An empty effect list is valid and MAY resolve to `no-op`.
- If every Effect is `skipped`, the transaction is `no-op`.
- If every Effect is `no-op`, the transaction is `no-op`.
- If some Effects apply but the final canonical committed state matches the original state, the
  transaction is `no-op`.
- If the source declares `allowNoOp: false` and the final canonical state would not change, the
  transaction is rejected.
- `no-op` MUST NOT increment revision.

## Transaction Context

Transaction MAY accept explicit context.

- Context MUST be JSON-safe if present.
- Context MUST be explicit and deterministic.
- Context MUST NOT be a hidden global runtime dependency.
- Context MAY carry authorization claims for future policy decisions, but claims are not permission
  by themselves.

## Authorization Boundary

Transaction MUST separate validation from authorization.

- A valid input plan is not automatically authorized.
- Effect targets do not grant access.
- Ownership metadata does not grant permission.
- `ACCESS_DENIED` is distinct from `REVISION_CONFLICT`.
- Capability policy is deferred to a later contract.

## Domain Event Boundary

Transaction defines only the boundary.

- A future Domain Event Contract may use transactionId, commandId, old revision, new revision, and
  effect results after a successful commit.
- Transaction MUST NOT define or emit confirmed events.
- Transaction rollback or error MUST NOT create confirmed Domain Events.

## Save Boundary

Transaction commit creates a new committed state snapshot only.

- It MUST NOT create a save envelope.
- It MUST NOT write a save slot.
- It MUST NOT manage screenshots, checksums, or cloud sync.
- Save is a later contract that consumes the committed snapshot.

## Determinism

Transaction results MAY depend only on:

- the canonical committed state
- the transaction input
- the ordered Effect list
- the explicit context
- registered contract schemas and evaluators for the current version

Transaction MUST NOT depend on wall-clock time, RNG without explicit input, filesystem, network,
environment variables, locale, or unstable object-key order.

## Concurrency

Transaction uses optimistic concurrency.

- Each input carries `baseRevision`.
- Commit MUST re-check the current committed revision.
- If another transaction has already changed the state, this transaction MUST be rejected with
  `REVISION_CONFLICT`.
- Transaction MUST NOT auto-rebase.
- Retry is the caller's responsibility or a future scheduler/command policy.

## Idempotence

Transaction MAY use `transactionId` and source metadata for deduplication.

- A known duplicate transactionId MUST NOT be committed as a fresh change.
- If the previous result is known, a duplicate MAY return the original result envelope.
- If the duplicate conflicts with a different input, it MUST be an error.
- Idempotence storage and retention are deferred.

## Error Model

Stable error codes include:

- `INVALID_TRANSACTION_SHAPE`
- `INVALID_EFFECT_PLAN`
- `UNKNOWN_EFFECT_TYPE`
- `SCHEMA_VERSION_UNSUPPORTED`
- `REVISION_CONFLICT`
- `EFFECT_ERROR`
- `GUARD_ERROR`
- `ACCESS_DENIED`
- `CANDIDATE_STATE_INVALID`
- `PROTECTED_METADATA_MUTATION`
- `RESULTING_STATE_INVALID`
- `TRANSACTION_BUDGET_EXCEEDED`
- `NON_SERIALIZABLE_VALUE`
- `FORBIDDEN_OBJECT_KEY`
- `ATOMICITY_VIOLATION`

Diagnostics MUST be deterministic, redact sensitive values unless explicitly permitted, and use a
stable path format.

## Canonical Serialization

Transaction input and result MUST be canonical serializable.

- UTF-8
- LF
- 2-space indentation
- final newline
- stable key order
- preserved ordered effects
- stable diagnostic order
- omitted empty optional blocks
- no `undefined`
- explicit `null` policy
- idempotent canonicalization

## Budgets

Transaction MUST support configurable limits for:

- number of Effects
- transaction input size
- candidate size
- changed path count
- object depth
- diagnostic count
- validation passes
- state reads and writes

Budget overflow MUST be an explicit error or rejection depending on the phase, never a silent
no-op.

## Security Considerations

- Partial commits MUST be impossible.
- Prototype pollution and forbidden keys MUST be rejected.
- Transaction data MUST NOT contain executable code.
- A transaction plan MUST NOT select handlers by untrusted module path.
- Revision conflicts, replay abuse, and protected metadata mutation are explicit failure modes.
- Transaction input does not authorize itself.

## Examples

### Minimal command-plan transaction

```json
{
  "schemaVersion": 1,
  "baseRevision": 42,
  "source": {
    "kind": "command-plan",
    "commandId": "command.runtime.open-main-door"
  },
  "effects": []
}
```

### Ordered effects

```json
{
  "schemaVersion": 1,
  "transactionId": "transaction.runtime.open-main-door",
  "baseRevision": 42,
  "source": {
    "kind": "system",
    "systemId": "scheduler.core.tick"
  },
  "effects": [
    { "contractVersion": "effect@0.1.0", "schemaId": "effect", "schemaVersion": 1, "type": "set", "target": { "domainId": "state-domain.core.world", "path": "/doors/main/state" }, "value": "open" }
  ]
}
```

## Known Limitations

- There is no production Transaction Manager yet.
- There is no Event Store or Save system here.
- Deduplication storage and retry scheduling are deferred.
- Authorization remains a boundary, not an implemented subsystem.

## Deferred Decisions

- Whether future implementations require transactionId for all external transactions.
- The final shape of a shared idempotency store.
- Whether system transactions need a separate audit schema.
- Domain Event and Save integration details.
