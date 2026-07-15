# Task: TASK-095 - UI-neutral read-only interaction boundary

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add a deterministic UI-neutral read-only interaction boundary that validates accepted read-only UX input, converts it into `RuntimeCommandRequest`, executes it through the accepted read-only request facade, and returns a UI-neutral result envelope without introducing UI, parser, planning, or mutable runtime behavior.

## Dependencies

- TASK-094 DONE
- read-only runtime request execution facade
- UI-neutral read-only input request contract
- public read-only smoke scenario fixture path
- runtime player state contract
- content read model boundary
- validation diagnostic contract

## Scope

- UI-neutral read-only interaction input/result types and deterministic contract version
- validator, assertion helper, and formatting helper for interaction input
- composition of TASK-094 input validation/conversion with TASK-090 read-only request execution
- support only `look` and `inventory` through accepted public boundaries
- deterministic JSON-safe interaction result envelope with execution result, diagnostics, and identical initial/final player state snapshots
- public engine-contracts exports for the interaction boundary surface
- targeted public API tests for valid execution, invalid input rejection, delegated blocked diagnostics, determinism, non-mutation, and explicit no-next-state behavior
- metadata updates for TASK-094 DONE and TASK-095 REVIEW when complete

## Out of Scope

- browser UI
- React
- CSS
- DOM
- canvas
- map renderer
- free-text or natural-language parsing
- keyboard/input event handling
- direct command plan creation
- direct lower-level executor calls
- presentation model creation
- generic mutable command execution
- movement
- inventory mutation
- dialogue progression
- save/load behavior
- event emission
- next-state generation
- storage writes
- replay runtime
- DB or external storage
- P0 content package
- plugin runtime
- external network
