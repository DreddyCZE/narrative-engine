# Validation Diagnostic Contract

## Status

DRAFT

## Contract ID

validation-diagnostic

## Contract Version

validation-diagnostic@0.1.0

## Owner

`packages/validation`; validation owners and diagnostic boundary owners.

## Purpose

Validation Diagnostic defines stable, serializable, redaction-safe diagnostics for validation,
planning, transaction, event, authoring, and migration workflows. It is a structured contract for
finding and explaining problems. It is not a logger, exception hierarchy, telemetry envelope, or
player-facing text system.

## Terminology

- **Diagnostic**: a JSON-safe structured finding about a problem, warning, or informational result.
- **Diagnostic instance**: one occurrence of a diagnostic in a specific validation context.
- **Diagnostic code**: the stable machine-readable identity of the diagnostic type.
- **Diagnostic envelope**: the canonical serialized diagnostic object.
- **Aggregate result**: a wrapper that summarizes a set of diagnostics.
- **Severity**: how strongly the diagnostic affects the current operation.
- **Category**: a coarse bucket used for filtering and reporting.
- **Phase**: the lifecycle step where the diagnostic was produced.
- **Location**: a structured pointer to a document, state path, schema path, event batch entry, or
  other bounded location.
- **Source reference**: a structured pointer to the object that produced or owns the diagnostic.
- **Related reference**: a bounded reference to another diagnostic-relevant entity.
- **Redaction**: replacing sensitive or oversized values with a safe marker.
- **Fingerprint**: a canonical tuple used for deduplication and deterministic ordering.
- **Player-facing message**: localized text shown to a player, built outside this contract.
- **Authoring message**: text shown to an author or developer, optionally derived from this contract.

Normative terms use the usual meaning:

- **MUST** means required.
- **MUST NOT** means forbidden.
- **SHOULD** means recommended but not required.
- **MAY** means optional.

## Boundary to Other Outputs

- Diagnostic is a structured result of validation or processing.
- Exception is a host-language failure mechanism and is not the public diagnostic contract.
- Log entry is a runtime or audit record and is not the same thing as a diagnostic.
- Player-facing message is localized text and is not identical to a diagnostic.
- Authoring message is developer-facing and may be derived from a diagnostic, but is not the
  contract identity.

Diagnostic MUST NOT be the only source of user-visible text. Diagnostic MUST NOT carry stack traces
or executable code.

## Envelope

The canonical diagnostic is an immutable JSON-safe envelope.

```json
{
  "contractVersion": "validation-diagnostic@0.1.0",
  "schemaId": "validation-diagnostic",
  "schemaVersion": 1,
  "ownerContract": "transaction@0.1.0",
  "diagnosticId": "validation-diagnostic.transaction.revision-conflict-0",
  "code": "REVISION_CONFLICT",
  "severity": "error",
  "category": "concurrency",
  "phase": "final-revision-check",
  "message": "Transaction base revision does not match the current committed revision.",
  "location": {
    "kind": "document",
    "path": "/baseRevision"
  },
  "source": {
    "kind": "transaction",
    "id": "transaction.runtime.open-main-door"
  }
}
```

- `schemaVersion` MUST be a positive integer.
- `diagnosticId` is optional. When present, it MUST use the Entity Identity Contract.
- The canonical diagnostic identity entity type is `validation-diagnostic`.
- `code` is the primary type identity.
- `message` is a stable developer-facing fallback, not a localization key.
- `timestamp` is intentionally not part of the core envelope.
- `source`, `location`, `related`, `expected`, and `actual` are optional and are included only when
  they add safe value.
- `ownerContract` is optional but SHOULD be present when a diagnostic crosses producer boundaries.
- `metadata` is optional structured context that MAY carry safe, redaction-aware metadata. It is not
  part of stable identity.

## Identity and Versioning

- `contractVersion` identifies the public Diagnostic Contract.
- `schemaVersion` identifies the serialized diagnostic envelope shape.
- A change in the meaning of an existing diagnostic code is a breaking change.
- Adding a new code is compatible when it does not alter the meaning of existing codes.
- Removing a code is breaking.
- Changing the default severity or category of an existing code is breaking unless the change is
  explicitly versioned.

