# Content Package Contract

## Status

DRAFT

## Contract ID

`content-package`

## Contract Version

`content-package@0.1.0`

This is the first M3 draft. It defines the data-only package boundary that future validation and
loader tasks will consume. It does not create a loader, content runtime, Save system, Event Store,
or gameplay package.

## Owner

Future content-model contract area with `packages/engine-contracts` and validation owners as
upstream dependencies.

## Purpose

Content Package defines the neutral data package shape used to deliver content into the engine
ecosystem.

A Content Package:

- MUST be data-only
- MUST be JSON-safe
- MUST NOT contain runtime code, functions, classes, or executable expressions
- MUST NOT run command, effect, transaction, or domain event logic during load
- MUST act as input to future validation and loader boundaries

This contract does not implement a loader, content graph resolver, runtime host, Save system, Event
Store, persistence layer, plugin runtime, or editor workflow.

## Normative Terms

The terms MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are normative:

- MUST and MUST NOT define required behavior.
- SHOULD and SHOULD NOT define expected behavior with documented exceptions.
- MAY defines explicitly permitted behavior.

## Terminology

- **Content Package:** A data-only envelope that groups neutral content sections plus manifest
  metadata.
- **Manifest:** The top-level metadata block that identifies the package, its schema, compatibility,
  sections, and validation policy.
- **Section:** A named collection of one content category such as entities, locations, commands, or
  event mappings.
- **Stable ID:** A canonical identifier used by records and references.
- **Primitive binding:** A declarative link from content data to an M2 contract record shape such as
  a Condition, Effect, Command, Domain Event mapping, or diagnostic rule.
- **Validated content graph:** A future loader output that has passed package-level validation. It is
  not implemented in this task.

## Package Identity

Every Content Package MUST declare package identity through manifest metadata.

Minimum identity fields:

- `id`
- `name`
- `version`
- `schemaVersion`
- `contentVersion`
- optional `engineRange`
- optional `dependencies`
- optional `capabilities`

Rules:

- `id` MUST be a stable lowercase ASCII identifier.
- `id` SHOULD follow a dot-separated namespace shape such as `content.demo.core`.
- `name` MUST be a human-readable label and MUST NOT be used for stable equality.
- `version` MUST be a semantic version string for the package release.
- `schemaVersion` MUST identify the content package schema version and MUST follow
  `SCHEMA_VERSIONING_CONTRACT.md`.
- `contentVersion` MAY distinguish authored content revisions from package release version when
  needed.
- `engineRange` MAY constrain compatible engine releases or compatible contract bundles.
- `dependencies` MAY declare other content package requirements by package ID and version range.
- `capabilities` MAY declare optional package features, but capability declaration MUST NOT grant
  runtime permission by itself.

Identity rules MUST remain compatible with `ENTITY_IDENTITY_CONTRACT.md` and
`SCHEMA_VERSIONING_CONTRACT.md`.

## Package Manifest

The manifest is the top-level metadata envelope for one Content Package.

Canonical manifest fields:

1. `id`
2. `name`
3. `version`
4. `schemaVersion`
5. `contentVersion`
6. `engineRange`
7. `dependencies`
8. `capabilities`
9. `sections`
10. `diagnosticsPolicy`
11. `ordering`

Field meanings:

- `id`: stable package identifier
- `name`: display name for tooling and review
- `version`: package release version
- `schemaVersion`: content package schema version
- `contentVersion`: authored content revision or bundle version
- `engineRange`: optional compatible engine range
- `dependencies`: optional package dependency declarations
- `capabilities`: optional declared feature flags
- `sections`: declared section names present in the package
- `diagnosticsPolicy`: optional validation and reporting profile metadata
- `ordering`: deterministic ordering policy for sections and records

Unknown manifest fields are validation errors unless a future schema version explicitly allows
extension points.

## Data Sections

The first contract version defines neutral section categories. A package MAY omit any section that is
not needed, unless a future package profile requires it.

Recognized section categories:

- `entities`
- `locations`
- `actors`
- `items`
- `documents`
- `dialogues`
- `quests`
- `systems`
- `commands`
- `conditions`
- `effects`
- `eventMappings`
- `localization`
- `assetReferences`
- `validationManifest`

Section requirements:

- Every section MUST be JSON-safe.
- Every record inside a section SHOULD carry a stable ID when the record is referenceable.
- Section names MUST be treated as stable contract terms within one schema version.
- Section membership MUST NOT imply load-time execution order.
- A section MUST NOT embed runtime code.

This contract uses neutral section labels only. It MUST NOT require game-specific names, story
domains, or branded content structures.

## References

All package references MUST be stable and explicit.

Rules:

- references MUST use stable IDs
- references MUST NOT rely on implicit path magic
- references MUST NOT use runtime object pointers or executable callbacks
- missing references MUST be validation diagnostics, not runtime crashes
- alias resolution, if supported later, MUST be explicit and deterministic
- cross-reference validation is deferred to a later M3 task

Reference examples include:

- entity-to-location links
- command references to condition or effect records
- event mappings that point to command types or effect outcomes
- localization key references
- asset reference IDs

## M2 Primitive Bindings

Content Packages MAY bind to M2 primitives only through public contract shapes.

Allowed primitive bindings:

