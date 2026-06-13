# TASK-007 - Design Condition Contract

## ID

TASK-007

## Title

Design Condition Contract

## Milestone

M1 - Core Foundation

## Status

DONE

## Priority

P1

## Objective

Design a public, versioned, deterministic Condition Contract that reads committed Engine State and returns
boolean results or explicit errors without mutating state or invoking executable code.

## Context

Condition is the declarative gate for dialog options, actions, portals, scene transitions, quests,
event activation, command preconditions, content filtering, and editor preview. The contract must stay
data-only and must be safe for future resolver implementations.

## Authoritative References

- `PROJECT_CHARTER.md`
- `AGENTS.md`
- `docs/spec/MASTER_SPEC.md`
- `docs/roadmap/ROADMAP.md`
- `docs/contracts/ENTITY_IDENTITY_CONTRACT.md`
- `docs/contracts/SCHEMA_VERSIONING_CONTRACT.md`
- `docs/contracts/ENGINE_STATE_CONTRACT.md`
- `schemas/entity-identity.schema.json`
- `schemas/schema-versioning.schema.json`
- `schemas/engine-state.schema.json`

## Dependencies

- TASK-004 - Design Entity Identity Contract
- TASK-005 - Design Schema Versioning Contract
- TASK-006 - Design Engine State Contract

## Scope

- Define a deterministic, data-only Condition Contract.
- Define the condition envelope, operand model, selector model, comparison rules, and diagnostics.
- Define fail-closed evaluation semantics and explain/debug behavior.
- Define canonical serialization, evaluation budgets, and registry boundaries.
- Provide contract documentation, schema, fixtures, tests, inventory updates, and a handoff.

## Out of Scope

- Production Condition Resolver implementation.
- Effect Executor, Command pipeline, Transaction pipeline, dialog runtime, quest runtime, or scripting language.
- Runtime registry, plugin capability system, or access-control implementation.
- Any game-specific condition semantics.

## Acceptance Criteria

- The contract document defines the evaluation result model, fail-closed behavior, envelope, composition,
  atomics, operands, selectors, context, comparison rules, reference policy, diagnostics, determinism,
  security, canonical serialization, budgets, and deferred decisions.
- The schema validates the declared condition envelope and discriminated condition forms.
- Valid fixtures, invalid fixtures, and semantic-invalid fixtures exist and are exercised by tests.
- Tests prove deterministic evaluation, explicit errors, selector safety, reference acyclicity, and
  regression compatibility with Entity Identity, Schema Versioning, and Engine State contracts.
- The task ends with no additional ACTIVE task and a handoff that records the design decisions.

## Required Tests and Fixtures

- Valid fixtures for constant, exists, comparison, entity reference equality, composition, and optional
  named/referenced condition usage.
- Invalid fixtures for unknown condition type, missing or invalid schemaVersion, invalid selector, invalid
  operator, mixed-type comparison, unknown field, over-budget shape, executable source, invalid entity
  reference, and invalid context selector.
- Semantic-invalid fixtures for missing domain, missing path, type mismatch, unsupported schema version,
  reference cycle, dangling reference, access denied, budget exceeded, non-deterministic context, and alias
  reference.
- Tests for fail-closed resolution, diagnostic distinction from false, short-circuit determinism, path safety,
  and canonical serialization idempotence.

## Allowed Files

- `docs/contracts/CONDITION_CONTRACT.md`
- `schemas/condition.schema.json`
- `tests/condition-contract.test.ts`
- `tests/fixtures/contracts/condition/**`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-007-design-condition-contract.md`
- `docs/handoffs/TASK-007-HANDOFF.md`

## Forbidden Changes

- Runtime Condition Resolver implementation.
- Production evaluator, scripting engine, dialog runtime, or effect pipeline.
- Engine State, Schema Versioning, or Entity Identity contract semantics unless a real conflict is found.
- Save Contract, Command Contract, Effect Contract, or any unrelated subsystem.

## Risks

- Overly permissive selectors could leak internal state.
- Treating evaluation errors as false would create unsafe fail-open behavior.
- Referenced conditions can introduce cycles or dangling references if not constrained.
- A broad type surface can make the first contract harder to stabilize.

## Compatibility Impact

- Breaking changes require a new Condition Contract version and updated schema/fixtures.
- Adding new condition types or selector forms must preserve fail-closed semantics.
- Existing canonical condition IDs must not be silently repurposed.

## Output Artifacts

- Condition contract document.
- Condition JSON Schema.
- Contract fixtures.
- Contract tests.
- Updated inventory and current state.
- Handoff for TASK-007.

## Definition of Done

- All acceptance criteria are met.
- Required checks pass.
- TASK-007 is represented in `docs/tasks/done/` with status `DONE`.
- The handoff documents the contract decisions and known limits.
