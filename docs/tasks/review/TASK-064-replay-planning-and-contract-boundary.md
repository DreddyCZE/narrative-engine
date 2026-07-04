# Task: TASK-064 - Replay planning and contract boundary

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Prepare replay planning and a data-only replay contract boundary without adding replay execution.

## Dependencies

- TASK-063 DONE
- M7 planning
- storage adapter contracts
- serialization/schema contracts
- persistence contracts
- file storage adapter boundary

## Scope

- replay data-only contracts
- replay source descriptors
- replay input/result/status/diagnostic types
- replay plan documentation
- deterministic replay expectations
- no replay runtime execution

## Out of Scope

- replay execution engine
- event stream replay implementation
- state rebuild implementation
- runtime command execution during replay
- production file IO
- DB adapter
- external storage adapter
- UI/editor save-load flow
- gameplay/P0 content
- plugin runtime
