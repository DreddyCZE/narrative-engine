# Task: TASK-030 - Content Schema and Version Manifest

**Milestone:** M3 Data Model / Content Runtime Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Define the content schema and version manifest for content packages.

## Scope

- define the content schema and version manifest contract
- define content package manifest shape
- define compatibility policy
- define declared sections policy
- define deterministic manifest diagnostics expectations
- optionally add lightweight data-only types or helpers only if repo style clearly supports it
- add tests only if production types or helpers are added

## Dependencies

- TASK-029 DONE
- `docs/contracts/CONTENT_PACKAGE_CONTRACT.md`
- `docs/contracts/SCHEMA_VERSIONING_CONTRACT.md`
- `docs/contracts/ENTITY_IDENTITY_CONTRACT.md`
- `docs/contracts/VALIDATION_DIAGNOSTIC_CONTRACT.md`

## Out of Scope

- no loader runtime
- no content graph resolver
- no cross-reference validation beyond declared section policy
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
