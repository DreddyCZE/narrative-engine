# Task: TASK-029 - Define M3 Content Package Contract

**Milestone:** M3 Data Model / Content Runtime Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Define the M3 content package contract.

## Scope

- create the content package contract document
- define package identity and metadata requirements
- define schema and version contract requirements
- define neutral data sections
- define references to M2 primitives
- define diagnostics and validation expectations
- optionally add lightweight exported TypeScript types only if repo style clearly supports it
- add tests only if production types or helpers are added

## Dependencies

- TASK-028 DONE
- `docs/planning/M3_DATA_MODEL_CONTENT_RUNTIME_BOUNDARY.md`
- M2 contracts and handoffs
- project charter

## Out of Scope

- no loader runtime
- no content graph loader
- no cross-reference resolver implementation
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
- no Purgatorium-specific content
