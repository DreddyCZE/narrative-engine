# Task: TASK-060 - Plan M7 Production Storage Adapter / Replay Boundary

**Milestone:** M7 Production Storage Adapter / Replay Planning
**Status:** REVIEW
**Priority:** P0

## Goal

Prepare the M7 plan for the Production Storage Adapter / Replay Boundary.

## Dependencies

- TASK-059 DONE
- `docs/reviews/M6-GATE-REVIEW.md`
- persistence contracts
- in-memory Event Store boundary
- in-memory Save snapshot boundary
- runtime result to Event Store adapter
- in-memory persistence integration test

## Scope

- define the production storage adapter boundary
- define the file adapter as a future explicit implementation boundary
- define the DB adapter as a future explicit implementation boundary
- define the deterministic serialization boundary
- define the migration and schema evolution plan
- define the replay boundary
- define the load and rebuild state strategy
- define the test strategy
- split M7 into small tasks

## Out of Scope

- production file IO implementation
- DB or storage adapter implementation
- replay runtime implementation
- storage migration runtime
- UI/editor save-load flow
- gameplay/P0 content
- plugin runtime
- external network or cloud save
