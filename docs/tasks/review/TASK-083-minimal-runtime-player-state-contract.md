# Task: TASK-083 - Minimal runtime player state contract

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Define the minimal validated runtime player state contract that future runtime command planning and execution can depend on without introducing any command behavior, gameplay mutation, UI, or content authoring scope.

## Dependencies

- TASK-082 DONE
- content package contract and validation helpers
- content package loader boundary and validated content graph output
- content read model boundary
- validation diagnostic contract

## Scope

- public runtime player state contract types for location, inventory item ids, progress flags, revision, and metadata
- public validation, assertion, and formatting helpers for runtime player state inspection
- deterministic initial-state creation helper from the validated content read-model boundary
- public engine-contracts exports for the runtime player state surface
- targeted contract tests for valid state, invalid diagnostics, deterministic creation, public content-boundary integration, and non-command scope
- metadata updates for TASK-082 DONE and TASK-083 REVIEW when complete

## Out of Scope

- runtime command execution
- movement or gameplay state mutation
- inventory mutation
- dialogue progression
- event emission
- save/load integration behavior beyond pure state-shape creation
- P0 story content authoring
- UI or browser shell
- map or editor implementation
- replay runtime
- DB or external storage
- plugin runtime
- external network
