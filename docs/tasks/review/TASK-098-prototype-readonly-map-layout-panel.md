# Task: TASK-098 - Prototype read-only map/layout panel

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add the first visible read-only map/layout panel to the browser runtime prototype, using UI-only layout data in `apps/runtime` while keeping engine contracts, content schema, and runtime player state unchanged.

## Dependencies

- TASK-097 DONE
- public read-only presentation snapshot scenario
- UI-neutral read-only interaction boundary
- read-only smoke scenario fixture
- content read model boundary
- runtime player state contract
- validation diagnostic contract

## Scope

- a UI-only map/layout model local to `apps/runtime`
- read-only layout panel rendering for the smoke scenario using plain HTML/CSS grid
- current location highlight and visible connected location tile
- simple connection/corridor indicator and legend
- deterministic prototype tests for map presence, read-only behavior, disabled movement non-execution, and no engine map export leakage
- metadata updates for TASK-097 DONE and TASK-098 REVIEW when complete

## Out of Scope

- movement execution
- map editor behavior
- map drag/drop or tile clicking
- gameplay mutation
- save/load implementation
- direct command planning
- direct lower-level executor calls
- localStorage, sessionStorage, IndexedDB, file storage, DB, or external storage
- replay runtime
- plugin runtime
- P0 story content
- backend services or external APIs

