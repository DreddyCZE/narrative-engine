# TASK-024 - Transaction Manager Reference Implementation

## ID

TASK-024

## Title

Transaction Manager Reference Implementation

## Milestone

M2C - Transaction Pipeline

## Status

REVIEW

## Priority

P0

## Objective

Implement a narrow, deterministic in-memory Transaction Manager reference implementation. The
manager validates transaction input, uses the Command planning boundary when a command-plan source
is provided, applies ordered Effects to a candidate state in memory, preserves input immutability,
and returns stable diagnostics and transaction results without introducing persistence, event store,
save system, or runtime pipeline behavior.

## Context

TASK-016 established shared JSON-safe and canonical serialization utilities. TASK-017 established
the Entity Identity validator. TASK-018 established the Schema Versioning compatibility helper.
TASK-019 established the Engine State validator. TASK-020 established the Validation Diagnostic
adapter/core model. TASK-021 established the readonly Condition evaluator. TASK-022 established the
deterministic Effect applicator. TASK-023 established the deterministic Command planning boundary.
TASK-024 applies an in-memory Transaction Manager above those primitives.

## Authoritative Inputs

- `PROJECT_CHARTER.md`
- `AGENTS.md`
- `docs/spec/MASTER_SPEC.md`
- `docs/roadmap/ROADMAP.md`
- `docs/status/CURRENT_STATE.md`
- `docs/contracts/TRANSACTION_CONTRACT.md`
- `docs/contracts/COMMAND_CONTRACT.md`
- `docs/contracts/CONDITION_CONTRACT.md`
- `docs/contracts/EFFECT_CONTRACT.md`
- `docs/contracts/ENGINE_STATE_CONTRACT.md`
- `docs/contracts/VALIDATION_DIAGNOSTIC_CONTRACT.md`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`
- `docs/planning/M2_IMPLEMENTATION_SEQUENCE.md`
- `docs/planning/M2_RUNTIME_BOUNDARIES.md`
- `docs/handoffs/TASK-023-HANDOFF.md`
- `docs/tasks/done/TASK-016-shared-json-safe-canonical-serialization-utilities.md`
- `docs/tasks/done/TASK-017-entity-identity-validator.md`
- `docs/tasks/done/TASK-018-schema-versioning-compatibility-helper.md`
- `docs/tasks/done/TASK-019-engine-state-shape-and-snapshot-validator.md`
- `docs/tasks/done/TASK-020-validation-diagnostic-adapter-core-model.md`
- `docs/tasks/done/TASK-021-condition-evaluator.md`
- `docs/tasks/done/TASK-022-effect-applicator.md`
- `docs/tasks/done/TASK-023-command-planning-boundary-reference-handlers.md`

## Scope

- Validate transaction input shape according to the contract.
- Support command-plan and system sources where the contract allows them.
- Use the Command planning boundary when a command-plan input path is available.
- Apply ordered Effects to a cloned candidate state in memory.
- Support committed, no-op, rejected, rolled-back, and error outcomes.
- Preserve input immutability for both request and state.
- Return stable diagnostics for invalid shape, revision conflict, invalid effect application,
  rollback, and no-op policy violations.
- Add focused tests for commit, reject, rollback, no-op, deterministic output, diagnostics, and no
  side effects outside the transaction boundary.

## Explicit Out of Scope

- Domain Event materializer.
- Event Store.
- Save system.
- Persistence implementation.
- Crash recovery.
- Distributed transactions.
- UI or editor work.
- Gameplay/P0 content.
- Plugin runtime.

## Acceptance Criteria

- Supported transaction inputs commit or no-op deterministically in memory.
- Invalid transaction shape, invalid effects, revision conflicts, and no-op policy violations are
  handled with stable diagnostics.
- Candidate state is produced only in memory and the original state remains unchanged.
- Tests cover commit, reject, rollback, deterministic output, diagnostics, and immutability.

## Mandatory Outputs

- `packages/engine-kernel/**`
- `tests/**`
- `docs/handoffs/TASK-024-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`

## Allowed Changes

- `docs/tasks/active/TASK-024-transaction-manager-reference-implementation.md`
- `docs/tasks/review/TASK-024-transaction-manager-reference-implementation.md`
- `docs/tasks/done/TASK-024-transaction-manager-reference-implementation.md`
- `docs/handoffs/TASK-024-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`
- `packages/engine-kernel/**`
- `packages/engine-contracts/**` only if shared contract exports are needed
- `tests/**`

## Forbidden Changes

- TASK-025 or later task files.
- Domain Event, Event Store, Save, UI/editor, plugin runtime, or gameplay content.
- Migration runner behavior or persistence logic.
- Broad refactors outside the transaction manager and its direct dependencies.

## Risks

- Letting the transaction layer become a full event or save pipeline.
- Reintroducing committed-state mutation through candidate helpers.
- Coupling the transaction manager to runtime registries or plugin systems.
- Expanding the reference implementation into a persistence boundary.

## Definition of Done

- TASK-024 has a deterministic production Transaction Manager reference implementation and focused
  tests.
- The task is moved to `docs/tasks/review/` with status `REVIEW`.
- `docs/handoffs/TASK-024-HANDOFF.md` exists after implementation.
- `docs/status/CURRENT_STATE.md` records TASK-024 as review and the next step as TASK-025.
- Required checks pass.