## Code Grammar

Canonical diagnostic codes use uppercase constants with underscore separators.

- A code MUST match `^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$`.
- A code MUST be at least 3 characters long.
- A code SHOULD be at most 64 characters long.
- A code MUST NOT begin or end with `_`.
- A code MUST NOT contain `__`.
- A code MUST NOT contain whitespace, lowercase letters, or executable content.
- A code MUST NOT contain hyphens or dots.
- A code is not a localization key.
- A code is not a message.
- A code is not an ID for an event, command, transaction, or state entity.

The canonical registry key is the tuple `(owner contract, code)`. The same code string MAY exist in
multiple contracts when the owning contract and meaning are explicit. Diagnostic consumers MUST use
owner context, phase, and location when they need to disambiguate same-spelled codes.
There is no global reserved prefix beyond the uppercase-constant shape; collision handling is owned
by the contract registry boundary rather than by a universal namespace rule.

## Owner Context

- `ownerContract` is an optional serialized field containing the versioned owner contract identity
  of the diagnostic producer, such as `transaction@0.1.0`.
- When `ownerContract` is absent, the registry owner context MUST be available from the producing
  contract boundary, adapter metadata, or another unambiguous producer-provided context when
  diagnostics cross package, file, or API boundaries.
- Consumers MUST NOT infer owner context from phase alone.
- Consumers MUST NOT treat `source` as a substitute for owner context.
- A canonical adapter that normalizes legacy diagnostics into this contract MUST attach the owner
  contract from the originating contract registry entry.

## Severity

- `info`: informative only; the operation may continue.
- `warning`: the operation may continue but the result deserves attention.
- `error`: the current object or operation is not valid for the requested outcome.
- `fatal`: the current result is unsafe or structurally broken enough that the broader pipeline must
  stop.

Severity is not HTTP status, not player importance, and not a logging level.

## Category

Canonical categories are limited to:

- `shape`
- `schema`
- `identity`
- `reference`
- `type`
- `validation`
- `state`
- `condition`
- `effect`
- `command`
- `transaction`
- `event`
- `concurrency`
- `authorization`
- `security`
- `budget`
- `serialization`
- `migration`
- `internal`

Category is metadata only. Code remains the primary identity.

## Phase

Phase uses a lowercase registry-defined key.

- Core phases include `parse`, `pre-serialization`, `shape-validation`, `schema-validation`,
  `identity-validation`, `reference-validation`, `semantic-validation`, `authorization`,
  `condition-evaluation`, `effect-application`, `command-planning`, `initial-revision-check`,
  `candidate-validation`, `final-revision-check`, `commit`, `event-materialization`,
  `authoring`, and `migration`.
- Unknown extension phases MAY be preserved as namespaced lowercase keys.
- A phase MUST be deterministic and MUST describe where the diagnostic was produced.

## Location and Path

Location is a discriminated union for bounded locations in documents, state, schemas, and batches.

Supported location kinds are:

- `document`
- `state`
- `schema`
- `event`
- `batch`

Location paths use JSON Pointer semantics.

- `document` locations use `path`.
- `state` locations use `domainId` and `path`.
- `schema` locations use `schemaId` and `path`.
- `event` locations use `transactionId`, `revision`, `sequence`, and optional `path`.
- `batch` locations use `transactionId`, `previousRevision`, `revision`, and optional `index`.

The location model is intentionally structured so that effect indices, command preconditions, event
indices, and schema paths can be represented without host-language stack traces.

## Source and Related References

Source reference identifies the producer or owner of the diagnostic.

Supported source kinds include:

- `entity`
- `schema`
- `state-domain`
- `condition`
- `effect`
- `command`
- `transaction`
- `domain-event`
- `file`
- `document`
- `plugin`
- `system`

Related references are a bounded list of additional references.

- Related references MUST be finite and deduplicated.
- Related references MUST NOT form unbounded graphs.
- Related references MUST preserve deterministic order.
- Related references are not authorization claims.

## Message Policy

