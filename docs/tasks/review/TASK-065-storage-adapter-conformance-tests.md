# Task: TASK-065 - Storage adapter conformance tests

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add storage adapter conformance tests that unify expected storage behavior across public adapter boundaries.

## Dependencies

- TASK-064 DONE
- storage adapter contracts
- serialization/schema contracts
- file storage adapter boundary
- in-memory persistence boundaries

## Scope

- shared test expectations for the storage adapter contract
- conformance coverage for the file storage adapter
- deterministic ordering
- idempotence
- conflicting duplicate rejection
- missing/corrupt diagnostics where applicable
- path traversal/root safety for the file adapter
- no runtime host direct writes

## Out of Scope

- new production storage adapter
- DB adapter
- external storage adapter
- replay runtime
- UI/editor save-load flow
- gameplay/P0 content
- plugin runtime
- external network