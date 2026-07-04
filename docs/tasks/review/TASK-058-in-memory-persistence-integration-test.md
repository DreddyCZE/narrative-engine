# Task: TASK-058 - In-memory persistence integration test

**Milestone:** M6 Save/Event Store / Persistence Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add in-memory persistence integration coverage across the full M6 runtime-to-persistence path.

## Dependencies

- TASK-057 DONE
- runtime command pipeline
- runtime result event store adapter
- in-memory Event Store boundary
- in-memory Save snapshot boundary
- persistence contracts

## Scope

- minimal fixture to validated graph to `RuntimeHostInput`
- execute the in-memory command pipeline
- adapt the runtime result into persistence event records
- append through the in-memory Event Store boundary
- create and save a snapshot through the in-memory Save snapshot boundary
- assert deterministic event record and snapshot behavior
- assert immutability across inputs and outputs
- no production storage side effects

## Out of Scope

- production file IO
- database or storage adapter implementation
- replay runtime behavior
- UI/editor
- gameplay/P0 content
- plugin runtime
- external network

