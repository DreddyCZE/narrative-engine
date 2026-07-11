# Task: TASK-077 - Replay plan validation hardening

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** DONE
**Priority:** P0

## Goal

Harden replay input and replay plan validation at the contract level so replay preparation is stricter and more predictable before any replay runtime execution work begins.

## Dependencies

- TASK-076 DONE
- replay planning and contract boundary
- replay source descriptor conformance coverage
- storage adapter interface contracts
- serialization and schema version contracts

## Scope

- tighter contract-level replay input and replay plan validation
- deterministic diagnostics and path reporting checks
- targeted tests for valid and invalid replay inputs and plans
- metadata updates for TASK-076 DONE and TASK-077 REVIEW when complete

## Out of Scope

- replay runtime execution
- event stream replay implementation
- state rebuild from events
- deterministic replay runner
- replay storage adapter runtime flow
- replay UI or debug viewer
- gameplay or P0 content
- map editor integration
- save/load UI
- DB adapter
- external or cloud storage
- plugin runtime
- external network
- source inspection or source-grep tests
