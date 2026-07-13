# Task: TASK-089 - Public read-only runtime smoke scenario

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** DONE
**Priority:** P0

## Goal

Add a public read-only runtime smoke scenario that proves the accepted content loading, read model, player-state, planning, and read-only execution boundaries work together end-to-end without UI, gameplay mutation, or P0 story content.

## Dependencies

- TASK-088 DONE
- minimal content package contract and action affordance set
- content package loader boundary and validated content graph output
- content read model boundary
- runtime player state contract
- runtime command request validation boundary
- runtime command planning boundary
- read-only look command executor boundary
- read-only inventory command executor boundary
- read-only runtime command execution facade
- validation diagnostic contract

## Scope

- neutral public smoke content package factory
- deterministic smoke scenario runner that uses only public loader, read model, player state, planning, and read-only facade APIs
- deterministic smoke scenario result with stable step summaries for `look` and `inventory`
- explicit no-mutation and no-next-state smoke evidence in tests
- public engine-contracts exports for the smoke scenario surface
- targeted public API tests for package validity, end-to-end scenario execution, determinism, and strict read-only command scope
- metadata updates for TASK-088 DONE and TASK-089 DONE when complete

## Out of Scope

- P0 story content
- final game content
- UI or browser shell
- generic mutable command execution
- executing `go`, `talk`, `take`, `use`, `save`, or `load`
- gameplay state mutation
- movement or inventory mutation
- next-state generation
- dialogue progression
- effect application
- event emission
- transaction or storage behavior
- replay runtime
- DB or external storage
- plugin runtime
- external network
