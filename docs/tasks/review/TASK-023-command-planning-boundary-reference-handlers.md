# TASK-023 - Command Planning Boundary/Reference Handlers

## ID

TASK-023

## Title

Command Planning Boundary/Reference Handlers

## Milestone

M2C - Transaction Pipeline Preparation

## Status

REVIEW

## Priority

P0

## Objective

Implement a narrow, deterministic Command planning boundary for neutral test commands. The planner
validates command envelopes, evaluates preconditions, and produces ordered unconfirmed Effect plans
without committing state or introducing transaction, event, save, or runtime pipeline behavior.

## Context

TASK-016 established shared JSON-safe and canonical serialization utilities. TASK-017 established
the Entity Identity validator. TASK-018 established the Schema Versioning compatibility helper.
TASK-019 established the Engine State validator. TASK-020 established the Validation Diagnostic
adapter/core model. TASK-021 established the readonly Condition evaluator. TASK-022 established the
deterministic Effect applicator. TASK-023 applies the Command planning boundary above those
primitives.

## Authoritative Inputs

- `PROJECT_CHARTER.md`
- `AGENTS.md`
- `docs/spec/MASTER_SPEC.md`
- `docs/roadmap/ROADMAP.md`
- `docs/status/CURRENT_STATE.md`
- `docs/contracts/COMMAND_CONTRACT.md`
- `docs/contracts/CONDITION_CONTRACT.md`
- `docs/contracts/EFFECT_CONTRACT.md`
- `docs/contracts/VALIDATION_DIAGNOSTIC_CONTRACT.md`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`
- `docs/planning/M2_IMPLEMENTATION_SEQUENCE.md`
- `docs/planning/M2_RUNTIME_BOUNDARIES.md`
- `docs/handoffs/TASK-022-HANDOFF.md`
- `docs/tasks/done/TASK-016-shared-json-safe-canonical-serialization-utilities.md`
- `docs/tasks/done/TASK-017-entity-identity-validator.md`
- `docs/tasks/done/TASK-018-schema-versioning-compatibility-helper.md`
- `docs/tasks/done/TASK-019-engine-state-shape-and-snapshot-validator.md`
- `docs/tasks/done/TASK-020-validation-diagnostic-adapter-core-model.md`
- `docs/tasks/done/TASK-021-condition-evaluator.md`
- `docs/tasks/done/TASK-022-effect-applicator.md`

## Scope

- Validate Command envelopes and operands according to the contract.
- Produce deterministic effect plans for supported neutral reference commands.
- Evaluate preconditions with the Condition evaluator.
- Validate planned effects without committing state.
- Preserve input immutability and fail closed on invalid command, precondition, target, or payload
  data.
- Return a command plan plus stable diagnostics for accepted, rejected, duplicate, and error
  outcomes.
- Add focused tests for valid and invalid commands, preconditions, deterministic planning,
  diagnostics, and no side effects outside planning.

## Explicit Out of Scope

- Transaction Manager.
- Commit or rollback.
- Revision conflict resolution beyond planning diagnostics.
- Domain Event materializer.
- Event Store.
- Save system.
- Persistence implementation.
- UI or editor work.
- Gameplay/P0 content.
- Plugin runtime.
- Any new general-purpose command bus or registry.

## Acceptance Criteria

- Supported neutral commands plan deterministically.
- Invalid shapes, preconditions, targets, operators, and non-JSON payloads are rejected.
- Preconditions are evaluated through the Condition evaluator and false preconditions are reported
  as rejected.
- Planned effects are ordered, validated, and never committed.
- Candidate command and state inputs remain isolated from mutation.
- Tests cover direct planning, precondition handling, duplicate handling, deterministic output, and
  no mutation.

## Mandatory Outputs

- `packages/engine-kernel/**`
- `tests/**`
- `docs/handoffs/TASK-023-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`

## Allowed Changes

- `docs/tasks/active/TASK-023-command-planning-boundary-reference-handlers.md`
- `docs/tasks/review/TASK-023-command-planning-boundary-reference-handlers.md`
- `docs/tasks/done/TASK-023-command-planning-boundary-reference-handlers.md`
- `docs/handoffs/TASK-023-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`
- `packages/engine-kernel/**`
- `packages/engine-contracts/**` only if shared contract exports are needed
- `tests/**`

## Forbidden Changes

- TASK-024 or later task files.
- Transaction, Domain Event, Event Store, Save, UI/editor, plugin runtime, or gameplay content.
- Migration runner behavior or persistence logic.
- Broad refactors outside the command planner and its direct dependencies.

## Risks

- Letting command planning drift into transaction orchestration.
- Reintroducing committed-state mutation through planning helpers.
- Coupling the planner to gameplay-specific handlers instead of neutral reference commands.
- Expanding the planner into a command bus or registry.

## Definition of Done

- TASK-023 has a deterministic production Command planning boundary and focused tests.
- The task is moved to `docs/tasks/review/` with status `REVIEW`.
- `docs/handoffs/TASK-023-HANDOFF.md` exists after implementation.
- `docs/status/CURRENT_STATE.md` records TASK-023 as review and the next step as review of TASK-023.
- Required checks pass.
