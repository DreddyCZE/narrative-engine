# Task: TASK-090 - Read-only runtime request execution facade

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add a narrow read-only runtime request execution facade that accepts a `RuntimeCommandRequest`, creates a deterministic runtime command plan, and executes it through the accepted read-only execution facade for only `look` and `inventory`.

## Dependencies

- TASK-089 DONE
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
- validation diagnostic contract

## Scope

- read-only request execution facade contract types and deterministic status set
- execution input validation that reuses TASK-084 request validation, TASK-083 player-state validation, and TASK-082 content read model validation
- deterministic internal planning through `createRuntimeCommandPlan`
- strict read-only execution delegation through `executeRuntimeReadonlyCommand`
- support only for successful `look` and `inventory` request execution
- deterministic result envelope with request, plan, read-only view, and identical initial/final player state snapshots
- rejection of unsupported mutable commands and blocking of unavailable or invalid supported commands
- public engine-contracts exports for the read-only request execution facade surface
- targeted public API tests for end-to-end look and inventory execution, blocked and rejected results, preserved delegated diagnostics, determinism, and explicit non-mutation scope
- metadata updates for TASK-089 DONE and TASK-090 REVIEW when complete

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
