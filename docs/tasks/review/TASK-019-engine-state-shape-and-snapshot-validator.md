# TASK-019 - Engine State Shape and Snapshot Validator

## ID

TASK-019

## Title

Engine State Shape and Snapshot Validator

## Milestone

M2B - State Read/Write Primitives

## Status

REVIEW

## Priority

P0

## Objective

Implement the production validator for the Engine State Contract so later M2 tasks can validate
root snapshot shape, revision semantics, domain collections, and entity identity references without
introducing any condition, effect, transaction, save, or event pipeline logic.

## Context

TASK-016 established shared JSON-safe and canonical serialization utilities. TASK-017 established
the Entity Identity validator. TASK-018 established the Schema Versioning compatibility helper.
TASK-019 uses those foundations to validate the Engine State snapshot envelope and its declared
domains.

## Authoritative Inputs

- `PROJECT_CHARTER.md`
- `AGENTS.md`
- `docs/spec/MASTER_SPEC.md`
- `docs/roadmap/ROADMAP.md`
- `docs/status/CURRENT_STATE.md`
- `docs/contracts/ENGINE_STATE_CONTRACT.md`
- `docs/contracts/ENTITY_IDENTITY_CONTRACT.md`
- `docs/contracts/SCHEMA_VERSIONING_CONTRACT.md`
- `docs/contracts/VALIDATION_DIAGNOSTIC_CONTRACT.md`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`
- `docs/planning/M2_IMPLEMENTATION_SEQUENCE.md`
- `docs/planning/M2_RUNTIME_BOUNDARIES.md`
- `docs/handoffs/TASK-018-HANDOFF.md`
- `docs/tasks/done/TASK-016-shared-json-safe-canonical-serialization-utilities.md`
- `docs/tasks/done/TASK-017-entity-identity-validator.md`
- `docs/tasks/done/TASK-018-schema-versioning-compatibility-helper.md`

## Scope

- Validate Engine State snapshot structure.
- Validate root schema metadata and revision.
- Validate required domain collections and domain indexes.
- Validate entity identity references using TASK-017 validator and canonical Entity Identity IDs.
- Reject unsafe or non-JSON payloads using TASK-016 utilities.
- Produce stable diagnostics and deterministic results.
- Preserve input immutability.
- Add focused tests for valid and invalid snapshots.

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

- Valid minimal Engine State snapshots pass validation.
- Invalid root shape, schema metadata, revision, domain collections, and entity references produce
  deterministic diagnostics.
- JSON safety and forbidden-key issues are surfaced.
- Duplicate entity IDs and duplicate domain IDs are rejected.
- Validation does not mutate input.
- No migration, persistence, or runtime pipeline behavior is introduced.
- Tests cover valid and invalid snapshots, determinism, diagnostics paths, assertions, and input
  immutability.

## Mandatory Outputs

- `packages/engine-contracts/**`
- `tests/**`
- `docs/handoffs/TASK-019-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`

## Allowed Changes

- `docs/tasks/active/TASK-019-engine-state-shape-and-snapshot-validator.md`
- `docs/tasks/review/TASK-019-engine-state-shape-and-snapshot-validator.md`
- `docs/tasks/done/TASK-019-engine-state-shape-and-snapshot-validator.md`
- `docs/handoffs/TASK-019-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`
- `packages/engine-contracts/**`
- `tests/**`
- `packages/core/**` only if imports or public exports need to be consumed
- `tsconfig.json` and package references only if workspace wiring requires it

## Forbidden Changes

- TASK-020 or later task files.
- Condition, Effect, Command, Transaction, Domain Event, Save, Event Store, UI/editor, plugin
  runtime, or gameplay content.
- Migration runner behavior or persistence logic.
- Broad refactors outside the validator and its direct dependencies.

## Risks

- Growing this into a state store or transaction engine.
- Confusing snapshot shape validation with runtime mutation logic.
- Accepting non-canonical entity references.
- Missing the contract boundary between state data and future pipeline logic.

## Definition of Done

- TASK-019 has a production Engine State validator, focused tests, and validated boundary-safe
  imports.
- The task is moved to `docs/tasks/review/` with status `REVIEW`.
- `docs/handoffs/TASK-019-HANDOFF.md` exists after implementation.
- `docs/status/CURRENT_STATE.md` records TASK-019 as review and the next step as TASK-020 planning
  or creation after acceptance.
- Required checks pass.
