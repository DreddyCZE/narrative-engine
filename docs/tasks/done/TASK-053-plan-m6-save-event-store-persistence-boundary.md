# Task: TASK-053 - Plan M6 Save/Event Store / Persistence Boundary

**Milestone:** M6 Save/Event Store / Persistence Boundary Planning
**Status:** DONE
**Priority:** P0

## Goal

Prepare the M6 plan for the Save/Event Store / Persistence Boundary.

## Dependencies

- TASK-052 DONE
- `docs/reviews/M5-GATE-REVIEW.md`
- return-only runtime domain event values
- in-memory runtime command pipeline
- `docs/contracts/ENGINE_STATE_CONTRACT.md`
- `docs/contracts/TRANSACTION_CONTRACT.md`
- `docs/contracts/DOMAIN_EVENT_CONTRACT.md`

## Scope

- define the persistence boundary
- define the Event Store boundary
- define the Save snapshot boundary
- define the relationship to runtime return-only event values
- define serialization and deterministic replay strategy as a plan
- define the storage adapter as a future boundary
- define the test strategy
- split M6 into small tasks

## Out of Scope

- Event Store implementation
- Save system implementation
- persistence implementation
- file IO
- database or storage adapter implementation
- replay runtime behavior
- UI/editor implementation
- gameplay/P0 content
- plugin runtime
