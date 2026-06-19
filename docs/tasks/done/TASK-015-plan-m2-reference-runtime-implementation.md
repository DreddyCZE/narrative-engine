# TASK-015 - Plan M2 Reference Runtime Implementation

## ID

TASK-015

## Title

Plan M2 Reference Runtime Implementation

## Milestone

M2 - Reference Runtime Planning

## Status

DONE

## Priority

P0

## Objective

Prepare a precise, bounded implementation plan for the first M2 reference runtime work after the M1
Contract Foundation PASS. This is a planning task only and must not implement runtime behavior.

## Context

M1 closed the contract foundation for identity, schema versioning, engine state, condition, effect,
command, transaction, domain event, and validation diagnostic boundaries. M2 must start from those
contracts without turning the first implementation task into a full engine, UI, save system, event
store, plugin runtime, or gameplay slice.

## Authoritative Inputs

- `PROJECT_CHARTER.md`
- `AGENTS.md`
- `docs/spec/MASTER_SPEC.md`
- `docs/roadmap/ROADMAP.md`
- `docs/status/CURRENT_STATE.md`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`
- `docs/contracts/CONTRACT_VERSIONING_POLICY.md`
- M1 contract documents and schemas
- Handoffs and completed tasks TASK-004 through TASK-014
- `docs/reviews/M1_CONTRACT_FOUNDATION_REVIEW.md`
- `docs/reviews/M1_DEFERRED_DECISIONS_REGISTER.md`
- `docs/reviews/M1_CONTRACT_TRACEABILITY_MATRIX.md`

## Scope

- Define the first safe M2 implementation cut.
- Define the ordered sequence of future M2 implementation tasks.
- Define package and dependency boundaries for production runtime, contract support, schemas, tests,
  and test-support helpers.
- Define test oracle reuse policy.
- Recheck M1 deferred decisions against M2 sequencing.
- Define security, persistence, and UX/editor boundaries for the first reference runtime slice.
- Produce planning documents and a handoff.

## Explicit Out of Scope

- Production Condition Resolver.
- Production Effect Executor.
- Production Command Bus.
- Production Transaction Manager.
- Production Event Bus or Event Store.
- Production Save system or persistence.
- UI, editor, localization UI, visual editor fixtures, or gameplay/P0 content.
- Plugin runtime, networking, scheduler, telemetry pipeline, or localization runtime.
- New domain contracts or broad M1 contract refactors.

## Review Dimensions

- M1 contract alignment.
- Implementation sequence safety.
- Package boundary clarity.
- Engine/Data/UX separation.
- Test-support versus production-runtime separation.
- Security coverage and staged risk ownership.
- Save/persistence deferral.
- UX/editor deferral.
- Deferred-decision reopen triggers.

## Mandatory Outputs

- `docs/planning/M2_REFERENCE_RUNTIME_PLAN.md`
- `docs/planning/M2_IMPLEMENTATION_SEQUENCE.md`
- `docs/planning/M2_RUNTIME_BOUNDARIES.md`
- `docs/planning/M2_DEFERRED_DECISIONS_RECHECK.md`
- `docs/handoffs/TASK-015-HANDOFF.md`

## Acceptance Criteria

- The plan identifies the first safe M2 implementation task.
- Future task placeholders are ordered and scoped without creating task files for them.
- Package boundaries match the current repository structure.
- Test-support reuse rules prevent copying oracle helpers into production runtime by accident.
- Security, persistence, and UX/editor risks are assigned to future task stages.
- Deferred decisions are categorized by latest safe milestone and reopening trigger.
- No runtime implementation, UI, content, save, event store, registry runtime, or new contract is
  introduced.

## Allowed Changes

- `docs/tasks/ready/TASK-015-plan-m2-reference-runtime-implementation.md`
- `docs/tasks/active/TASK-015-plan-m2-reference-runtime-implementation.md`
- `docs/tasks/review/TASK-015-plan-m2-reference-runtime-implementation.md`
- `docs/tasks/done/TASK-015-plan-m2-reference-runtime-implementation.md`
- `docs/planning/**`
- `docs/handoffs/TASK-015-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`

## Forbidden Changes

- Runtime source behavior.
- Production package implementation.
- Tests except if needed to validate documentation tooling.
- Schemas or public contracts, unless a true blocker is found and explicitly documented first.
- New task files for the proposed M2 implementation sequence.
- Game data, UI, editor, registry runtime, Event Store, Save, telemetry, localization, scheduler,
  plugin, networking, or persistence changes.

## Risks

- Accidentally treating M1 test oracles as production implementations.
- Starting a monolithic runtime instead of a vertical slice.
- Pulling Save, Event Store, plugin, UI, or gameplay scope into the first M2 tasks.
- Letting package dependencies invert so runtime imports tests, docs, fixtures, or authoring data.
- Missing a deferred M1 decision that should gate transaction or event materialization work.

## Definition of Done

- TASK-015 is moved to `docs/tasks/done/` with status `DONE`.
- Required planning documents and handoff exist.
- `docs/status/CURRENT_STATE.md` records no ACTIVE task after handoff.
- Outcome is one of `READY_FOR_M2A`, `CONDITIONAL_READY`, or `NOT_READY`.
- Required checks pass or any blocker is documented.
- No commit is created.
