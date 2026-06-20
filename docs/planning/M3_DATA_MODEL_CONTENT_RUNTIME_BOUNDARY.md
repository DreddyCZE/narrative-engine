# M3 Data Model / Content Runtime Boundary

## 1. M3 Goal

M3 should define the data and content model that sits above the existing engine contracts and
reference runtime primitives. The milestone goal is to:

- introduce a neutral data/content model for the engine
- keep `engine-contracts` and `engine-kernel` independent from concrete content
- define content packages as validated inputs to future runtime hosts
- define a validation and loader boundary for those content packages
- avoid starting Save, Event Store, UI, editor runtime, or gameplay implementation

## 2. Why M3 Exists

M2 proved the in-memory contract pipeline:

- validated command, condition, effect, transaction, and domain event primitives exist
- deterministic diagnostics and boundary checks are in place
- the runtime slice is still generic and free of game-specific logic

M3 exists to define how validated content and data will connect to those primitives without
hardcoding gameplay logic into the kernel. The milestone should answer how content enters the
system, how it is validated, and how engine packages remain generic while future games provide
their own declarative data packages.

## 3. Architecture Boundary

### Layer roles

- `packages/engine-contracts`
  - owns public contracts, contract-facing helpers, and schema-facing validation rules
  - must not depend on concrete content packages, runtime host code, or UI/editor layers
- `packages/engine-kernel`
  - owns command planning, transaction orchestration, and domain event materialization over
    validated inputs
  - may depend on lower-level production packages only
  - must not depend on content package internals or runtime host adapters
- `packages/content-model` or equivalent future package
  - should own content package types, content validation adapters, content graph assembly, and
    loader-boundary types
  - may depend on engine contracts and validation helpers
  - must not own transaction execution, UI, save, or event delivery
- content packages
  - are declarative data only
  - may contain metadata, entities, rules configuration, references, and localization keys
  - must not contain executable runtime behavior or direct engine mutations
- validation tools
  - may load schemas, run static and cross-reference validation, and emit deterministic diagnostics
  - must not become a runtime host
- future runtime host
  - may load validated content packages and interact with engine public APIs
  - must not bypass contract validation or mutate engine state directly

### Dependency rules

- engine packages must not import content package internals
- content-model layer may import engine contracts, but not engine-kernel internals
- content packages may target public contracts only
- validation tooling may inspect schemas and content packages, but runtime packages must not import
  docs or tests
- UI/editor/runtime host layers must stay above the content-model and engine package boundaries

## 4. Content Package Model

A neutral content package should contain:

- package metadata
  - package ID
  - package version
  - compatible engine or contract range
  - provenance or approval metadata where needed later
- schema version metadata
  - content package schema ID
  - content package schema version
  - referenced contract/schema versions for major engine-facing records
- entity definitions
  - canonical entity identities and typed entity payloads
- command and action definitions
  - declarative action descriptors referencing command contracts rather than runtime handlers
- condition records
  - reusable condition definitions and condition references
- effect records
  - reusable effect definitions and effect templates
- domain event templates or mappings
  - declarative mappings from committed outcomes to content-facing event meanings
- text/localization keys
  - keys and references only, not coupled presentation rendering
- asset references
  - identifiers and metadata references only, not runtime asset loading behavior
- validation manifest
  - declared dependencies, package entry points, and validation expectations

## 5. Data Categories

M3 should plan for generic data categories, not game-specific content:

- entities
- locations or maps
- actors or NPC definitions
- items or evidence records
- terminals or documents
- dialogue fragments
- quests, problems, or objective records
- station or system state descriptors as generic systems
- commands or action definitions
- condition and effect definitions
- domain event materialization mappings

These categories should remain optional and composable so the repository stays genre-neutral and
does not drift into a game-specific structure.

## 6. Validation Pipeline

The M3 validation pipeline should include:

- static schema validation
  - package envelope shape
  - schema/version manifest shape
  - per-record schema checks
- contract validation
  - reuse existing engine contract validators where records map directly to M2 contracts
- cross-reference validation
  - entity references
  - condition/effect references
  - localization and asset reference existence
- dependency order validation
  - validate package-level prerequisites and content graph assembly order
- deterministic diagnostics
  - stable codes, paths, and aggregation through the existing diagnostic contract
- boundary enforcement
  - content validation must not trigger runtime side effects, state commits, or event emission

## 7. Loader Boundary

The future loader may:

- read a content package from an explicit input boundary
- validate the package and its dependency graph
- normalize validated content into a typed content graph
- return validated content artifacts for later runtime-host orchestration

The future loader must not:

- execute gameplay behavior
- commit engine state
- create or commit transactions
- persist save data
- emit domain events
- import UI/editor code
- load plugin runtime or dynamic execution surfaces

## 8. Test Strategy

M3 should include planning for:

- valid minimal content package coverage
- invalid schema version coverage
- invalid cross-reference coverage
- invalid condition/effect reference coverage
- deterministic diagnostics coverage
- no runtime side-effect coverage
- no content-specific hardcoding coverage

Tests should remain neutral fixtures and must not introduce gameplay narratives, branded content, or
runtime demos.

## 9. M3 Task Breakdown

Recommended M3 task sequence:

1. `TASK-029 - Define M3 content package contract`
2. `TASK-030 - Content schema and version manifest`
3. `TASK-031 - Content validation diagnostic adapters`
4. `TASK-032 - Cross-reference validation for content packages`
5. `TASK-033 - Minimal neutral content package fixture`
6. `TASK-034 - Loader boundary and validated content graph contract`
7. `TASK-035 - Content package integration with M2 primitives`
8. `TASK-036 - M3 gate review`

## 10. Non-Goals

- no Save system
- no Event Store
- no persistence
- no UI/editor implementation
- no gameplay/P0 content
- no plugin runtime
- no full runtime host
- no loader implementation in this planning task

## 11. Risks and Open Questions

- How broad should the content model be before it becomes hard to validate or too coupled to a
  specific game shape?
- How do we keep the engine generic and prevent game-specific hardcoded structures from leaking into
  shared packages?
- Should content packages be a single package envelope or a graph of smaller package modules?
- How should localization and text references be versioned and validated before a UI layer exists?
- How should asset references be represented before an asset pipeline exists?
- How do Save and Event Store attach later without forcing a rewrite of the content-model boundary?

## 12. Recommendation

First implementation task after this plan is accepted:

- `TASK-029 - Define M3 content package contract`
