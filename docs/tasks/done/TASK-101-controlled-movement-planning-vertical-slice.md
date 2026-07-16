# Task: TASK-101 - Controlled movement planning vertical slice

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Implement the first controlled movement vertical slice so the browser prototype can execute a narrowly scoped planned `go` command through a dedicated movement boundary, update only the current location deterministically, and refresh the map highlight accordingly.

## Dependencies

- TASK-100 merged to `origin/main`
- runtime command request validation boundary
- runtime command planning boundary
- runtime player state contract
- read-only browser prototype in `apps/runtime`
- prototype scenario registry and UI-only map registry

## Scope

- dedicated public movement command executor boundary
- deterministic `go` execution for current-location updates only
- request/planning integration for explicit exit target selection
- prototype exit selection UI and map highlight updates
- tests for movement boundary and prototype movement flow
- metadata updates for TASK-100 DONE and TASK-101 REVIEW when complete

## Out of Scope

- free-form parser
- arbitrary text command input
- item pickup
- inventory mutation
- dialogue progression
- use/effect execution
- save/load UI integration
- replay runtime
- browser, DB, or external storage
- P0 story content
- map editor
- plugin runtime