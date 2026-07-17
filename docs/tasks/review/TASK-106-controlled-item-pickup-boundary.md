# Task: TASK-106 - Controlled item pickup boundary

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add the first controlled `take` gameplay mutation as a dedicated boundary that allows pickup only for a visible portable current-location item selected through an explicit UI item button.

## Dependencies

- TASK-105 accepted and merged into `origin/main`
- base commit `da265a7a8cb51930f0f4d03abb8dca3d740d8bfe`
- runtime prototype in `apps/runtime`
- movement executor boundary
- item presence projection

## Scope

- dedicated runtime item pickup executor in engine contracts
- public export for the pickup executor boundary
- explicit prototype controller `pickupItem(itemId: string)` flow
- explicit visible-item `Take` buttons in the runtime prototype
- projection update proving room item versus inventory item separation after pickup
- engine and prototype tests for successful and blocked pickup behavior
- metadata updates for TASK-105 DONE and TASK-106 REVIEW when complete

## Out of Scope

- generic `Take` command palette execution
- parser or arbitrary item input
- dialogue progression
- use/effect execution
- save/load UI integration
- replay runtime
- browser, DB, or external storage
- map editor
- plugin runtime
- P0 story content
