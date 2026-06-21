# Content Reference Validation

## Status

DRAFT

## Contract ID

`content-reference-validation`

## Contract Version

`content-reference-validation@0.1.0`

This is the first M3 draft for content-package cross-reference validation. It defines reference
models, scopes, duplicate-ID rules, unresolved-reference diagnostics, and deterministic reporting.
It does not implement a loader, runtime content graph, schema validation engine, or content
execution surface.

## Purpose

Content Reference Validation defines cross-reference validation rules for Content Packages.

The contract exists to:

- validate stable ID references across content-package sections
- document section-local, package-local, and dependency reference scope
- define deterministic diagnostics for duplicate IDs and unresolved references
- keep reference validation data-only and independent from runtime execution

## Relationship to Content Package Contract

`CONTENT_PACKAGE_CONTRACT.md` defines the neutral package envelope, stable IDs, and allowed section
categories. This contract defines how references inside those sections are checked.

Rules:

- Content Package records use stable IDs as the only canonical reference identity.
- Cross-reference validation checks declarative references only.
- Cross-reference validation MUST NOT execute commands, effects, transactions, or domain events.
- A future loader MAY consume validated references, but loader behavior is outside this task.

## Reference Model

The first contract version recognizes these reference forms:

- **stable ID reference**
  - a direct reference to one record by canonical stable ID
- **section-qualified reference**
  - a reference that names both target section and stable ID
- **package-local reference**
  - a reference that resolves inside the same content package
- **dependency reference**
  - a reference that targets a declared dependency package plus stable ID
- **external reference placeholder**
  - a future extension point for external packages or registries

Rules:

- references MUST use stable IDs
- references MUST NOT use runtime object pointers
- references MUST NOT use implicit path magic
- references MUST NOT require filesystem lookup
- references MAY be represented as strings or data-only objects, but their identity MUST stay
  explicit

## Reference Scopes

### Package-local scope

- the default scope for references inside one content package
- resolution checks only the current package data

### Section-local scope

- used when a field may reference records only inside one specific section
- the target section MUST be explicit in schema or contract context

### Dependency scope

- used when a reference targets another declared content package
- the dependency package ID MUST be declared in manifest dependencies
- this task validates dependency declaration only, not remote package loading

### Global or reserved IDs

- reserved IDs MAY exist later for engine or tooling namespaces
- this task does not create a global registry

### Future external references

- external or federated references are deferred
- they MAY be represented as placeholders, but MUST NOT be treated as valid resolved references in
  this task

## Duplicate ID Rules

Duplicate ID handling MUST be deterministic.

Rules:

- duplicate ID in the same section is invalid
- duplicate ID across sections is invalid when the referenced record type is expected to be package
  unique
- the same local ID MAY appear in different sections only when the contract explicitly treats the
  section as part of the identity boundary
- duplicate reporting MUST preserve stable traversal and stable path order

Recommended diagnostic behavior:

- first occurrence is treated as the canonical traversal baseline
- later duplicates produce diagnostics
- duplicate diagnostics SHOULD point to the duplicate entry and MAY include the original ID as
  related reference metadata

## Missing and Unresolved Reference Rules

Reference validation MUST distinguish common failure modes:

- **missing reference target**
  - target stable ID does not exist in the allowed scope
- **wrong target section**
  - target ID exists, but not in the section allowed by the reference rule
- **unsupported reference kind**
  - reference shape or addressing form is outside this contract version
- **undeclared dependency**
  - reference names another package that is not declared in manifest dependencies
- **circular reference**
  - cycles MAY be reported as deferred or diagnostic-only in this task

Rules:

- missing targets are diagnostics, not runtime crashes
- wrong-section references are diagnostics
- undeclared dependencies are diagnostics
- unsupported reference kinds are diagnostics
- circular-reference handling is deferred beyond minimal diagnostic reporting

## M2 Primitive Binding References

Content data MAY reference M2 primitive records by ID or by section-qualified reference.

