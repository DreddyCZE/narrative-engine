# Content Validation Diagnostics

## Status

DRAFT

## Contract ID

`content-validation-diagnostics`

## Contract Version

`content-validation-diagnostics@0.1.0`

This is the first M3 draft for content validation diagnostic adapters. It defines content-specific
diagnostic taxonomy, severity policy, stable path rules, deterministic ordering, and mapping into
the generic Validation Diagnostic Contract. It does not implement a loader, content graph resolver,
schema validation engine, or runtime host.

## Purpose

Content Validation Diagnostics defines diagnostics for validating Content Packages and Content
Schema and Version Manifests.

The contract exists to:

- provide stable content-specific diagnostic codes
- normalize manifest and package validation findings into deterministic shapes
- map content findings to the generic Validation Diagnostic Contract
- keep content validation diagnostics data-only and serialization-safe

## Relationship to Validation Diagnostic Contract

Content diagnostics are a content-domain adaptation layer over `VALIDATION_DIAGNOSTIC_CONTRACT.md`.

Rules:

- content diagnostics MUST be mappable to the generic Validation Diagnostic envelope
- content diagnostics MUST preserve stable `code`, `severity`, `path`, `message`, and source
  semantics
- content diagnostics MUST NOT invent incompatible severity or path semantics
- content diagnostics MAY use content-specific code prefixes while still mapping to generic
  `category`, `phase`, and source/location structures

## Diagnostic Shape

Every content diagnostic MUST define:

- `code`
- `severity`
- `path`
- `message`
- `source`
- optional `related`
- optional deterministic ordering key

Field expectations:

- `code`
  - MUST be an uppercase underscore-delimited content code
- `severity`
  - MUST follow the severity policy defined below
- `path`
  - MUST be a stable JSON Pointer-like path
- `message`
  - MUST be concise and developer-facing
- `source`
  - MUST identify whether the diagnostic came from manifest validation, package validation, a
    section record, a primitive binding, or dependency metadata
- `related`
  - MAY point to a related ID or reference when it materially improves diagnostics
- ordering key
  - MAY be derived rather than stored
  - MUST be deterministic when derived

## Severity Policy

Content diagnostics use the following severity vocabulary:

- `error`
  - the content record is invalid for the requested validation outcome
- `warning`
  - the content record is still processable, but requires attention
- `info`
  - informational diagnostic only
- `deferred`
  - a known missing capability or future validation rule that is intentionally postponed
- `blocked`
  - validation cannot continue meaningfully because a prerequisite contract requirement is missing

Mapping guidance for generic diagnostics:

- `error` -> generic `error`
- `warning` -> generic `warning`
- `info` -> generic `info`
- `deferred` -> generic `warning`
- `blocked` -> generic `fatal` or `error` depending on the validation boundary

## Diagnostic Code Taxonomy

The first contract version defines these content-domain categories:

- manifest errors
- schema/version errors
- section errors
- reference errors
- M2 primitive binding errors
- determinism errors
- dependency errors
- capability errors
- diagnostics policy errors

Recommended code prefixes:

- `CONTENT_MANIFEST_*`
- `CONTENT_SCHEMA_*`
- `CONTENT_SECTION_*`
- `CONTENT_REFERENCE_*`
- `CONTENT_BINDING_*`
- `CONTENT_DETERMINISM_*`
- `CONTENT_DEPENDENCY_*`
- `CONTENT_CAPABILITY_*`
- `CONTENT_DIAGNOSTICS_POLICY_*`

Illustrative starter codes:

- `CONTENT_MANIFEST_MISSING`
- `CONTENT_MANIFEST_INVALID_ID`
- `CONTENT_SCHEMA_INVALID_VERSION`
- `CONTENT_SCHEMA_UNKNOWN_MANIFEST_SCHEMA`
- `CONTENT_SECTION_MISSING_DECLARED_SECTION`
- `CONTENT_SECTION_UNDECLARED_SECTION`
- `CONTENT_REFERENCE_UNKNOWN_ID`
- `CONTENT_BINDING_INVALID_CONDITION`
- `CONTENT_BINDING_INVALID_EFFECT`
- `CONTENT_BINDING_INVALID_COMMAND`
- `CONTENT_BINDING_INVALID_EVENT_MAPPING`
- `CONTENT_DETERMINISM_UNSTABLE_ORDER`
- `CONTENT_DEPENDENCY_DUPLICATE`
- `CONTENT_DEPENDENCY_INCOMPATIBLE_RANGE`
- `CONTENT_CAPABILITY_UNSUPPORTED`
- `CONTENT_DIAGNOSTICS_POLICY_INVALID`