- `message` is required for a diagnostic envelope.
- `message` MUST be concise and developer-facing.
- `message` MUST NOT be the only stable identity of the diagnostic.
- `message` MUST NOT be treated as a localization key.
- `message` MUST NOT contain stack traces.
- `message` SHOULD avoid sensitive actual values unless the value is explicitly redacted or safe.
- `metadata` MUST NOT be used as a deduplication key.

Optional localization parameters are deferred. UI and authoring layers SHOULD map `code` to localized
text outside this contract.

## Expected and Actual

`expected` and `actual` MAY be present when comparison context is safe to expose.

- The default value model is scalar-safe and JSON-safe.
- Large objects, secrets, and unsupported host values MUST be redacted.
- The contract supports a redacted marker instead of forcing unsafe serialization.
- `expected` and `actual` MUST NOT carry executable code.

## Metadata

`metadata` is optional structured context for safe, non-authoritative annotations.

- `metadata` MUST be JSON-safe.
- `metadata` MUST NOT contain stack traces or executable code.
- `metadata` MUST NOT override `code`, `severity`, `category`, `phase`, or any reference field.
- `metadata` MUST NOT be part of the stable fingerprint.
- `metadata` SHOULD remain small and redaction-aware.

## Redaction

Redaction is the safe default.

- `sensitive`: the value would expose private or privileged data.
- `too-large`: the value exceeds the safe payload budget.
- `not-serializable`: the value cannot be serialized safely.
- `security-policy`: the value is withheld by policy.
- `unsupported`: the producer does not support the representation.

Redaction MUST NOT imply that the underlying value has been persisted elsewhere.

## Aggregate Result

The contract defines a minimal aggregate result for sets of diagnostics.

- `valid`: no warning, error, or fatal diagnostic is present.
- `valid-with-warnings`: at least one warning exists and no error or fatal exists.
- `invalid`: at least one error exists and no fatal exists.
- `fatal`: at least one fatal diagnostic exists.

Aggregate result MUST NOT replace domain-specific statuses such as `rejected`, `rolled-back`, or
`no-op`.

## Deterministic Ordering

Diagnostics are ordered deterministically by the producer's traversal order.

- A deterministic producer MUST keep phase order and occurrence order stable.
- Canonical serialization MUST NOT randomize or alphabetically sort diagnostics.
- Duplicate diagnostics MAY be deduplicated only by explicit policy.
- A conceptual fingerprint MAY be derived from `code`, `severity`, `phase`, `location`, `source`,
  and safe parameters.
- `message` is not part of the stable fingerprint.

## Validation Modes

- `strict`: normal validation and contract enforcement.
- `authoring`: authoring-time guidance and richer paths.
- `runtime`: redaction-first runtime diagnostics.
- `migration`: schema and compatibility diagnostics during upgrades.
- `explain`: optional informational diagnostics for debugging and review.

Modes MAY influence which diagnostics are produced, but they MUST NOT change the meaning of a code.

## Cross-Contract Code Inventory

The following existing codes are the initial canonical inventory for this contract family. The owner
contract column makes the registry key explicit and prevents silent collision handling.

