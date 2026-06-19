# TASK-018 - Schema Versioning Compatibility Helper

## ID

TASK-018

## Title

Schema Versioning Compatibility Helper

## Milestone

M2A - Shared Foundations

## Status

DONE

## Priority

P0

## Objective

Implement the production helper for the Schema Versioning Contract so later M2 tasks can validate
schema descriptors, compare versions, and derive compatibility outcomes without introducing a
migration runner or persistence layer.

## Context

TASK-016 established shared JSON-safe and canonical serialization utilities. TASK-017 established
the Entity Identity validator. TASK-018 uses those foundations to validate schema versioning
descriptors and determine reader compatibility for schema-bearing data.

## Authoritative Inputs

- `PROJECT_CHARTER.md`
- `AGENTS.md`
- `docs/spec/MASTER_SPEC.md`
- `docs/roadmap/ROADMAP.md`
- `docs/status/CURRENT_STATE.md`
- `docs/contracts/SCHEMA_VERSIONING_CONTRACT.md`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`
- `docs/planning/M2_IMPLEMENTATION_SEQUENCE.md`
- `docs/planning/M2_RUNTIME_BOUNDARIES.md`
- `docs/handoffs/TASK-017-HANDOFF.md`
- `docs/tasks/done/TASK-017-entity-identity-validator.md`

## Scope

- Parse and validate schema versioning descriptor shape.
- Compare schema versions deterministically.
- Derive compatibility outcomes from reader support, writer version, and migration metadata.
- Produce stable diagnostics for invalid schema descriptors and incompatible versions.
- Reuse TASK-016 JSON-safe and canonical helpers where appropriate.

## Explicit Out of Scope

- Engine State validator.
- Save migration.
- Persistence or save format implementation.
- Condition evaluator.
- Effect applicator.
- Command handling or Transaction Manager.
- Domain Event materializer.
- Event Store.
- UI or editor work.
- Gameplay/P0 content.
- Plugin runtime.
- Any new contract.

## Acceptance Criteria

- Valid schema descriptors are accepted.
- Invalid version inputs and malformed descriptors produce deterministic diagnostics.
- Compatibility outcomes cover exact, readable, migration-required, unsupported-newer,
  unsupported-older, invalid-version, and missing-schema cases.
- No migration execution or persistence is introduced.
- Validation does not mutate input.
- Tests cover valid and invalid descriptors, compatibility outcomes, and deterministic behavior.

## Mandatory Outputs

- `packages/engine-contracts/**`
- `tests/**`
- `docs/handoffs/TASK-018-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`

## Allowed Changes

- `docs/tasks/active/TASK-018-schema-versioning-compatibility-helper.md`
- `docs/tasks/review/TASK-018-schema-versioning-compatibility-helper.md`
- `docs/tasks/done/TASK-018-schema-versioning-compatibility-helper.md`
- `docs/handoffs/TASK-018-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`
- `packages/engine-contracts/**`
- `tests/**`
- `packages/core/**` only if imports or public exports need to be consumed
- `tsconfig.json` and package references only if workspace wiring requires it

## Forbidden Changes

- TASK-019 or later task files.
- Engine State, Condition, Effect, Command, Transaction, Domain Event, Save, Event Store,
  UI/editor, plugin runtime, or gameplay content.
- Migration runner behavior or persistence logic.
- Broad refactors outside the helper and its direct dependencies.

## Risks

- Drifting into a schema registry or migration engine.
- Misclassifying compatibility outcomes when migration metadata is present.
- Diverging from the Schema Versioning Contract priority order.
- Breaking package boundaries while consuming TASK-016 utilities.

## Definition of Done

- TASK-018 has a production schema versioning helper, focused tests, and validated
  boundary-safe imports.
- The task is moved to `docs/tasks/review/` with status `REVIEW`.
- `docs/handoffs/TASK-018-HANDOFF.md` exists after implementation.
- `docs/status/CURRENT_STATE.md` records TASK-018 as review and the next step as TASK-019
  planning or creation after acceptance.
- Required checks pass.
