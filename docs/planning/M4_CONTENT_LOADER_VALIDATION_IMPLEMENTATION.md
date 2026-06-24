# M4 Content Loader / Validation Implementation

## 1. M4 Goal

M4 should implement a safe content loader and validation boundary for already-provided data-only
Content Package objects.

The milestone goal is to:

- accept a data-only Content Package object from a caller
- validate manifest, section, reference, and M2 primitive binding boundaries
- return deterministic diagnostics
- return a validated content package or validated content graph value
- avoid introducing a runtime host, Save, Event Store, UI, gameplay, or plugin runtime behavior

## 2. Why M4 Exists

M2 delivered the deterministic primitive pipeline:

- conditions
- effects
- commands
- transactions
- domain events

M3 delivered the content boundary above those primitives:

- content contracts
- neutral fixture coverage
- test-only integration with M2 primitives

M4 exists to implement the production validation layer between raw content data and a future runtime
host without turning the loader into that host.

## 3. Architecture Boundary

### Layer roles

- `packages/engine-contracts`
  - owns public content-facing contracts and data-only shared types
  - may own pure contract helpers when they remain generic and serialization-safe
- `packages/engine-kernel`
  - may own pure validation or boundary helpers only where they depend on accepted engine
    primitives and remain deterministic
  - must not become a runtime host, file loader, Save layer, or Event Store
- fixtures and tests
  - own neutral sample inputs and regression coverage
  - must remain outside production dependency graphs
- future runtime host
  - remains outside M4
  - may consume M4 outputs later, but must not be implemented in this milestone

### Dependency rules

- production packages must not import docs, tests, or fixture files
- contract-level types may flow downward into kernel helpers, not the reverse
- runtime host concerns must stay above the loader boundary
- file IO must remain caller-owned or later-host-owned, not a mandatory loader side effect

## 4. Loader / Validation Stages

Recommended implementation order:

1. JSON-safe raw package check
2. manifest, schema, and version validation
3. declared sections validation
4. section shape validation
5. ID indexing
6. reference validation
7. M2 primitive binding validation
8. diagnostic normalization
9. validated content graph value creation
10. integration test against the minimal neutral fixture

Each stage should remain deterministic and value-only.

`TASK-039 - Manifest and section validation implementation` is the first pure validation
follow-through in this sequence. Its scope is limited to manifest presence and shape checks plus
declared section validation over caller-provided objects. It must not add loader orchestration,
file IO, reference validation, or runtime graph construction.

`TASK-040 - Content ID indexing and duplicate detection` is the next pure validation step. Its
scope is limited to stable ID extraction, section-qualified and package-local indexing, duplicate ID
diagnostics, and invalid or missing item ID diagnostics. It must not add reference target
validation, reference resolution, M2 primitive validation, or runtime graph building.

## 5. Implementation Boundaries

M4 MAY:

- accept an object already passed by the caller
- validate deterministic data structures
- produce diagnostics through existing validation contracts
- produce a value-only validated package or validated graph result

M4 MUST NOT:

- require file IO as a runtime side effect
- execute gameplay behavior
- commit engine state
- run transactions
- emit domain events
- write Save data
- use an Event Store
- depend on UI/editor code
- run plugin runtime behavior

## 6. Proposed Package / File Areas

Likely implementation areas:

- `packages/engine-contracts/src/content-package/...`
- `packages/engine-contracts/src/content-loader/content-loader-types.ts`
- `packages/engine-kernel/src/content-loader/...`
- `tests/content-loader-input-result-types.test.ts`
- `tests/content-loader-*.test.ts`
- reuse of `tests/fixtures/content/minimal-neutral-content-package/...`

These are planning targets only. TASK-037 does not create implementation files in those locations.
TASK-038 is the first follow-through step and is limited to data-only input and result types plus
shape tests. It does not implement a loader.

## 7. Test Strategy

M4 should plan coverage for:

- valid minimal fixture loads as a value-only result
- invalid manifest
- missing declared section
- duplicate IDs
- missing reference
- invalid M2 binding
- deterministic diagnostics
- input immutability
- no runtime side effects
- no required file IO

Tests should stay fixture-driven, neutral, and deterministic.

TASK-039 adds the first focused validation coverage in this stack:

- valid minimal fixture returns `valid`
- missing manifest returns deterministic diagnostics
- missing declared section returns deterministic diagnostics
- undeclared section behavior is configurable without invoking later validation stages

TASK-040 adds the next focused validation coverage:

- stable ID index output for the minimal fixture
- duplicate ID diagnostics
- cross-section duplicate policy handling
- invalid or missing item ID diagnostics
- input immutability without later-stage validation behavior

## 8. M4 Task Breakdown

Recommended M4 task sequence:

1. `TASK-038 - Content loader input/result types`
2. `TASK-039 - Manifest and section validation implementation`
3. `TASK-040 - Content ID indexing and duplicate detection`
4. `TASK-041 - Reference validation implementation`
5. `TASK-042 - M2 primitive binding validation implementation`
6. `TASK-043 - Validated content graph value builder`
7. `TASK-044 - Minimal fixture loader boundary integration test`
8. `TASK-045 - M4 gate review`

## 9. Non-Goals

- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
- no full runtime host
- no mandatory file IO loader

## 10. Risks and Open Questions

- how far schema validation should go in M4 versus later milestones
- where the exact ownership line sits between contracts and kernel helpers
- how to prevent the loader from drifting into a runtime host
- how dependency packages should be handled without mandatory file IO
- how Save and Event Store will later attach without forcing a loader rewrite
- how to keep the content model generic and independent from specific games

## 11. Recommendation

Current implementation follow-through after TASK-039 acceptance:

- `TASK-040 - Content ID indexing and duplicate detection`

TASK-040 should add only pure ID indexing, duplicate detection, deterministic diagnostics, and
stable path generation for caller-provided objects. It must not add loader behavior, file IO,
reference validation, or runtime graph building.
