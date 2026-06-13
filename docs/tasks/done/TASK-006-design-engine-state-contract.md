# TASK-006 - Design Engine State Contract

## ID

TASK-006

## Title

Design Engine State Contract

## Milestone

M1 - Core Foundation

## Status

DONE

## Priority

P1

## Objective

Define the public, versioned Engine State Contract that establishes the authoritative runtime state
model, its root envelope, domain structure, persistence profiles, revision policy, validation
layers, and deterministic serialization boundaries for future runtime, transaction, and save
contracts.

## Context

TASK-004 established Entity Identity as the stable identity envelope. TASK-005 established Schema
Versioning as the shared rule set for versioned serialized shapes. TASK-006 must now define the
authoritative Engine State boundary on top of those two contracts without implementing a runtime
State Store, mutational pipeline, or save system.

## Authoritative References

- `PROJECT_CHARTER.md`
- `AGENTS.md`
- `docs/spec/MASTER_SPEC.md`
- `docs/roadmap/ROADMAP.md`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`
- `docs/contracts/CONTRACT_VERSIONING_POLICY.md`
- `docs/contracts/ENTITY_IDENTITY_CONTRACT.md`
- `docs/contracts/SCHEMA_VERSIONING_CONTRACT.md`
- `schemas/entity-identity.schema.json`
- `schemas/schema-versioning.schema.json`
- `docs/handoffs/TASK-004-HANDOFF.md`
- `docs/handoffs/TASK-005-HANDOFF.md`

## Dependencies

- TASK-004 - Design Entity Identity Contract: DONE.
- TASK-005 - Design Schema Versioning Contract: DONE.

## Scope

- Define what Engine State is authoritative and what is derived, transient, session-only, or meta.
- Define the root state envelope and its relation to Entity Identity and Schema Versioning.
- Define runtime state, run state, meta state, session state, and derived state boundaries.
- Define state domains/namespaces, ownership, persistence profiles, authority model, and domain
  descriptors.
- Define revision policy and optimistic concurrency expectations for future commands and
  transactions.
- Define state references, canonical serialization, validation layers, and security boundaries.
- Add JSON Schema for the root envelope and state domain descriptors.
- Add fixtures and contract tests proving the declared rules.
- Update only directly related governance status and contract inventory documents.

## Out of Scope

- Runtime State Store implementation.
- Condition Resolver implementation.
- Effect Executor implementation.
- Command pipeline implementation.
- Transaction engine implementation.
- Save system implementation.
- View Model implementation.
- Plugin permission system.
- Any concrete gameplay system implementation.
- Any concrete game data implementation.

## Acceptance Criteria

- `docs/contracts/ENGINE_STATE_CONTRACT.md` defines the public draft contract with status,
  contract ID, contract version, owner, purpose, terminology, state taxonomy, root envelope, state
  domains, persistence profiles, authority model, value model, equality model, revision policy,
  reference policy, initialization policy, mutation boundary, snapshot lifecycle, validation
  layers, error categories, determinism, security considerations, performance considerations,
  examples, known limits, and deferred decisions.
- `schemas/engine-state.schema.json` validates the canonical root envelope and state domain
  descriptors with stable `$schema`, `$id`, `additionalProperties: false`, version fields, domain
  IDs, persistence profiles, authority values, and JSON-safe data.
- Fixtures under `tests/fixtures/contracts/engine-state/` include the valid, invalid, and
  semantic-invalid cases required by the task.
- `tests/engine-state-contract.test.ts` proves real contract rules, including fixture validity,
  revision behavior, canonical ordering, non-JSON rejection, forbidden key rejection, entity
  reference behavior, state domain uniqueness, stable serialization, and regressions against the
  Entity Identity and Schema Versioning contracts.
- `CONTRACT_INVENTORY.md` updates only the Engine State Contract entry to reference the new draft
  artifacts and status.
- No runtime State Store, pipeline, or save implementation is added.
- TASK-006 ends in `DONE`, with no ACTIVE task left.

## Required Tests and Fixtures

Valid fixtures:

- minimal empty state
- state with one core domain
- state with a game-owned domain
- state with a module-owned domain
- state with run and meta data
- state with revision `0`
- state with canonical entity reference
- deterministically sorted domains

Invalid fixtures:

- negative revision
- decimal revision
- invalid schemaVersion
- duplicate domainId
- invalid domainId
- unknown persistence profile
- unknown authority value
- executable or non-JSON value in test representation
- forbidden object key
- alias used as canonical runtime reference
- unknown field
- misordered domains when canonical order is required

Semantic-invalid fixtures:

- revision jump according to test history
- duplicate domain ownership conflict
- unsupported domain schemaVersion
- dangling reference
- missing required core domain
- invalid working-to-committed transition
- derived cache represented as authoritative state

## Allowed Files

- `docs/contracts/ENGINE_STATE_CONTRACT.md`
- `schemas/engine-state.schema.json`
- `tests/engine-state-contract.test.ts`
- `tests/fixtures/contracts/engine-state/**`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`, only if a real ordering error is found
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/active/TASK-006-design-engine-state-contract.md`
- `docs/tasks/review/TASK-006-design-engine-state-contract.md`
- `docs/handoffs/TASK-006-HANDOFF.md`
- Test-scoped support utilities, only if needed

## Forbidden Changes

- Do not create State Store, transaction engine, command pipeline, or save implementation.
- Do not create a plugin permission system.
- Do not change Entity Identity or Schema Versioning unless a concrete contradiction is found.
- Do not create a new ADR unless the work reveals a real architectural conflict.
- Do not start another task.
- Do not change Node, pnpm, workspace, or framework choices.

## Risks

- Confusing engine state with derived UI/session state.
- Treating the root envelope as a save envelope.
- Mixing runtime authority with authoring or client presentation concerns.
- Letting session-only data leak into authoritative runtime state.
- Overstating JSON Schema coverage for referential or semantic invariants.
- Expanding the contract into pipeline implementation instead of the state boundary.

## Migration Impact

The task defines the state model and its versioned serialization rules only. It does not migrate
existing data. Future incompatible state changes must follow `CONTRACT_VERSIONING_POLICY.md` and
this contract.

## Output Artifacts

- `docs/contracts/ENGINE_STATE_CONTRACT.md`
- `schemas/engine-state.schema.json`
- `tests/engine-state-contract.test.ts`
- `tests/fixtures/contracts/engine-state/**`
- Updated `docs/contracts/CONTRACT_INVENTORY.md`
- Updated `docs/status/CURRENT_STATE.md`
- `docs/handoffs/TASK-006-HANDOFF.md`

## Required Checks

- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm build`
- `corepack pnpm check:boundaries`
- `corepack pnpm validate`
- `git diff --check`

## Definition of Done

- All acceptance criteria are met.
- Required checks pass.
- TASK-006 is moved to `docs/tasks/done/` with status `DONE`.
- `docs/handoffs/TASK-006-HANDOFF.md` summarizes decisions, fixtures, tests, limits, and next step.
- `docs/status/CURRENT_STATE.md` records no ACTIVE task and recommends review of TASK-006.
- No commit is created.