| Code | Owner contract | Category | Default severity | Typical phase |
| --- | --- | --- | --- | --- |
| `INVALID_STATE_SHAPE` | Engine State | shape | error | shape-validation |
| `UNKNOWN_STATE_DOMAIN` | Engine State | schema | error | schema-validation |
| `INVALID_REFERENCE` | Engine State | reference | error | reference-validation |
| `REVISION_CONFLICT` | Engine State | concurrency | error | final-revision-check |
| `UNKNOWN_CONDITION_TYPE` | Condition | schema | error | schema-validation |
| `INVALID_OPERAND` | Condition | type | error | schema-validation |
| `EVALUATION_BUDGET_EXCEEDED` | Condition | budget | error | condition-evaluation |
| `ACCESS_DENIED` | Condition | authorization | error | authorization |
| `INVALID_EFFECT_SHAPE` | Effect | shape | error | shape-validation |
| `INVALID_TARGET` | Effect | reference | error | semantic-validation |
| `UNKNOWN_EFFECT_TYPE` | Effect | schema | error | schema-validation |
| `EFFECT_BUDGET_EXCEEDED` | Effect | budget | error | effect-application |
| `INVALID_COMMAND_SHAPE` | Command | shape | error | shape-validation |
| `UNKNOWN_COMMAND_TYPE` | Command | schema | error | schema-validation |
| `SCHEMA_VERSION_UNSUPPORTED` | Command | schema | error | schema-validation |
| `INVALID_ACTOR` | Command | identity | error | identity-validation |
| `INVALID_TARGET` | Command | reference | error | reference-validation |
| `INVALID_PAYLOAD` | Command | schema | error | schema-validation |
| `REVISION_CONFLICT` | Command | concurrency | error | initial-revision-check |
| `PRECONDITION_FALSE` | Command | condition | error | command-planning |
| `PRECONDITION_ERROR` | Command | condition | error | command-planning |
| `ACCESS_DENIED` | Command | authorization | error | authorization |
| `DUPLICATE_COMMAND` | Command | concurrency | error | command-planning |
| `IDEMPOTENCY_CONFLICT` | Command | concurrency | error | command-planning |
| `HANDLER_NOT_FOUND` | Command | internal | error | command-planning |
| `COMMAND_BUDGET_EXCEEDED` | Command | budget | error | command-planning |
| `NON_DETERMINISTIC_INPUT` | Command | security | error | parse |
| `PLAN_INVALID` | Command | validation | error | command-planning |
| `INVALID_TRANSACTION_SHAPE` | Transaction | shape | error | shape-validation |
| `INVALID_EFFECT_PLAN` | Transaction | shape | error | shape-validation |
| `UNKNOWN_EFFECT_TYPE` | Transaction | schema | error | schema-validation |
| `SCHEMA_VERSION_UNSUPPORTED` | Transaction | schema | error | schema-validation |
| `REVISION_CONFLICT` | Transaction | concurrency | error | final-revision-check |
| `EFFECT_ERROR` | Transaction | effect | error | effect-application |
| `GUARD_ERROR` | Transaction | condition | error | condition-evaluation |
| `ACCESS_DENIED` | Transaction | authorization | error | authorization |
| `CANDIDATE_STATE_INVALID` | Transaction | state | error | candidate-validation |
| `PROTECTED_METADATA_MUTATION` | Transaction | state | error | candidate-validation |
| `RESULTING_STATE_INVALID` | Transaction | state | error | candidate-validation |
| `TRANSACTION_BUDGET_EXCEEDED` | Transaction | budget | error | candidate-validation |
| `NON_SERIALIZABLE_VALUE` | Transaction | serialization | error | pre-serialization |
| `FORBIDDEN_OBJECT_KEY` | Transaction | security | error | pre-serialization |
| `ATOMICITY_VIOLATION` | Transaction | internal | fatal | commit |
| `INVALID_EVENT_SHAPE` | Domain Event | shape | error | shape-validation |
| `UNKNOWN_EVENT_TYPE` | Domain Event | schema | error | schema-validation |
| `INVALID_EVENT_ID` | Domain Event | identity | error | identity-validation |
| `INVALID_TRANSACTION_REFERENCE` | Domain Event | reference | error | reference-validation |
| `INVALID_COMMAND_REFERENCE` | Domain Event | reference | error | reference-validation |
| `INVALID_REVISION_BOUNDARY` | Domain Event | concurrency | error | final-revision-check |
| `INVALID_SEQUENCE` | Domain Event | ordering | error | event-materialization |
| `INVALID_EVENT_PAYLOAD` | Domain Event | schema | error | schema-validation |
| `EVENT_BUDGET_EXCEEDED` | Domain Event | budget | error | event-materialization |
| `INVALID_VERSION` | Schema Versioning | schema | error | schema-validation |
| `INVALID_DIAGNOSTIC_SHAPE` | Validation Diagnostic | shape | error | shape-validation |
| `INVALID_DIAGNOSTIC_ID` | Validation Diagnostic | identity | error | identity-validation |
| `INVALID_DIAGNOSTIC_CODE` | Validation Diagnostic | schema | error | schema-validation |
| `NOTE` | Validation Diagnostic | validation | info | explain |
| `INVALID_SEVERITY` | Validation Diagnostic | schema | error | schema-validation |
| `INVALID_CATEGORY` | Validation Diagnostic | schema | error | schema-validation |
| `INVALID_PHASE` | Validation Diagnostic | schema | error | schema-validation |
| `INVALID_LOCATION` | Validation Diagnostic | reference | error | reference-validation |
| `INVALID_SOURCE_REFERENCE` | Validation Diagnostic | reference | error | reference-validation |
| `INVALID_RELATED_REFERENCE` | Validation Diagnostic | reference | error | reference-validation |
| `UNSAFE_DIAGNOSTIC_VALUE` | Validation Diagnostic | security | error | semantic-validation |
| `DIAGNOSTIC_BUDGET_EXCEEDED` | Validation Diagnostic | budget | error | validation |
| `DIAGNOSTIC_OUTPUT_TRUNCATED` | Validation Diagnostic | budget | warning | validation |
| `DUPLICATE_DIAGNOSTIC_FINGERPRINT` | Validation Diagnostic | validation | error | semantic-validation |
| `DIAGNOSTIC_REFERENCE_CYCLE` | Validation Diagnostic | reference | error | semantic-validation |
| `INVALID_AGGREGATE_STATUS` | Validation Diagnostic | validation | error | semantic-validation |
| `VALIDATION_NOTE` | Validation Diagnostic | validation | info | explain |
| `VALIDATION_DEPRECATED_USAGE` | Validation Diagnostic | validation | warning | authoring |

