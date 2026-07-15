# Task: TASK-099 - Prototype data-driven scenario selector

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add a data-driven scenario selector to the browser runtime prototype so the UI can switch between at least two read-only content packages using the existing public content loading, read model, player state, and read-only interaction path.

## Dependencies

- TASK-098 DONE
- public read-only presentation snapshot scenario
- UI-neutral read-only interaction boundary
- read-only smoke scenario fixture
- content package loader boundary
- content read model boundary
- runtime player state contract
- validation diagnostic contract

## Scope

- app-layer scenario registry and prototype scenario data in `apps/runtime`
- at least two selectable read-only prototype scenarios
- app-layer map layout registry that switches with selected scenario
- scenario selector UI and controller support in `apps/runtime`
- deterministic prototype tests for scenario switching, per-scenario read-only actions, disabled action locality, JSON safety, and no engine export leakage
- metadata updates for TASK-098 DONE and TASK-099 REVIEW when complete

## Out of Scope

- movement execution
- item pickup
- dialogue execution
- use/effect execution
- save/load behavior
- persistence of selected scenario
- direct command planning
- direct lower-level executor calls
- localStorage, sessionStorage, IndexedDB, file storage, DB, or external storage
- replay runtime
- plugin runtime
- P0 story content
- backend services or external APIs

