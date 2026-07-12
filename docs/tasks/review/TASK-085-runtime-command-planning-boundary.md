# Task: TASK-085 - Runtime command planning boundary

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add a minimal runtime command planning boundary that converts a validated `RuntimeCommandRequest` plus read-only content and player-state context into a deterministic plan-only result without executing commands, mutating state, or producing next-state behavior.

## Dependencies

- TASK-084 DONE
- minimal content package contract and action affordance set
- content package loader boundary and validated content graph output
- content read model boundary
- runtime player state contract
- runtime command request validation boundary
- validation diagnostic contract

## Scope

- command planning contract types and deterministic status set
- planning input validation that reuses TASK-084 request/content validation and TASK-083 player-state validation
- read-only command kind mapping and descriptive plan-step creation for valid minimal commands
- conservative target requirement diagnostics and optional read-only target lookup through the public content read model
- public engine-contracts exports for the runtime command planning surface
- targeted public API tests for planned, rejected, and blocked results, deterministic planning, and explicit non-execution scope
- metadata updates for TASK-084 DONE and TASK-085 REVIEW when complete

## Out of Scope

- runtime command execution
- runtime transaction system
- gameplay state mutation
- next-state generation
- movement or inventory mutation
- dialogue progression
- effect application
- event emission
- save/load integration behavior beyond plan-only descriptors
- P0 story content authoring
- UI or browser shell
- map or editor implementation
- replay runtime
- DB or external storage
- plugin runtime
- external network