## Canonical Serialization

- UTF-8.
- LF line endings.
- 2-space indentation.
- Final newline.
- Stable envelope key ordering.
- Stable ordering of nested reference fields.
- Deterministic diagnostic list order.
- Canonical object-key sorting for safe metadata.
- No `undefined`.
- Explicit `null` only when permitted.
- No automatic timestamps.

## Budgets

The following limits are configurable:

- maximum diagnostics per result
- maximum message length
- maximum path length
- maximum related reference count
- maximum safe parameter count
- maximum actual/expected scalar length
- maximum nesting depth
- maximum serialized bytes

When a budget is exceeded, the result MUST not silently continue appending diagnostics. A single
budget diagnostic MAY be emitted to explain truncation or refusal.

## Security Considerations

- Diagnostics MUST NOT become a localization bypass.
- Diagnostics MUST NOT leak whole payloads, whole state snapshots, or stack traces.
- Diagnostics MUST NOT execute code.
- Diagnostics MUST treat `__proto__`, `prototype`, and `constructor` as forbidden nested keys.
- Diagnostics MUST keep identity, source, and location references type-safe.
- Diagnostics MUST avoid unbounded reference graphs.

## Examples

```json
{
  "contractVersion": "validation-diagnostic@0.1.0",
  "schemaId": "validation-diagnostic",
  "schemaVersion": 1,
  "code": "INVALID_EFFECT_SHAPE",
  "severity": "error",
  "category": "shape",
  "phase": "shape-validation",
  "message": "Effect envelope is missing a required target.",
  "location": {
    "kind": "document",
    "path": "/effects/0/target"
  }
}
```

```json
{
  "contractVersion": "validation-diagnostic@0.1.0",
  "schemaId": "validation-diagnostic",
  "schemaVersion": 1,
  "code": "VALIDATION_NOTE",
  "severity": "info",
  "category": "validation",
  "phase": "explain",
  "message": "This command has no public side effects."
}
```

## Known Limitations

- This contract does not implement logging, telemetry, localization, or monitoring.
- This contract does not define how diagnostics are displayed to players.
- This contract does not define exception stack traces.
- This contract does not define a runtime policy engine.
- This contract does not define a global deduplication store.

## Deferred Decisions

- Whether every future consumer should persist `diagnosticId`.
- Whether `message` will later become optional for ultra-low-level runtime diagnostics.
- Whether future adapter layers will namespace codes more aggressively than the current canonical
  owner-contract registry key.
- Whether future telemetry will attach a separate timestamp envelope outside this contract.
