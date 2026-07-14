# Task: TASK-094 - UI-neutral read-only input request contract

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add a deterministic UI-neutral read-only input request contract that validates the small safe command input shape a future browser UI may send into the accepted read-only runtime request facade.

## Dependencies

- TASK-093 DONE
- read-only runtime request execution facade
- read-only transcript scenario
- UI-neutral read-only presentation model
- public read-only presentation snapshot scenario
- runtime command request validation boundary
- runtime command planning boundary
- validation diagnostic contract

## Scope

- UI-neutral read-only input request type and deterministic contract version
- validator, assertion helper, and formatting helper for the read-only input request shape
- conversion helper from valid read-only input into `RuntimeCommandRequest`
- support only `look` and `inventory`
- deterministic rejection of mutable, unsupported, malformed, non-JSON-safe, or unknown-field input
- public engine-contracts exports for the input contract surface
- targeted public API tests for acceptance, rejection, determinism, non-mutation, JSON safety, and no-execution-output scope
- metadata updates for TASK-093 DONE and TASK-094 REVIEW when complete

## Out of Scope

- browser UI
- React
- CSS
- DOM
- canvas
- map renderer
- free-text or natural-language command parsing
- keyboard/input event handling
- command execution
- runtime command planning
- content loading
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
