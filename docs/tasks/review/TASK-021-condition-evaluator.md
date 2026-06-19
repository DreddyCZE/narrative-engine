# TASK-021 - Condition Evaluator

## ID

TASK-021

## Title

Condition Evaluator

## Milestone

M2B - State Read/Write Primitives

## Status

REVIEW

## Priority

P0

## Objective

Implement a readonly production evaluator for the Condition Contract so contract consumers can
deterministically evaluate declarative conditions against committed Engine State snapshots without
introducing effect, command, transaction, or runtime pipeline behavior.

## Context

TASK-016 established shared JSON-safe and canonical serialization utilities. TASK-017 established
the Entity Identity validator. TASK-018 established the Schema Versioning compatibility helper.
TASK-019 established the Engine State validator. TASK-020 established the Validation Diagnostic
adapter/core model. TASK-021 evaluates Condition data against readonly Engine State and the explicit
evaluation context.

## Authoritative Inputs

- `PROJECT_CHARTER.md`
- `AGENTS.md`
- `docs/spec/MASTER_SPEC.md`
- `docs/roadmap/ROADMAP.md`
- `docs/status/CURRENT_STATE.md`
- `docs/contracts/CONDITION_CONTRACT.md`
- `docs/contracts/ENGINE_STATE_CONTRACT.md`
- `docs/contracts/VALIDATION_DIAGNOSTIC_CONTRACT.md`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`
- `docs/planning/M2_IMPLEMENTATION_SEQUENCE.md`
- `docs/planning/M2_RUNTIME_BOUNDARIES.md`
- `docs/handoffs/TASK-020-HANDOFF.md`
- `docs/tasks/done/TASK-016-shared-json-safe-canonical-serialization-utilities.md`
- `docs/tasks/done/TASK-017-entity-identity-validator.md`
- `docs/tasks/done/TASK-018-schema-versioning-compatibility-helper.md`
- `docs/tasks/done/TASK-019-engine-state-shape-and-snapshot-validator.md`
- `docs/tasks/done/TASK-020-validation-diagnostic-adapter-core-model.md`

## Scope

- Validate Condition envelopes and operands according to the contract.
- Evaluate supported operators over readonly committed Engine State snapshots.
- Support deterministic `all`, `any`, `not`, `constant`, `exists`, `compare`, `contains`,
  `entity-is`, `domain-exists`, and `condition-ref` behavior where contract support permits.
- Use JSON-safe and contract validators for input rejection and diagnostics.
- Preserve input immutability and fail closed on invalid state, selector, or operand data.
- Add focused tests for valid and invalid conditions, supported operators, diagnostics,
  determinism, and no side effects.

## Explicit Out of Scope

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

- Supported conditions evaluate deterministically against readonly committed state.
- Invalid shapes, paths, operators, selectors, and non-JSON payloads are rejected.
- `all`, `any`, and `not` obey contract short-circuit and error propagation behavior.
- Named condition references are deterministic and fail closed when unresolved or cyclic.
- Tests cover direct evaluation, operand validation, state selection, context handling, and no
  mutation.

## Mandatory Outputs

- `packages/engine-contracts/**`
- `tests/**`
- `docs/handoffs/TASK-021-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`

## Allowed Changes

- `docs/tasks/active/TASK-021-condition-evaluator.md`
- `docs/tasks/review/TASK-021-condition-evaluator.md`
- `docs/tasks/done/TASK-021-condition-evaluator.md`
- `docs/handoffs/TASK-021-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`
- `packages/engine-contracts/**`
- `tests/**`
- `packages/core/**` only if shared JSON-safe helpers need additional public exports
- `tsconfig.json` and package references only if workspace wiring requires it

## Forbidden Changes

- TASK-022 or later task files.
- Effect, Command, Transaction, Domain Event, Save, Event Store, UI/editor, plugin runtime, or
  gameplay content.
- Migration runner behavior or persistence logic.
- Broad refactors outside the evaluator and its direct dependencies.

## Risks

- Letting condition logic drift away from the contract test oracle.
- Introducing runtime pipeline behavior through condition references or evaluation context.
- Reintroducing non-JSON values or unsafe object keys through operands or context.
- Expanding evaluator scope beyond the contract-defined read-only semantics.

## Definition of Done

- TASK-021 has a production readonly condition evaluator and focused tests.
- The task is moved to `docs/tasks/review/` with status `REVIEW`.
- `docs/handoffs/TASK-021-HANDOFF.md` exists after implementation.
- `docs/status/CURRENT_STATE.md` records TASK-021 as review and the next step as TASK-022
  creation after acceptance.
- Required checks pass.