## Path Rules

Content diagnostic paths MUST be stable and pointer-based.

Path families:

- manifest path
  - `/manifest`
  - `/manifest/id`
  - `/manifest/schemaVersion`
- section path
  - `/sections`
  - `/sections/<section-name>`
- item path
  - `/sections/<section-name>/<index>`
  - `/sections/<section-name>/<index>/id`
- reference path
  - `/sections/<section-name>/<index>/<reference-field>`
- primitive binding path
  - `/sections/<section-name>/<index>/<binding-field>`
- dependency path
  - `/manifest/dependencies/<index>`
- diagnostics policy path
  - `/manifest/diagnosticsPolicy`

Rules:

- the same invalid input MUST produce the same path
- array order MUST be preserved when indexes are part of the path
- path construction MUST NOT depend on filesystem location or runtime order

## Deterministic Ordering

Content diagnostics MUST sort deterministically.

Recommended ordering tuple:

1. severity priority
2. code
3. path
4. source
5. message
6. optional related ID

Recommended severity priority:

1. `blocked`
2. `error`
3. `warning`
4. `deferred`
5. `info`

This ordering MUST remain stable for identical input.

## Mapping to Generic Diagnostics

When mapped into `VALIDATION_DIAGNOSTIC_CONTRACT.md`, content diagnostics SHOULD populate:

- `ownerContract`: `content-validation-diagnostics@0.1.0`
- `code`: content diagnostic code
- `severity`: mapped severity
- `category`
  - `shape` for manifest or section shape failures
  - `schema` for version or schema failures
  - `reference` for unresolved content references
  - `validation` for diagnostics policy and declared-sections policy issues
  - `security` for determinism and unsafe data concerns when applicable
- `phase`
  - `shape-validation`
  - `schema-validation`
  - `reference-validation`
  - `semantic-validation`
  - `authoring`
- `location.kind`: usually `document`
- `location.path`: stable content path
- `source.kind`
  - `document`
  - `schema`
  - `system`

## Non-Goals

- no loader implementation
- no content graph resolver
- no cross-reference resolver implementation
- no schema validation engine
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime

## Examples

Missing manifest:

```json
{
  "code": "CONTENT_MANIFEST_MISSING",
  "severity": "blocked",
  "path": "/manifest",
  "message": "Content package is missing the required manifest.",
  "source": "content-package",
  "orderingKey": "blocked|CONTENT_MANIFEST_MISSING|/manifest|content-package"
}
```

Invalid schema version:

```json
{
  "code": "CONTENT_SCHEMA_INVALID_VERSION",
  "severity": "error",
  "path": "/manifest/schemaVersion",
  "message": "Manifest schemaVersion must be a positive integer.",
  "source": "content-schema-version-manifest"
}
```

Missing declared section:

```json
{
  "code": "CONTENT_SECTION_MISSING_DECLARED_SECTION",
  "severity": "error",
  "path": "/sections/conditions",
  "message": "Manifest declares section 'conditions' but the package does not provide it.",
  "source": "content-package"
}
```

Unknown reference:

```json
{
  "code": "CONTENT_REFERENCE_UNKNOWN_ID",
  "severity": "error",
  "path": "/sections/locations/0/entityId",
  "message": "Referenced entity ID is not known in the validated content set.",
  "source": "content-package",
  "related": "entity.demo.start-room"
}
```

Invalid condition binding:

```json
{
  "code": "CONTENT_BINDING_INVALID_CONDITION",
  "severity": "error",
  "path": "/sections/conditions/0",
  "message": "Condition binding does not satisfy the Condition Contract.",
  "source": "content-package"
}
```

## Acceptance Criteria

TASK-031 is complete when:

- the contract exists at `docs/contracts/CONTENT_VALIDATION_DIAGNOSTICS.md`
- diagnostic taxonomy is documented
- severity policy is documented
- deterministic path and ordering rules are documented
- mapping to the generic Validation Diagnostic Contract is documented
- no loader, resolver, or runtime implementation is added
- the next recommended task is `TASK-032 - Cross-reference validation for content packages`

## Known Limitations

- no runtime adapter helper is implemented in this task
- no full schema validation engine exists
- no cross-reference validation implementation exists
- no loader-boundary execution exists
- no code registry enforcement beyond documentation exists

## Deferred Decisions

- whether a future helper should emit generic envelopes directly or return an intermediate content
  diagnostic shape
- exact budget policy for large content diagnostic batches
- exact source kind vocabulary for future content-model packages
- future interaction with cross-reference validation and loader profiles
