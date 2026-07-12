# Task: TASK-084 - Runtime command request validation boundary

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add a minimal validated runtime command request boundary around the existing `RuntimeCommandRequest` contract so future command planning and execution can depend on a deterministic request shape without introducing command behavior.

## Dependencies

- TASK-083 DONE
- minimal content package contract and action affordance set
- content package loader boundary and validated content graph output
- content read model boundary
- runtime player state contract
- validation diagnostic contract

## Scope

- validation helpers for the existing `RuntimeCommandRequest` contract
- deterministic diagnostics for request shape, supported command ids, optional entity ids, JSON-safe payloads, forbidden keys, and unknown fields
- content-affordance validation against the public content read model boundary
- optional runtime player state validation relationship without mutation or execution
- public engine-contracts exports for the runtime command request validation surface
- targeted public API tests for valid requests, invalid requests, content affordance checks, deterministic diagnostics, and explicit non-execution scope
- metadata updates for TASK-083 DONE and TASK-084 REVIEW when complete

## Out of Scope

- runtime command execution
- command planning or dispatch
- movement or gameplay state mutation
- inventory mutation
- dialogue progression
- effect application
- event emission
- next-state generation
- save/load integration behavior beyond pure request validation
- P0 story content authoring
- UI or browser shell
- map or editor implementation
- replay runtime
- DB or external storage
- plugin runtime
- external network
