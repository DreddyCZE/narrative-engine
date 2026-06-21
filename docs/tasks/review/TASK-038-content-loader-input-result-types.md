# Task: TASK-038 - Content loader input/result types

**Milestone:** M4 Content Loader / Validation Implementation
**Status:** REVIEW
**Priority:** P0

## Goal

Define TypeScript input and result types for the content loader boundary.

## Scope

- data-only input and result types
- content load status union
- source metadata shape
- validated content graph value shape skeleton
- diagnostics array shape
- small helper constants or status guard if useful
- tests for exports and shape examples

## Dependencies

- TASK-037 DONE
- `docs/planning/M4_CONTENT_LOADER_VALIDATION_IMPLEMENTATION.md`
- `docs/contracts/CONTENT_LOADER_BOUNDARY.md`
- `docs/contracts/CONTENT_VALIDATION_DIAGNOSTICS.md`
- `docs/contracts/CONTENT_PACKAGE_CONTRACT.md`
- `docs/contracts/CONTENT_SCHEMA_VERSION_MANIFEST.md`
- `docs/contracts/CONTENT_REFERENCE_VALIDATION.md`

## Out of Scope

- no production loader implementation
- no file IO
- no validation engine
- no reference resolver
- no runtime content graph builder
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
