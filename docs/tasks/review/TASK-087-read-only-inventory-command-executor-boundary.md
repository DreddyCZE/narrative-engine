# Task: TASK-087 - Read-only inventory command executor boundary

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add the second intentionally executable runtime command boundary by executing only a planned `inventory` command in a read-only way over the accepted command-planning, content, and player-state contracts.

## Dependencies

- TASK-086 DONE
- minimal content package contract and action affordance set
- content package loader boundary and validated content graph output
- content read model boundary
- runtime player state contract
- runtime command request validation boundary
- runtime command planning boundary
- read-only look command executor boundary
- validation diagnostic contract

## Scope

- read-only inventory command execution contract types and deterministic status set
- execution input validation that reuses TASK-085 planning validation, TASK-083 player-state validation, and TASK-082 content read model validation
- deterministic read-only inventory view creation from `playerState.inventoryItemIds` and read-only content item descriptors
- rejection of non-inventory plans and blocking of non-planned inventory plans or unresolved inventory item ids
- public engine-contracts exports for the inventory executor surface
- targeted public API tests for executed, rejected, and blocked results, empty inventory handling, deterministic execution, and explicit non-mutation scope
- metadata updates for TASK-086 DONE and TASK-087 REVIEW when complete

## Out of Scope

- generic command execution
- executing `look`, `go`, `talk`, `take`, `use`, `save`, or `load`
- gameplay state mutation
- item pickup or inventory mutation
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
