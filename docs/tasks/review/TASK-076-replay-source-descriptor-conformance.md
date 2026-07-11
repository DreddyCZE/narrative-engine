# Task: TASK-076 - Replay source descriptor conformance tests

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add contract-level conformance tests for replay source descriptors so the current replay source kinds and validation helpers are frozen before any replay runtime execution work begins.

## Dependencies

- TASK-075 DONE
- replay planning and contract boundary
- storage adapter interface contracts
- serialization and schema version contracts

## Scope

- targeted replay source descriptor conformance tests
- coverage for all current replay source kinds and helpers
- deterministic validation and plan inspection assertions
- metadata updates for TASK-075 DONE and TASK-076 REVIEW when complete

## Out of Scope

- production replay runtime behavior
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
- source inspection or source-grep tests
