# TASK-022 - Effect Applicator

## ID

TASK-022

## Title

Effect Applicator

## Milestone

M2B - State Read/Write Primitives

## Status

REVIEW

## Priority

P0

## Objective

Implement a deterministic production Effect applicator for the Effect Contract so contract
consumers can apply declarative candidate-state changes against a candidate Engine State copy
without introducing command, transaction, event, save, or runtime pipeline behavior.

## Context

TASK-016 established shared JSON-safe and canonical serialization utilities. TASK-017 established
the Entity Identity validator. TASK-018 established the Schema Versioning compatibility helper.
TASK-019 established the Engine State validator. TASK-020 established the Validation Diagnostic
adapter/core model. TASK-021 established the readonly Condition evaluator. TASK-022 applies Effect
data to a candidate Engine State copy and returns stable diagnostics.

## Authoritative Inputs

- `PROJECT_CHARTER.md`
- `AGENTS.md`
- `docs/spec/MASTER_SPEC.md`
- `docs/roadmap/ROADMAP.md`
- `docs/status/CURRENT_STATE.md`
- `docs/contracts/EFFECT_CONTRACT.md`
- `docs/contracts/ENGINE_STATE_CONTRACT.md`
- `docs/contracts/VALIDATION_DIAGNOSTIC_CONTRACT.md`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`
- `docs/planning/M2_IMPLEMENTATION_SEQUENCE.md`
- `docs/planning/M2_RUNTIME_BOUNDARIES.md`
- `docs/handoffs/TASK-021-HANDOFF.md`
- `docs/tasks/done/TASK-016-shared-json-safe-canonical-serialization-utilities.md`
- `docs/tasks/done/TASK-017-entity-identity-validator.md`
- `docs/tasks/done/TASK-018-schema-versioning-compatibility-helper.md`
- `docs/tasks/done/TASK-019-engine-state-shape-and-snapshot-validator.md`
- `docs/tasks/done/TASK-020-validation-diagnostic-adapter-core-model.md`
- `docs/tasks/done/TASK-021-condition-evaluator.md`

## Scope

- Validate Effect envelopes and operands according to the contract.
- Apply supported effect operators to a candidate Engine State copy.
- Support deterministic `set`, `unset`, `increment`, `append`, `remove-at`, `add-unique`, and
  `remove-value` behavior where contract support permits.
- Use JSON-safe and contract validators for input rejection and diagnostics.
- Preserve input immutability and fail closed on invalid state, selector, target, or operand data.
- Return a candidate state copy plus stable diagnostics for applied, skipped, no-op, and error
  outcomes.
- Add focused tests for valid and invalid effects, supported operators, diagnostics, determinism,
  and no side effects outside candidate state application.

## Explicit Out of Scope

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

- Supported effects apply deterministically against candidate state copies.
- Invalid shapes, paths, operators, targets, and non-JSON payloads are rejected.
- `set`, `unset`, `increment`, `append`, `remove-at`, `add-unique`, and `remove-value` obey
  contract semantics and no-op policy.
- Candidate state copies remain isolated from the committed input state.
- Tests cover direct application, operand validation, path selection, no-op behavior, and no
  mutation.

## Mandatory Outputs

- `packages/engine-contracts/**`
- `tests/**`
- `docs/handoffs/TASK-022-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`

## Allowed Changes

- `docs/tasks/active/TASK-022-effect-applicator.md`
- `docs/tasks/review/TASK-022-effect-applicator.md`
- `docs/tasks/done/TASK-022-effect-applicator.md`
- `docs/handoffs/TASK-022-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`
- `packages/engine-contracts/**`
- `tests/**`
- `packages/core/**` only if shared JSON-safe helpers need additional public exports
- `tsconfig.json` and package references only if workspace wiring requires it

## Forbidden Changes

- TASK-023 or later task files.
- Command, Transaction, Domain Event, Save, Event Store, UI/editor, plugin runtime, or gameplay
  content.
- Migration runner behavior or persistence logic.
- Broad refactors outside the applicator and its direct dependencies.

## Risks

- Letting effect logic drift away from the contract test oracle.
- Introducing runtime pipeline behavior through guards or application context.
- Reintroducing non-JSON values or unsafe object keys through effect operands or candidate state.
- Expanding applicator scope beyond the contract-defined candidate-state semantics.

## Definition of Done

- TASK-022 has a production deterministic Effect applicator and focused tests.
- The task is moved to `docs/tasks/review/` with status `REVIEW`.
- `docs/handoffs/TASK-022-HANDOFF.md` exists after implementation.
- `docs/status/CURRENT_STATE.md` records TASK-022 as review and the next step as TASK-023
  creation after acceptance.
- Required checks pass.
