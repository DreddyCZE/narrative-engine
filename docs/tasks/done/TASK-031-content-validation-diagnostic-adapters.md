# Task: TASK-031 - Content Validation Diagnostic Adapters

**Milestone:** M3 Data Model / Content Runtime Boundary
**Status:** DONE
**Priority:** P0

## Goal

Define the content validation diagnostic adapters.

## Scope

- define content validation diagnostic taxonomy
- define diagnostic code mapping
- define deterministic diagnostic path rules
- define manifest and content-package diagnostic categories
- optionally add a lightweight adapter or helper for normalization only if repo style clearly supports it
- add tests only if production types or helpers are added

## Dependencies

- TASK-030 DONE
- `docs/contracts/CONTENT_PACKAGE_CONTRACT.md`
- `docs/contracts/CONTENT_SCHEMA_VERSION_MANIFEST.md`
- `docs/contracts/VALIDATION_DIAGNOSTIC_CONTRACT.md`

## Out of Scope

- no loader runtime
- no content graph resolver
- no cross-reference resolver
- no schema validation engine
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
