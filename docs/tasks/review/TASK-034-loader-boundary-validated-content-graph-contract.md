# Task: TASK-034 - Loader Boundary and Validated Content Graph Contract

**Milestone:** M3 Data Model / Content Runtime Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Define the loader boundary and validated content graph contract.

## Scope

- define the loader boundary contract
- define the validated content graph contract
- define input and output shapes
- define validation stages
- define deterministic diagnostics behavior
- define the relationship to the minimal neutral content fixture
- define the relationship to future TASK-035 integration
- keep the work documentation-only unless a type-only skeleton is clearly justified

## Dependencies

- TASK-033 DONE
- `docs/contracts/CONTENT_PACKAGE_CONTRACT.md`
- `docs/contracts/CONTENT_SCHEMA_VERSION_MANIFEST.md`
- `docs/contracts/CONTENT_VALIDATION_DIAGNOSTICS.md`
- `docs/contracts/CONTENT_REFERENCE_VALIDATION.md`
- `tests/fixtures/content/minimal-neutral-content-package/content-package.json`

## Out of Scope

- no production loader implementation
- no file IO loader
- no runtime content graph builder
- no schema validation engine
- no runtime execution
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
