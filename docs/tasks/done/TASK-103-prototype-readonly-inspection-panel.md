# Task: TASK-103 - Prototype read-only inspection panel

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add a read-only inspection/detail panel to the browser prototype so the user can inspect visible locations, exits, items, and NPCs without executing runtime commands or mutating gameplay state.

## Dependencies

- TASK-102 merged to `origin/main`
- runtime prototype in `apps/runtime`
- runtime movement diagnostics boundary
- runtime command planning boundary
- runtime command request validation boundary

## Scope

- read-only inspection panel state and rendering
- inspect controls for current location, exits, visible items, and visible NPCs
- clear inspection flow
- prototype tests for inspection behavior and no-mutation guarantees
- metadata updates for TASK-102 DONE and TASK-103 REVIEW when complete

## Out of Scope

- item pickup
- inventory mutation
- dialogue execution
- use/effect execution
- save/load UI integration
- replay runtime
- browser, DB, or external storage
- parser or arbitrary command input
- map editor
- plugin runtime
- P0 story content
