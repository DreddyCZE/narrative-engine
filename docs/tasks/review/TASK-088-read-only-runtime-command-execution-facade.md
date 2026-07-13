# Task: TASK-088 - Read-only runtime command execution facade

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add a narrow read-only runtime command execution facade that delegates only to the accepted `look` and `inventory` executors while preserving the existing planning, content, and player-state boundaries.

## Dependencies

- TASK-087 DONE
- minimal content package contract and action affordance set
- content package loader boundary and validated content graph output
- content read model boundary
- runtime player state contract
- runtime command request validation boundary
- runtime command planning boundary
- read-only look command executor boundary
- read-only inventory command executor boundary
- validation diagnostic contract

## Scope

- read-only command execution facade contract types and deterministic status set
- execution input validation that reuses TASK-085 planning validation, TASK-083 player-state validation, and TASK-082 content read model validation
- strict delegation of `look` to the accepted look executor and `inventory` to the accepted inventory executor
- deterministic wrapped read-only result envelope for supported command views
- rejection of unsupported planned commands and blocking of non-planned supported commands
- public engine-contracts exports for the read-only command execution facade surface
- targeted public API tests for look and inventory delegation, blocked and rejected results, preserved delegated diagnostics, deterministic execution, and explicit non-mutation scope
- metadata updates for TASK-087 DONE and TASK-088 REVIEW when complete

## Out of Scope

- generic mutable command execution
- naming this facade `executeRuntimeCommand` or `executeCommand`
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
