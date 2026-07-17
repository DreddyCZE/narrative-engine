# Task: TASK-105 - Prototype item presence projection before pickup

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add an app-layer item presence projection to the browser prototype so visible room items, inventory-owned items, and unreachable items are derived consistently from content data plus runtime player state before any future pickup implementation.

## Dependencies

- TASK-104 merged to `origin/main`
- runtime prototype in `apps/runtime`
- read-only inspection panel
- future action readiness model

## Scope

- app-layer item presence projection for runtime prototype items
- world-details and inventory rendering driven by projected item presence
- inspection and readiness updates for visible-here versus in-inventory items
- prototype tests for projection visibility and non-mutation guarantees
- metadata updates for TASK-104 DONE and TASK-105 REVIEW when complete

## Out of Scope

- `take` execution
- inventory mutation or item ownership writes
- parser or arbitrary command input
- dialogue progression or use/effect execution
- save/load UI integration
- replay runtime
- browser, DB, or external storage
- map editor
- plugin runtime
- P0 story content
