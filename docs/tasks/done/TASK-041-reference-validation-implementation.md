# Task: TASK-041 - Reference validation implementation

**Milestone:** M4 Content Loader / Validation Implementation
**Status:** DONE
**Priority:** P0

## Goal

Implement pure reference validation over caller-provided content package data and the TASK-040 ID
index.

## Scope

- pure function accepting caller-provided content package object or `ContentLoaderInput`
- reference extraction from known fixture and contract shapes
- validation that reference targets exist in the ID index
- wrong target section diagnostics
- unsupported reference kind diagnostics
- deterministic diagnostics
- stable reference paths
- input immutability
- tests using the minimal neutral content fixture

## Dependencies

- TASK-040 DONE
- content ID indexing
- manifest and section validation
- `docs/contracts/CONTENT_REFERENCE_VALIDATION.md`
- `docs/contracts/CONTENT_VALIDATION_DIAGNOSTICS.md`

## Out of Scope

- no file IO
- no production loader orchestration
- no external dependency package loading
- no runtime content graph builder
- no M2 primitive semantic validation
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
- no runtime host
