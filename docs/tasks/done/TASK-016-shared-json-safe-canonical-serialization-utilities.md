# TASK-016 - Shared JSON-safe and Canonical Serialization Utilities

## ID

TASK-016

## Title

Shared JSON-safe and Canonical Serialization Utilities

## Milestone

M2A - Shared Foundations

## Status

DONE

## Priority

P0

## Objective

Implement the shared production foundation for JSON-safe value inspection, forbidden-key rejection,
prototype-pollution protection, canonical JSON serialization, and stable JSON path formatting used
by later M2 runtime tasks.

## Context

TASK-015 established the M2 reference runtime plan and confirmed that the first safe M2 task is a
shared foundation task. TASK-016 must stay narrow and must not implement Entity Identity, Schema
Versioning, Engine State, Condition, Effect, Command, Transaction, Domain Event, Save, Event Store,
UI, editor, plugin, or gameplay behavior.

## Authoritative Inputs

- `PROJECT_CHARTER.md`
- `AGENTS.md`
- `docs/spec/MASTER_SPEC.md`
- `docs/roadmap/ROADMAP.md`
- `docs/status/CURRENT_STATE.md`
- `docs/planning/M2_REFERENCE_RUNTIME_PLAN.md`
- `docs/planning/M2_IMPLEMENTATION_SEQUENCE.md`
- `docs/planning/M2_RUNTIME_BOUNDARIES.md`
- `docs/planning/M2_DEFERRED_DECISIONS_RECHECK.md`
- `docs/handoffs/TASK-015-HANDOFF.md`
- `docs/tasks/done/TASK-015-plan-m2-reference-runtime-implementation.md`

## Scope

- Implement JSON-safe value inspection and assertion helpers.
- Reject forbidden object keys and prototype-pollution vectors.
- Reject cyclic values and non-JSON host objects.
- Canonicalize JSON-safe values with stable object-key ordering.
- Provide a stable path formatting helper for diagnostics.
- Add focused tests and minimal boundary/documentation updates needed for the new package.

## Explicit Out of Scope

- Entity Identity validator.
- Schema Versioning compatibility helper.
- Engine State validator.
- Condition evaluator.
- Effect applicator.
- Command planning boundary or Command Bus.
- Transaction Manager.
- Domain Event materializer.
- Save system.
- Event Store.
- UI or editor work.
- Gameplay/P0 content.
- Plugin runtime.
- Telemetry.
- Localization.

## Acceptance Criteria

- Shared utilities detect and reject JSON-unsafe values.
- Canonical serialization is deterministic and stable for equivalent data.
- Forbidden keys are rejected before canonicalization.
- Path formatting is stable and suitable for diagnostics.
- Tests cover primitive, nested, forbidden-key, cyclic, depth, node, and canonicalization cases.
- No other M2 runtime task is implemented.

## Mandatory Outputs

- `packages/core/**`
- `tests/core/**`
- `docs/handoffs/TASK-016-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`

## Allowed Changes

- `docs/tasks/active/TASK-016-shared-json-safe-canonical-serialization-utilities.md`
- `docs/tasks/review/TASK-016-shared-json-safe-canonical-serialization-utilities.md`
- `docs/tasks/done/TASK-016-shared-json-safe-canonical-serialization-utilities.md`
- `docs/handoffs/TASK-016-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`
- `packages/core/**`
- `tests/core/**`
- `tsconfig.json`
- `package.json` only if workspace references require it

## Forbidden Changes

- Any runtime pipeline beyond shared JSON-safe utilities.
- Any task file other than TASK-016.
- Any game content or UI/editor code.
- Any Event Store, Save, plugin, telemetry, or localization runtime.
- Broad refactors of existing M1/M2 planning documents.

## Risks

- Overfitting the shared utilities into a mini-framework.
- Accidentally introducing identity, state, or transaction semantics.
- Letting the new package import docs, tests, or fixtures at runtime.
- Missing class-instance or non-JSON edge cases.

## Definition of Done

- TASK-016 is moved to `docs/tasks/done/` with status `DONE`.
- `docs/handoffs/TASK-016-HANDOFF.md` exists and records acceptance.
- `docs/status/CURRENT_STATE.md` records TASK-016 as done and the next step as TASK-017 creation.
- Required checks pass.
- No runtime implementation beyond the shared JSON-safe utilities was introduced.
