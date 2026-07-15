# Task: TASK-096 - Read-only browser vertical slice prototype

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Create the first visible browser prototype for the accepted read-only runtime path by rendering the smoke scenario presentation, exposing only safe `look` and `inventory` interactions, and routing those interactions through the TASK-095 UI-neutral interaction boundary.

## Dependencies

- TASK-095 DONE
- public read-only smoke scenario fixture
- public read-only presentation snapshot scenario
- UI-neutral read-only interaction boundary
- content read model boundary
- runtime player state contract
- validation diagnostic contract

## Scope

- minimal browser prototype shell under the existing `apps/runtime` workspace location
- plain TypeScript DOM rendering with static HTML/CSS
- initial presentation rendering from `runReadonlyRuntimePresentationSnapshotScenario()`
- in-memory runtime context built from public engine-contracts APIs only
- safe action buttons for `look` and `inventory`
- interaction flow through `executeRuntimeReadonlyInteraction(...)`
- read-only interaction output rendering for location and inventory results
- diagnostics panel rendering
- deterministic prototype tests for initial state, supported actions, interaction handling, JSON safety, and no-next-state scope
- metadata updates for TASK-095 DONE and TASK-096 REVIEW when complete

## Out of Scope

- gameplay mutation
- movement
- item pickup
- dialogue progression
- use-command execution
- save/load behavior
- next-state generation
- generic mutable command execution
- direct command plan creation
- direct lower-level executor calls
- localStorage, sessionStorage, indexedDB, or any browser persistence
- backend services
- external APIs
- DB or external storage
- replay runtime
- plugin runtime
- P0 story content
- editor tooling
