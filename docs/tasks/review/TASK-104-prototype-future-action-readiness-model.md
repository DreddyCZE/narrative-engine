# Task: TASK-104 - Prototype future action readiness model

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add a UI-only future action readiness model to the browser prototype so the inspection panel can show which future actions may later apply to the selected location, exit, item, or NPC without making any new command executable.

## Dependencies

- TASK-103 merged to `origin/main`
- runtime prototype in `apps/runtime`
- read-only inspection panel
- controlled movement boundary

## Scope

- app-layer readiness metadata for inspected entities
- inspection panel rendering for future action readiness rows
- prototype tests for readiness visibility and non-mutation guarantees
- metadata updates for TASK-103 DONE and TASK-104 REVIEW when complete

## Out of Scope

- runtime execution for `take`, `talk`, or `use`
- command planning from readiness metadata
- parser or arbitrary command input
- item pickup, inventory mutation, dialogue progression, or effect execution
- save/load UI integration
- replay runtime
- browser, DB, or external storage
- map editor
- plugin runtime
- P0 story content
