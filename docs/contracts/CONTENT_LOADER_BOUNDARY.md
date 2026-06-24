# Content Loader Boundary

## Status

DRAFT

## Contract ID

`content-loader-boundary`

## Contract Version

`content-loader-boundary@0.1.0`

This is the first M3 draft for the future content loader boundary and validated content graph value.
It defines the allowed boundary, validation stages, input and output contracts, deterministic
diagnostics expectations, and the relationship to the minimal neutral content fixture. It does not
implement a production loader, runtime file IO, schema validation engine, or runtime content graph.

## Purpose

Content Loader Boundary defines the future boundary where raw content package data may be accepted,
validated, normalized, and returned as a data-only validated result.

The contract exists to:

- define the future loader input and output shape
- define what validation stages must happen before content is considered usable
- define the validated content graph as a data value rather than a runtime object graph
- preserve deterministic diagnostics and boundary-safe behavior

## Relationship to M3 Contracts

This contract composes the existing M3 contract family:

- `CONTENT_PACKAGE_CONTRACT.md`
- `CONTENT_SCHEMA_VERSION_MANIFEST.md`
- `CONTENT_VALIDATION_DIAGNOSTICS.md`
- `CONTENT_REFERENCE_VALIDATION.md`
- `tests/fixtures/content/minimal-neutral-content-package/content-package.json`

Rules:

- Content Package defines the raw package envelope and section categories.
- Content Schema and Version Manifest defines manifest and compatibility semantics.
- Content Validation Diagnostics defines the content-domain diagnostic vocabulary.
- Content Reference Validation defines cross-reference rules and stable diagnostic paths.
- The minimal neutral content fixture is the first representative input sample for this boundary.

## Loader Boundary

The future loader MAY:

- accept raw content package data already provided by a caller
- normalize data-only input into canonical shapes
- run validation stages in a deterministic order
- return a validated content package value
- return a validated content graph value
- return deterministic diagnostics

The future loader MUST NOT:

- require file IO as a runtime side effect
- perform implicit disk reads
- perform implicit network reads
- execute gameplay behavior
- commit engine state
- create or commit transactions
- apply effects
- emit domain events
- persist Save data
- use an Event Store
- run plugin code
- depend on UI or editor runtime

This task does not implement the loader. It defines only the public boundary.
TASK-038 may add type-only input and result shapes in `packages/engine-contracts`, but that follow-
through must remain data-only and must not introduce loader behavior.

## Input Contract

The future loader input is a data-only envelope.

Minimum input components:

- raw content package object
- optional source metadata supplied by the caller
- expected contract or schema versions for validation policy
- optional dependency packages already supplied as data-only objects

Rules:

- the loader input MUST NOT require filesystem paths as the canonical source of truth
- the loader input MUST NOT require network fetches
- dependency packages, when provided, MUST already be present as data-only input values
- the input MUST remain JSON-safe or serializable into equivalent JSON-safe data before validation

Illustrative input fields:

- `contentPackage`
- `sourceMetadata`
- `expectedContractVersions`
- `dependencyPackages`
- `validationMode`

## Output Contract

The future loader output is a data-only result envelope.

Minimum output components:

- `status`
- `normalizedManifest`
- `validatedSections`
- `referenceIndex`
- `diagnostics`
- `deterministicMetadata`

Canonical load status values:

- `valid`
  - validation passed without blocking findings
- `invalid`
  - validation completed and found errors that make the package unusable
- `partial`
  - some validated value may be returned, but at least one deferred or incomplete area remains
- `blocked`
  - validation cannot continue meaningfully because a prerequisite boundary condition failed

Rules:

- output MUST NOT contain runtime state
- output MUST NOT contain executable callbacks or host objects
- diagnostics MUST remain deterministic
- normalizedManifest and validatedSections MUST remain data-only values

## Validated Content Graph Contract

The validated content graph is a data-only value derived from one or more already-provided content
packages.

It is not:

- a runtime object graph
- a live resolver
- a mutable runtime registry
- a gameplay execution surface

Minimum validated graph components:

- package identity
- normalized manifest
- validated sections keyed by stable ID where applicable
- reference index
- dependency summary
- primitive binding summary
- localization key index
- asset reference index
- diagnostics summary

Recommended graph properties:

- one package entry for each validated input package
- stable IDs as the canonical lookup keys
- reference edges stored as data records, not object pointers
- dependency edges stored as declared and validated relationships only
- a summary that can be consumed later by TASK-035 without redefining boundary semantics

## Validation Stages

The future loader boundary SHOULD evaluate stages in this order:

1. JSON-safe input check
2. manifest, schema, and version check
3. declared section check
4. section shape check
5. ID and index build
6. reference validation
7. M2 primitive binding shape check
8. diagnostic normalization
9. final boundary result

