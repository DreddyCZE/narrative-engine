# Task: TASK-039 - Manifest and section validation implementation

**Milestone:** M4 Content Loader / Validation Implementation
**Status:** REVIEW
**Priority:** P0

## Goal

Implement the first pure validation step for the content loader boundary: manifest and declared
section validation.

## Scope

- pure function accepting `ContentLoaderInput`
- manifest presence and shape checks
- required manifest field checks
- load status result
- declared section existence checks
- undeclared section diagnostics when policy requires them
- deterministic diagnostics
- input immutability
- tests using the minimal neutral content fixture

## Dependencies

- TASK-038 DONE
- `packages/engine-contracts/src/content-loader/content-loader-types.ts`
- `docs/contracts/CONTENT_PACKAGE_CONTRACT.md`
- `docs/contracts/CONTENT_SCHEMA_VERSION_MANIFEST.md`
- `docs/contracts/CONTENT_VALIDATION_DIAGNOSTICS.md`

## Out of Scope

- no file IO
- no production loader orchestration
- no reference validation
- no ID indexing
- no M2 primitive validation
- no runtime content graph builder
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
- no runtime host
