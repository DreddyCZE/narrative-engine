# TASK-017 - Entity Identity Validator

## ID

TASK-017

## Title

Entity Identity Validator

## Milestone

M2A - Shared Foundations

## Status

DONE

## Priority

P0

## Objective

Implement the production validator for the Entity Identity Contract using the shared JSON-safe and
canonical utilities established by TASK-016.

## Context

TASK-016 completed the shared foundation for JSON-safe inspection, forbidden-key rejection,
canonical serialization, and stable JSON path formatting. TASK-017 uses that foundation to
validate the actual Entity Identity Contract shape and reject invalid identity records before later
M2 runtime tasks rely on them.

## Authoritative Inputs

- `PROJECT_CHARTER.md`
- `AGENTS.md`
- `docs/spec/MASTER_SPEC.md`
- `docs/roadmap/ROADMAP.md`
- `docs/status/CURRENT_STATE.md`
- `docs/contracts/ENTITY_IDENTITY_CONTRACT.md`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`
- `docs/planning/M2_IMPLEMENTATION_SEQUENCE.md`
- `docs/planning/M2_RUNTIME_BOUNDARIES.md`
- `docs/handoffs/TASK-016-HANDOFF.md`
- `docs/tasks/done/TASK-016-shared-json-safe-canonical-serialization-utilities.md`

## Scope

- Validate Entity Identity contract shape.
- Validate canonical `id`, `entityType`, `namespace`, and `schemaVersion` rules.
- Validate optional `tags`, `aliases`, `provenance`, and `change` blocks as defined by the
  contract.
- Reject unsafe and non-JSON identity payloads through TASK-016 utilities.
- Return deterministic diagnostics with stable paths.
- Provide assertion and type-guard helpers for valid identity records.

## Explicit Out of Scope

- Schema Versioning compatibility helper.
- Engine State validator.
- Condition evaluator.
- Effect applicator.
- Command handling or Command Bus.
- Transaction Manager.
- Domain Event materializer.
- Save or Event Store persistence.
- UI or editor work.
- Gameplay/P0 content.
- Plugin runtime.
- Any new contract.

## Acceptance Criteria

- Valid minimal identity passes.
- Invalid identity shape and field values produce deterministic issues.
- Forbidden keys and non-JSON values are rejected.
- Diagnostics use stable JSON paths.
- Validation does not mutate input.
- Tests cover valid, invalid, and unsafe cases.

## Mandatory Outputs

- `packages/engine-contracts/**`
- `tests/**`
- `docs/handoffs/TASK-017-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`

## Allowed Changes

- `docs/tasks/active/TASK-017-entity-identity-validator.md`
- `docs/tasks/review/TASK-017-entity-identity-validator.md`
- `docs/tasks/done/TASK-017-entity-identity-validator.md`
- `docs/handoffs/TASK-017-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`
- `packages/engine-contracts/**`
- `tests/**`
- `packages/core/**` only if imports or public exports need to be consumed
- `tsconfig.json` and package references only if workspace wiring requires it

## Forbidden Changes

- TASK-018 or later task files.
- Engine State, Condition, Effect, Command, Transaction, Domain Event, Save, Event Store,
  UI/editor, plugin runtime, or gameplay content.
- Broad refactors outside the validator and its direct dependencies.

## Risks

- Turning identity validation into a registry or migration system.
- Diverging from the Entity Identity Contract's canonical shape.
- Allowing unknown fields or invalid aliases to leak through.
- Breaking package boundaries while consuming TASK-016 utilities.

## Definition of Done

- TASK-017 has a production validator, focused tests, and validated boundary-safe imports.
- The task is moved to `docs/tasks/done/` with status `DONE`.
- `docs/handoffs/TASK-017-HANDOFF.md` exists after implementation.
- `docs/status/CURRENT_STATE.md` records TASK-017 as done and the next step as TASK-018
  creation after acceptance.
- Required checks pass.
