# Task: TASK-097 - Prototype command palette and disabled gameplay actions

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** DONE
**Priority:** P0

## Goal

Extend the browser runtime prototype with a visible command palette that shows currently executable read-only actions alongside planned but disabled gameplay actions, while keeping all runtime behavior strictly read-only and in-memory.

## Dependencies

- TASK-096 DONE
- public read-only presentation snapshot scenario
- UI-neutral read-only interaction boundary
- read-only smoke scenario fixture
- content read model boundary
- runtime player state contract
- validation diagnostic contract

## Scope

- command palette UI model covering enabled and disabled prototype commands
- enabled palette actions for `look` and `inventory`
- disabled visible palette actions for `go`, `talk`, `take`, `use`, `save`, and `load`
- local UI-only disabled-action feedback without runtime execution
- updated DOM rendering and styling in `apps/runtime`
- deterministic prototype tests for palette membership, enablement, disabled-action non-execution, JSON safety, and preserved read-only execution behavior
- metadata updates for TASK-096 DONE and TASK-097 REVIEW when complete

## Out of Scope

- gameplay mutation
- movement execution
- dialogue execution
- inventory mutation
- use/effect execution
- save/load implementation
- next-state generation
- direct command planning
- direct lower-level executor calls
- localStorage, sessionStorage, IndexedDB, file storage, DB, or external storage
- replay runtime
- plugin runtime
- P0 story content
- backend services or external APIs