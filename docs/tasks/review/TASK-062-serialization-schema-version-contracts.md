# Task: TASK-062 - Serialization and schema version contracts

**Milestone:** M7 Production Storage Adapter / Replay Planning
**Status:** REVIEW
**Priority:** P0

## Goal

Add data-only serialization and schema version contracts for the future production storage and replay boundary.

## Dependencies

- TASK-060 DONE
- `docs/planning/M7_PRODUCTION_STORAGE_ADAPTER_REPLAY_BOUNDARY.md`
- persistence contracts
- Engine State contract
- Domain Event contract

## Scope

- serialization envelope contracts
- schema version contracts
- deterministic serialization metadata
- checksum and hash metadata contracts
- migration plan and descriptor stubs as data-only types
- JSON-safe examples and validation helpers
- no serializer implementation and no migration runtime

## Out of Scope

- production file IO
- concrete file adapter implementation
- database adapter implementation
- external storage adapter implementation
- replay runtime behavior
- migration runtime behavior
- UI/editor save-load flow
- gameplay/P0 content
- plugin runtime
- external network
