# Task: TASK-091 - Read-only runtime transcript scenario

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** DONE
**Priority:** P0

## Goal

Add a deterministic read-only runtime transcript scenario that runs a fixed sequence of request-level read-only commands through the accepted request facade and returns a stable transcript future UI and prototype work can reference.

## Dependencies

- TASK-090 DONE
- minimal content package contract and action affordance set
- content package loader boundary and validated content graph output
- content read model boundary
- runtime player state contract
- runtime command request validation boundary
- runtime command planning boundary
- read-only look command executor boundary
- read-only inventory command executor boundary
- read-only runtime command execution facade
- public read-only runtime smoke scenario
- read-only runtime request execution facade
- validation diagnostic contract

## Scope

- read-only transcript scenario result types and deterministic scenario version
- transcript scenario runner that uses only public smoke package, loader, read model, player-state, and read-only request execution APIs
- exact read-only request sequence `look`, `inventory`, `look`
- compact transcript lines derived from read-only execution views
- deterministic structured command details and transcript line output
- explicit identical initial and final player state snapshots
- public engine-contracts exports for the transcript scenario surface
- targeted public API tests for end-to-end transcript execution, line derivation, determinism, strict read-only scope, and non-mutation behavior
- metadata updates for TASK-090 DONE and TASK-091 DONE when complete

## Out of Scope

- generic mutable command execution
- new planner or executor behavior
- executing `go`, `talk`, `take`, `use`, `save`, or `load`
- gameplay state mutation
- inventory mutation or item pickup
- next-state generation
- movement or dialogue progression
- effect application
- event emission
- save/load integration behavior
- P0 story content authoring
- UI or browser shell
- map or editor implementation
- replay runtime
- DB or external storage
- plugin runtime
- external network
