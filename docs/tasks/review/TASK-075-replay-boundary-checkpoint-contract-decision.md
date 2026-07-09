# Task: TASK-075 - Replay boundary checkpoint and next contract decision

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Create an M7 replay boundary checkpoint that reviews the existing replay planning and contracts, confirms what is deferred, and recommends exactly one next contract-level replay task without implementing replay runtime execution.

## Dependencies

- TASK-074 DONE
- replay planning and contract boundary
- storage adapter interface contracts
- serialization and schema version contracts
- M7 save/load checkpoint

## Scope

- docs-only replay boundary checkpoint and next contract decision
- summary of existing replay planning artifacts, contract exports, and tests
- confirmation of current replay public surface using actual repo exports
- explicit separation between save/load and replay
- comparison of candidate next replay workstreams
- exactly one recommended next contract-level replay task

## Out of Scope

- production code changes
- replay runtime execution
- event stream replay implementation
- state rebuild from events
- deterministic replay runner
- replay UI or debug viewer
- gameplay or P0 content
- map editor integration
- save/load UI
- DB adapter
- external or cloud storage
- plugin runtime
- external network
