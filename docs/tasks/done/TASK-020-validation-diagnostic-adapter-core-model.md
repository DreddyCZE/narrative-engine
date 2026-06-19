# TASK-020 - Validation Diagnostic Adapter/Core Model

## ID

TASK-020

## Title

Validation Diagnostic Adapter/Core Model

## Milestone

M2A/M2B - Shared Diagnostic Foundation

## Status

DONE

## Priority

P0

## Objective

Implement the shared production diagnostic model and adapter layer used by contract validators so
future M2 tasks can emit stable, JSON-safe, contract-aligned diagnostics without introducing
runtime pipeline behavior.

## Context

TASK-016 established shared JSON-safe and canonical serialization utilities. TASK-017 established
the Entity Identity validator. TASK-018 established the Schema Versioning compatibility helper.
TASK-019 established the Engine State validator. TASK-020 unifies the diagnostic envelope and
adapter boundary those validators emit.

## Authoritative Inputs

- `PROJECT_CHARTER.md`
- `AGENTS.md`
- `docs/spec/MASTER_SPEC.md`
- `docs/roadmap/ROADMAP.md`
- `docs/status/CURRENT_STATE.md`
- `docs/contracts/VALIDATION_DIAGNOSTIC_CONTRACT.md`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`
- `docs/planning/M2_IMPLEMENTATION_SEQUENCE.md`
- `docs/planning/M2_RUNTIME_BOUNDARIES.md`
- `docs/handoffs/TASK-019-HANDOFF.md`
- `docs/handoffs/TASK-015-HANDOFF.md`
- `docs/tasks/done/TASK-016-shared-json-safe-canonical-serialization-utilities.md`
- `docs/tasks/done/TASK-017-entity-identity-validator.md`
- `docs/tasks/done/TASK-018-schema-versioning-compatibility-helper.md`
- `docs/tasks/done/TASK-019-engine-state-shape-and-snapshot-validator.md`

## Scope

- Define a stable validation diagnostic core model.
- Support severity, code, path, message, and optional source/details metadata where the contract
  allows it.
- Provide helpers to create, normalize, sort, and format diagnostics deterministically.
- Provide adapters from JSON safety, Entity Identity, Schema Versioning, and Engine State issues
  where appropriate.
- Preserve JSON safety and input immutability.
- Add focused tests for valid and invalid diagnostics, deterministic ordering, and adapter
  behavior.

## Explicit Out of Scope

- Condition evaluator.
- Effect applicator.
- Command handling.
- Transaction Manager.
- Domain Event materializer.
- Event Store.
- Save system.
- Persistence implementation.
- UI or editor work.
- Gameplay/P0 content.
- Plugin runtime.
- Any new contract.

## Acceptance Criteria

- Diagnostic envelopes are deterministic and JSON-safe.
- Invalid code, severity, path, and details values are rejected.
- Normalization and sorting are stable.
- Adapter helpers preserve input immutability and do not introduce runtime pipeline behavior.
- Tests cover direct diagnostic creation, normalization, adapters, and defensive rejection cases.

## Mandatory Outputs

- `packages/engine-contracts/**`
- `tests/**`
- `docs/handoffs/TASK-020-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`

## Allowed Changes

- `docs/tasks/active/TASK-020-validation-diagnostic-adapter-core-model.md`
- `docs/tasks/review/TASK-020-validation-diagnostic-adapter-core-model.md`
- `docs/tasks/done/TASK-020-validation-diagnostic-adapter-core-model.md`
- `docs/handoffs/TASK-020-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`
- `packages/engine-contracts/**`
- `tests/**`
- `packages/core/**` only if shared JSON-safe helpers need additional public exports
- `tsconfig.json` and package references only if workspace wiring requires it

## Forbidden Changes

- TASK-021 or later task files.
- Condition, Effect, Command, Transaction, Domain Event, Save, Event Store, UI/editor, plugin
  runtime, or gameplay content.
- Migration runner behavior or persistence logic.
- Broad refactors outside the adapter and its direct dependencies.

## Risks

- Letting diagnostic shaping drift away from the contract inventory.
- Turning the adapter into a logging or telemetry layer.
- Reintroducing non-JSON payloads through details or source metadata.
- Allowing runtime pipeline concerns to leak into a shared diagnostic boundary.

## Definition of Done

- TASK-020 has a production validation diagnostic model and focused tests.
- The task is moved to `docs/tasks/done/` with status `DONE`.
- `docs/handoffs/TASK-020-HANDOFF.md` exists after implementation.
- `docs/status/CURRENT_STATE.md` records TASK-020 as done and the next step as TASK-021 creation
  after acceptance.
- Required checks pass.