Rules:

- stage order MUST be deterministic
- known validation failures MUST produce diagnostics rather than host-language exceptions
- later stages MAY be skipped when earlier blocked diagnostics make progress meaningless
- skipped later stages SHOULD still preserve a deterministic status and diagnostics summary

## Diagnostics

Loader-boundary diagnostics MUST compose through `CONTENT_VALIDATION_DIAGNOSTICS.md`.

Expectations:

- stable path format
- stable diagnostic codes
- stable sorting
- deterministic severity handling
- no runtime exceptions for known validation failures

Recommended diagnostic families include:

- manifest and schema diagnostics
- declared section diagnostics
- reference diagnostics
- primitive binding diagnostics
- boundary blocked diagnostics

The loader boundary SHOULD preserve enough metadata to explain which stage produced a diagnostic.

## Relationship to Fixture

The minimal neutral content package fixture at:

- `tests/fixtures/content/minimal-neutral-content-package/content-package.json`

is the first representative input for future loader-boundary tests.

The fixture demonstrates:

- a valid manifest
- representative sections
- stable IDs
- cross-section references
- M2 primitive bindings as data only
- localization keys
- asset references
- validation manifest metadata

Future loader-boundary tests MAY use the fixture as:

- a raw input example
- a normalized output expectation source
- a deterministic diagnostics regression baseline

## Non-Goals

- no production loader implementation
- no file IO
- no schema validation engine implementation
- no content graph runtime resolver
- no runtime execution
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime

## Example

Pseudo-example boundary result for the minimal fixture:

```json
{
  "status": "valid",
  "normalizedManifest": {
    "id": "content.demo.minimal",
    "schemaVersion": 1
  },
  "validatedSections": {
    "commands": {
      "command.demo.inspect": {
        "commandType": "demo.inspect"
      }
    }
  },
  "referenceIndex": {
    "command.demo.inspect": [
      "condition.demo.has-key",
      "effect.demo.mark-inspected",
      "location.demo.start"
    ]
  },
  "diagnostics": [],
  "deterministicMetadata": {
    "stageOrder": [
      "json-safe-input-check",
      "manifest-schema-version-check",
      "declared-section-check",
      "section-shape-check",
      "id-index-build",
      "reference-validation",
      "primitive-binding-check",
      "diagnostic-normalization",
      "final-boundary-result"
    ]
  }
}
```

The example is illustrative only. It is not a runtime API.

## Acceptance Criteria

TASK-034 is complete when:

- the contract exists at `docs/contracts/CONTENT_LOADER_BOUNDARY.md`
- loader-boundary allowed and forbidden behavior is documented
- input and output contracts are documented
- validated content graph value semantics are documented
- validation stage order is documented
- deterministic diagnostics behavior is documented
- relationship to the minimal neutral content fixture is documented
- no production loader, file IO, or runtime graph implementation is added
- the next recommended task is `TASK-035 - Content package integration with M2 primitives`

## Known Limitations

- no production loader exists
- no graph-builder exists
- no schema validation engine exists
- no dependency-package orchestration policy exists beyond already-provided data

## TASK-038 Follow-Through

`TASK-038 - Content loader input/result types` is the first implementation step under this
boundary.

Its allowed output is limited to:

- data-only loader input types
- data-only loader result and status types
- validated content graph value shape skeleton
- diagnostics array typing and status guards

It MUST NOT add:

- loader execution
- file IO
- manifest or section validation logic
- reference resolver logic
- runtime content graph building

## TASK-039 Follow-Through

`TASK-039 - Manifest and section validation implementation` is the first pure validation step
under this boundary.

Its allowed output is limited to:

- manifest presence and shape validation
- required manifest field validation
- declared section presence validation
- undeclared section diagnostics policy
- deterministic `ContentLoaderResult` output for caller-provided objects

It MUST NOT add:

- file IO
- loader orchestration
- reference validation
- ID indexing beyond section presence checks
- M2 primitive validation
- runtime content graph building beyond a value-only skeleton

## TASK-040 Follow-Through

`TASK-040 - Content ID indexing and duplicate detection` is the next pure validation step under
this boundary.

Its allowed output is limited to:

- stable ID extraction from caller-provided sections
- section-qualified and package-local ID index values
- duplicate ID diagnostics
- invalid or missing item ID diagnostics
- deterministic indexing and path generation

It MUST NOT add:

- file IO
- loader orchestration
- reference target validation
- reference resolver logic
- M2 primitive validation
- runtime content graph building

## Deferred Decisions

- exact future package-batch input shape
- whether partial status should be allowed for all validation modes
- exact deterministic metadata payload
- exact validated graph partitioning when multiple packages are supplied
- how future TASK-035 should consume validated graph values without introducing runtime coupling