- Conditions according to `CONDITION_CONTRACT.md`
- Effects according to `EFFECT_CONTRACT.md`
- Command definitions according to `COMMAND_CONTRACT.md`
- Event mappings according to `DOMAIN_EVENT_CONTRACT.md`
- Diagnostics according to `VALIDATION_DIAGNOSTIC_CONTRACT.md`

Binding rules:

- content data MAY declare condition or effect records that conform to existing M2 contracts
- content data MAY declare command-facing definitions that reference command types and payload
  schemas
- content data MAY declare event mappings or templates that describe how committed outcomes map to
  content-facing events
- content data MUST NOT directly invoke handlers, transactions, event materializers, or runtime APIs
- content data MUST NOT redefine M2 contract semantics

## Determinism Rules

Content Packages MUST be deterministic inputs.

Rules:

- stable ordering MUST be defined for sections and records
- diagnostics MUST be stable for identical input
- load-time execution MUST NOT occur
- time, randomness, network access, and filesystem side effects are forbidden at the package data
  level
- data MUST be JSON-safe only
- functions, classes, symbols, and executable expressions are forbidden
- canonical serialization SHOULD use UTF-8, LF line endings, 2-space indentation, stable key order,
  and a final newline

Suggested deterministic record ordering:

- manifest first
- sections ordered by manifest `sections`
- records sorted by stable ID inside unordered categories unless a section explicitly defines ordered
  semantics

## Validation Expectations

Future validators for Content Packages SHOULD cover:

- manifest shape validation
- schema version validation
- section shape validation
- cross-reference validation
- M2 primitive shape validation for condition, effect, command, and event mapping records
- deterministic diagnostic output
- duplicate ID checks
- dependency checks
- ordering and canonical serialization checks

Validation failures MUST produce diagnostics through the Validation Diagnostic Contract rather than
throwing unstructured runtime errors.

## Loader Boundary

Loader work is deferred to a later task. This contract defines only the input and output boundary.

Future loader input:

- raw content package data

Future loader output:

- validated content package
- optionally a validated content graph assembled from package dependencies

Future loader MAY:

- accept raw content package input
- validate manifest and sections
- validate dependency declarations
- normalize content into a typed validated form

Future loader MUST NOT:

- execute gameplay
- commit engine state
- create or commit transactions
- persist Save data
- emit Domain Events
- run plugin runtime logic
- import or run UI code

## Non-Goals

- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
- no loader implementation
- no content graph resolver implementation
- no runtime host implementation

## Example

Minimal neutral package example:

```json
{
  "manifest": {
    "id": "content.demo.core",
    "name": "Demo Core Content",
    "version": "0.1.0",
    "schemaVersion": 1,
    "contentVersion": "0.1.0",
    "engineRange": "^0.1.0",
    "sections": [
      "entities",
      "locations",
      "actors",
      "items",
      "commands",
      "conditions",
      "effects",
      "eventMappings",
      "localization",
      "validationManifest"
    ],
    "ordering": {
      "recordOrder": "stable-id-ascending"
    }
  },
  "sections": {
    "entities": [
      {
        "id": "entity.demo.start-room",
        "entityType": "entity",
        "namespace": "demo",
        "schemaVersion": 1
      }
    ],
    "locations": [
      {
        "id": "demo.location.start",
        "entityId": "entity.demo.start-room"
      }
    ],
    "actors": [
      {
        "id": "demo.actor.guide"
      }
    ],
    "items": [
      {
        "id": "demo.item.key"
      }
    ],
    "commands": [
      {
        "commandType": "demo.inspect-location",
        "payloadSchema": "demo.inspect-location@1"
      }
    ],
    "conditions": [
      {
        "contractVersion": "condition@0.1.0",
        "schemaId": "condition",
        "schemaVersion": 1,
        "type": "constant",
        "value": true
      }
    ],
    "effects": [
      {
        "contractVersion": "effect@0.1.0",
        "schemaId": "effect",
        "schemaVersion": 1,
        "type": "set-field",
        "target": {
          "path": "/facts/demo.location.start/visited"
        },
        "value": true
      }
    ],
    "eventMappings": [
      {
        "eventType": "demo.location.inspected",
        "commandType": "demo.inspect-location"
      }
    ],
    "localization": [
      {
        "key": "demo.location.start.title"
      }
    ],
    "validationManifest": {
      "requiredSections": [
        "commands"
      ]
    }
  }
}
```

The example is illustrative only. It documents shape expectations and neutral naming, not a runtime
implementation.

## Acceptance Criteria

TASK-029 is complete when:

- the contract exists at `docs/contracts/CONTENT_PACKAGE_CONTRACT.md`
- no runtime or loader implementation is added
- content package shape is documented
- package identity and manifest rules are documented
- M2 primitive binding rules are documented
- validation and diagnostic expectations are documented
- the next recommended task is `TASK-030 - Content schema and version manifest`

## Known Limitations

- no schema file is defined in this task
- no loader or content graph assembly exists
- no package dependency resolver exists
- no cross-reference validator exists
- no content fixtures or package parser are defined here

## Deferred Decisions

- exact schema file location and ownership
- single-package versus multi-package dependency model
- loader API shape
- validated content graph representation
- localization package contract details
- asset manifest integration details