Reference categories include:

- conditions
- effects
- commands or actions
- domain event mappings or templates
- validation diagnostics configuration

Rules:

- validation in this task checks reference existence and expected target category only
- validation in this task MUST NOT execute the referenced primitive
- validation in this task MUST NOT prove semantic correctness of the referenced M2 record beyond
  declared section category

## Diagnostic Mapping

Content reference findings map through `CONTENT_VALIDATION_DIAGNOSTICS.md`.

Recommended diagnostic codes:

- `CONTENT_REFERENCE_MISSING_TARGET`
- `CONTENT_REFERENCE_WRONG_SECTION`
- `CONTENT_REFERENCE_DUPLICATE_ID`
- `CONTENT_REFERENCE_UNDECLARED_DEPENDENCY`
- `CONTENT_REFERENCE_UNSUPPORTED_KIND`
- `CONTENT_REFERENCE_CIRCULAR_DEFERRED`

Recommended diagnostic categories:

- `reference` for missing, wrong-section, undeclared-dependency, and unsupported-kind findings
- `identity` for duplicate-ID findings when stable identity is violated
- `validation` for deferred cycle reporting

Recommended stable paths:

- `/sections/<section-name>/<index>/id`
- `/sections/<section-name>/<index>/<reference-field>`
- `/manifest/dependencies/<index>`

## Determinism

Cross-reference validation MUST be deterministic.

Rules:

- traversal order MUST be stable
- diagnostic order MUST be stable
- path format MUST be stable
- validation MUST NOT depend on filesystem, network, time, locale, or randomness
- validation MUST NOT execute content

Recommended traversal order:

1. manifest dependency declarations
2. sections in manifest-declared order
3. records in source order unless a section contract specifies stable-ID ordering
4. reference fields in canonical field order

## Non-Goals

- no loader implementation
- no content graph resolver
- no schema validation engine
- no runtime execution
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime

## Examples

Valid local reference:

```json
{
  "section": "locations",
  "record": {
    "id": "demo.location.start",
    "entityId": "entity.demo.start-room"
  }
}
```

Missing item reference:

```json
{
  "code": "CONTENT_REFERENCE_MISSING_TARGET",
  "path": "/sections/quests/0/requiredItemId",
  "message": "Referenced item ID is not present in the package."
}
```

Duplicate entity ID:

```json
{
  "code": "CONTENT_REFERENCE_DUPLICATE_ID",
  "path": "/sections/entities/3/id",
  "message": "Duplicate stable ID appears in the entities section."
}
```

Dependency reference without declared dependency:

```json
{
  "code": "CONTENT_REFERENCE_UNDECLARED_DEPENDENCY",
  "path": "/sections/dialogues/0/locationRef",
  "message": "Reference targets dependency package 'content.demo.shared' but the dependency is not declared."
}
```

Command references condition and effect IDs:

```json
{
  "commandType": "demo.inspect-location",
  "conditionRef": "demo.condition.location-accessible",
  "effectRef": "demo.effect.mark-location-visited"
}
```

## Acceptance Criteria

TASK-032 is complete when:

- the contract exists at `docs/contracts/CONTENT_REFERENCE_VALIDATION.md`
- reference model and scope rules are documented
- duplicate-ID and missing-reference expectations are documented
- deterministic diagnostic behavior is documented
- mapping into content validation diagnostics is documented
- no loader, runtime graph, or schema validation engine implementation is added
- the next recommended task is `TASK-033 - Minimal neutral content package fixture`

## Known Limitations

- no helper implementation is provided in this task
- no filesystem-backed dependency resolution exists
- no full circular-reference analysis exists
- no schema-level field registry exists for every future section

## Deferred Decisions

- whether package-global ID uniqueness should become mandatory across all sections
- whether dependency references should use explicit package-plus-section envelopes or stable string
  shorthands
- exact future cycle policy for content graphs
- how cross-reference validation will compose with future loader profiles
