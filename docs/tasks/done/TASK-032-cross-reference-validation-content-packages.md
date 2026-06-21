# Task: TASK-032 - Cross-reference Validation for Content Packages

**Milestone:** M3 Data Model / Content Runtime Boundary
**Status:** DONE
**Priority:** P0

## Goal

Define cross-reference validation for content packages.

## Scope

- define cross-reference validation contract and rules
- define stable reference path semantics
- define duplicate ID expectations
- define missing and unresolved reference diagnostics
- define section-local and package-global reference rules
- optionally add a lightweight data-only helper only if repo style clearly supports it
- add tests only if production types or helpers are added

## Dependencies

- TASK-031 DONE
- `docs/contracts/CONTENT_PACKAGE_CONTRACT.md`
- `docs/contracts/CONTENT_SCHEMA_VERSION_MANIFEST.md`
- `docs/contracts/CONTENT_VALIDATION_DIAGNOSTICS.md`
- `docs/contracts/ENTITY_IDENTITY_CONTRACT.md`

## Out of Scope

- no loader runtime
- no content graph resolver as a runtime graph
- no schema validation engine
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
