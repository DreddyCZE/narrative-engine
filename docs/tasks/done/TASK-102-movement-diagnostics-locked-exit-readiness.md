# Task: TASK-102 - Movement diagnostics and locked-exit readiness

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Stabilize the controlled movement slice by adding clear diagnostics for locked and condition-gated exits while keeping movement narrowly scoped and deterministic.

## Dependencies

- TASK-101 merged to `origin/main`
- runtime movement command executor boundary
- runtime command request validation boundary
- runtime command planning boundary
- runtime player state contract
- runtime prototype in `apps/runtime`

## Scope

- blocked movement diagnostics for `locked: true` exits
- blocked movement diagnostics for unmet `conditionFlag` exits
- prototype exit availability rendering for available, locked, and condition-gated exits
- prototype output updates for blocked movement without location or map changes
- metadata updates for TASK-101 DONE and TASK-102 REVIEW when complete

## Out of Scope

- parser or arbitrary target input
- item pickup
- inventory mutation
- dialogue progression
- use/effect execution
- save/load UI integration
- replay runtime
- browser, DB, or external storage
- map editor
- plugin runtime
- P0 story content
