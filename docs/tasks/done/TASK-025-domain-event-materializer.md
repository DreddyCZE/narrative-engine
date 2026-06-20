# TASK-025 - Domain Event Materializer

## ID

TASK-025

## Title

Domain Event Materializer

## Milestone

M2D - Event Materialization

## Status

DONE

## Priority

P0

## Objective

Implement a narrow, deterministic Domain Event materializer. The materializer validates a committed
transaction result plus a candidate confirmed event or batch, produces confirmed Domain Event batch
objects in memory, preserves input immutability, and returns stable diagnostics without introducing
Event Store, Save, replay, subscriber delivery, or runtime pipeline behavior.

## Context

TASK-016 established shared JSON-safe and canonical serialization utilities. TASK-017 established
the Entity Identity validator. TASK-018 established the Schema Versioning compatibility helper.
TASK-019 established the Engine State validator. TASK-020 established the Validation Diagnostic
adapter/core model. TASK-021 established the readonly Condition evaluator. TASK-022 established the
deterministic Effect applicator. TASK-023 established the deterministic Command planning boundary.
TASK-024 established the in-memory Transaction Manager reference implementation. TASK-025 applies
Domain Event materialization above those primitives.

## Dependencies

- TASK-016 DONE
- TASK-017 DONE
- TASK-018 DONE
- TASK-019 DONE
- TASK-020 DONE
- TASK-021 DONE
- TASK-022 DONE
- TASK-023 DONE
- TASK-024 DONE
- Domain Event Contract
- Transaction Contract
- Validation Diagnostic Contract

## Scope

- Validate materialization input shape according to the contract.
- Accept committed transaction results only.
- Materialize confirmed Domain Event objects from a candidate event or event batch.
- Validate revision boundaries, sequence ordering, event IDs, event types, and payload shape.
- Support empty confirmed batches for committed transactions with no public event.
- Preserve input immutability for both transaction input and candidate event data.
- Return stable diagnostics for invalid shape, non-committed transactions, invalid event shape,
  duplicate IDs, duplicate sequences, invalid payloads, and revision mismatches.
- Add focused tests for materialized, empty, rejected, invalid, deterministic, and immutability
  behavior.

## Explicit Out of Scope

- Event Store.
- Event persistence.
- Subscriber delivery.
- Event bus.
- Replay.
- Save system.
- Persistence.
- Crash recovery.
- UI or editor work.
- Gameplay/P0 content.
- Plugin runtime.

## Acceptance Criteria

- Committed transaction inputs materialize deterministically in memory.
- No-op, rejected, rolled-back, and errored transactions do not materialize confirmed events.
- Invalid event shape, invalid payloads, revision mismatches, duplicate IDs, and duplicate
  sequences are handled with stable diagnostics.
- Candidate event data and transaction input remain unchanged.
- Tests cover materialized, empty, rejected, error, deterministic, diagnostics, and immutability
  behavior.

## Mandatory Outputs

- `packages/engine-kernel/**`
- `tests/**`
- `docs/handoffs/TASK-025-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`

## Allowed Changes

- `docs/tasks/active/TASK-025-domain-event-materializer.md`
- `docs/tasks/review/TASK-025-domain-event-materializer.md`
- `docs/tasks/done/TASK-025-domain-event-materializer.md`
- `docs/handoffs/TASK-025-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`
- `packages/engine-kernel/**`
- `packages/engine-contracts/**` only if shared contract exports are needed
- `tests/**`

## Forbidden Changes

- TASK-026 or later task files.
- Event Store, Save, UI/editor, plugin runtime, or gameplay content.
- Persistence logic or replay engine behavior.
- Broad refactors outside the materializer and its direct dependencies.

## Risks

- Letting the materializer become a storage, replay, or subscriber system.
- Reintroducing mutation through normalization helpers.
- Coupling event materialization to runtime registries or plugin systems.
- Expanding the reference implementation into persistence semantics.

## Definition of Done

- TASK-025 has a deterministic production Domain Event materializer and focused tests.
- The task is moved to `docs/tasks/done/` with status `DONE`.
- `docs/handoffs/TASK-025-HANDOFF.md` exists after implementation and acceptance.
- `docs/status/CURRENT_STATE.md` records TASK-025 as done and the next step as TASK-026.
- Required checks pass.
