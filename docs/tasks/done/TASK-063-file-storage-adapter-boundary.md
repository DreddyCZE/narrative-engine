# Task: TASK-063 - File storage adapter boundary

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** DONE
**Priority:** P0

## Goal

Implement an explicit file storage adapter boundary behind the storage adapter contracts.

## Dependencies

- TASK-061 DONE
- TASK-062 DONE
- storage adapter contracts
- serialization/schema contracts
- persistence contracts
- in-memory Event Store boundary
- in-memory Save snapshot boundary

## Scope

- concrete file adapter behind storage adapter boundary
- root-directory scoped file IO only
- deterministic JSON serialization
- event records write/read
- snapshot write/read
- validation through storage and persistence contracts
- corruption and missing-file diagnostics
- temp-dir tests
- no runtime host direct writes

## Out of Scope

- DB adapter
- external storage adapter
- cloud or external network storage
- replay runtime behavior
- UI/editor save-load flow
- gameplay/P0 content
- plugin runtime
- auth or multi-user saves
