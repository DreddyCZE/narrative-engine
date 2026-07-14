# Task: TASK-093 - Public read-only presentation snapshot scenario

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add a deterministic public read-only presentation snapshot scenario that composes the accepted transcript scenario and the accepted UI-neutral presentation model into one stable snapshot future UI and prototype work can consume without knowing engine internals.

## Dependencies

- TASK-092 DONE
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
- read-only runtime request execution facade
- read-only runtime transcript scenario
- UI-neutral read-only runtime presentation model
- validation diagnostic contract

## Scope

- public read-only presentation snapshot scenario result types and deterministic scenario version
- snapshot runner that composes only the transcript scenario and presentation model helpers
- compact summary derived from presentation data
- stable public snapshot envelope with transcript source id, package id, presentation model, and summary
- JSON-safe deterministic snapshot output with no mutation or next-state behavior
- public engine-contracts exports for the snapshot scenario surface
- targeted public API tests for composition behavior, summary derivation, determinism, strict non-mutation scope, and explicit no-next-state behavior
- metadata updates for TASK-092 DONE and TASK-093 REVIEW when complete

## Out of Scope

- browser UI
- React
- CSS
- DOM
- canvas
- map renderer
- generic mutable command execution
- direct lower-level runtime command calls in the snapshot runner
- executing `go`, `talk`, `take`, `use`, `save`, or `load`
- gameplay state mutation
- inventory mutation or item pickup
- next-state generation
- movement or dialogue progression
- effect application
- event emission
- save/load integration behavior
- P0 story content authoring
- replay runtime
- DB or external storage
- plugin runtime
- external network
