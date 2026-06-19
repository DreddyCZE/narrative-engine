# M2 Implementation Sequence

This document proposes future task placeholders only. It does not create those tasks and does not
start implementation work.

## Sequence Summary

1. `TASK-016` - Shared JSON-safe and canonical serialization utilities
2. `TASK-017` - Entity Identity validator
3. `TASK-018` - Schema Versioning compatibility helper
4. `TASK-019` - Engine State shape and snapshot validator
5. `TASK-020` - Validation Diagnostic adapter/core model
6. `TASK-021` - Condition evaluator
7. `TASK-022` - Effect applicator
8. `TASK-023` - Command planning boundary/reference handlers
9. `TASK-024` - Transaction Manager reference implementation
10. `TASK-025` - Domain Event materializer
11. `TASK-026` - Minimal end-to-end contract pipeline test
12. `TASK-027` - M2 gate review

## TASK-016 - Shared JSON-safe and Canonical Serialization Utilities

- Purpose: Implement shared JSON-safe value validation, forbidden-key checks, stable canonical
  serialization, and safe path helpers.
- Dependencies: M1 PASS; Entity Identity, Engine State, Effect, Command, Transaction, Domain Event,
  and Validation Diagnostic JSON-safe rules.
- Allowed files: `packages/engine-contracts/**`, `packages/validation/**` if needed,
  `tests/**`, `package.json` or TS config only if package wiring requires it.
- Forbidden files: UI, game data, save, Event Store, plugin, docs contracts except status/handoff.
- Acceptance criteria: rejects non-JSON values, cycles, forbidden keys, payload limit breaches, and
  produces stable canonical output.
- Tests: unit tests for object ordering, arrays, numbers, strings, forbidden keys, cycles, and
  stable snapshots.
- Risks: silently diverging from schema JSON value limits; overbuilding a serializer framework.
- Why this order: every later runtime primitive needs the same value and serialization foundation.

## TASK-017 - Entity Identity Validator

- Purpose: Implement production validation for canonical entity IDs, type matching, aliases as data,
  and identity references needed by later runtime packages.
- Dependencies: TASK-016.
- Allowed files: `packages/engine-contracts/**`, `packages/validation/**`, `tests/**`.
- Forbidden files: runtime registries, package manifest ownership, plugin namespace registries,
  game content.
- Acceptance criteria: validates ID grammar, entity type match, schemaVersion bounds, and diagnostic
  results without package-level alias graph resolution.
- Tests: M1 fixture regressions plus focused production validator tests.
- Risks: turning local identity validation into a registry or manifest system.
- Why this order: state, commands, transactions, and events all depend on canonical identity.

## TASK-018 - Schema Versioning Compatibility Helper

- Purpose: Implement small compatibility helpers for schema ID/version range checks and status
  derivation.
- Dependencies: TASK-016, TASK-017.
- Allowed files: `packages/engine-contracts/**`, `packages/validation/**`, `tests/**`.
- Forbidden files: migration runner, runtime schema registry, save migration, package registry.
- Acceptance criteria: computes EXACT, READABLE, MIGRATION_REQUIRED, unsupported, invalid, and
  missing-schema outcomes from explicit descriptors.
- Tests: descriptor fixtures, range checks, writer support checks, status priority.
- Risks: accidentally implementing migration graph execution or registry generation.
- Why this order: state and runtime validators need a shared compatibility helper before accepting
  schema-bearing records.

## TASK-019 - Engine State Shape and Snapshot Validator

- Purpose: Implement in-memory Engine State snapshot shape validation and canonical snapshot checks.
- Dependencies: TASK-016, TASK-017, TASK-018.
- Allowed files: `packages/engine-state/**`, `packages/engine-contracts/**`, `packages/validation/**`,
  `tests/**`.
- Forbidden files: State Store, persistence, save envelope, UI, game domains beyond neutral test
  fixtures.
- Acceptance criteria: validates root state, domains, revisions, JSON-safe data, canonical domain
  ordering, and immutable snapshot copy boundaries.
- Tests: M1 Engine State fixtures, revision and domain ordering tests, negative runtime-value tests.
- Risks: drifting into Store lifecycle, save metadata, or concrete content domains.
- Why this order: condition and effect runtime need a reliable state snapshot boundary.

## TASK-020 - Validation Diagnostic Adapter/Core Model

- Purpose: Implement shared diagnostic result helpers, aggregate status derivation, redaction
  boundaries, and owner-code identity utilities.
- Dependencies: TASK-016, TASK-017, TASK-018.
- Allowed files: `packages/validation/**`, `packages/engine-contracts/**`, `tests/**`.
- Forbidden files: logger, telemetry, localization, UI renderer, monitoring backend.
- Acceptance criteria: creates deterministic diagnostic envelopes and aggregates without exposing
  unsafe values.
- Tests: diagnostic fixture regressions, redaction, aggregate status, deterministic ordering.
- Risks: code inventory parity drift; localization or logging scope creep.
- Why this order: later runtime tasks need one diagnostic shape before producing failures.

## TASK-021 - Condition Evaluator

- Purpose: Implement readonly deterministic condition evaluation over validated Engine State.
- Dependencies: TASK-016 through TASK-020.
- Allowed files: `packages/engine-rules/**`, `packages/engine-state/**`, `packages/validation/**`,
  `tests/**`.
- Forbidden files: condition registry runtime, scripting, UI explain tool, gameplay-specific
  condition families.
- Acceptance criteria: supports M1 atomics/composition, fail-closed errors, safe selectors, bounded
  evaluation, and no mutation.
- Tests: M1 condition fixtures, readonly mutation guard, missing path/domain diagnostics, budget
  tests.
- Risks: hidden state mutation; fail-open behavior; unplanned registry design.
- Why this order: effect guards and command preconditions depend on condition evaluation.

## TASK-022 - Effect Applicator

- Purpose: Implement deterministic candidate-state effect application with guard support.
- Dependencies: TASK-016 through TASK-021.
- Allowed files: `packages/engine-rules/**`, `packages/engine-state/**`, `packages/validation/**`,
  `tests/**`.
- Forbidden files: Transaction Manager, commit logic, Domain Event emission, Save, UI.
- Acceptance criteria: applies M1 atomic effects to candidate copies, preserves committed input,
  reports no-op/error outcomes, and rejects protected metadata mutations.
- Tests: M1 effect fixtures, rollback-of-partial-application at applicator boundary, guard outcomes.
- Risks: sneaking commit semantics into effect application; ambiguous path writes.
- Why this order: transaction work needs a production effect primitive.

## TASK-023 - Command Planning Boundary/Reference Handlers

- Purpose: Implement a narrow command planning boundary using explicit reference handlers for
  neutral test commands only.
- Dependencies: TASK-016 through TASK-022.
- Allowed files: `packages/engine-kernel/**`, `packages/engine-rules/**`, `packages/validation/**`,
  `tests/**`.
- Forbidden files: general Command Bus, handler registry runtime, gameplay commands, plugin command
  registration.
- Acceptance criteria: validates command envelopes, evaluates preconditions, produces ordered effect
  plans, and rejects missing handler mappings explicitly.
- Tests: command fixtures, precondition false/error, duplicate command ID in-memory handling,
  reference handler determinism.
- Risks: turning reference handlers into a registry or gameplay API.
- Why this order: transactions consume command plans, not raw command intent.

## TASK-024 - Transaction Manager Reference Implementation

- Purpose: Implement in-memory transaction lifecycle over committed state and ordered effect plans.
- Dependencies: TASK-016 through TASK-023.
- Allowed files: `packages/engine-kernel/**`, `packages/engine-state/**`, `packages/engine-rules/**`,
  `packages/validation/**`, `tests/**`.
- Forbidden files: Save, Event Store, durable idempotency store, Event Bus, crash recovery.
- Acceptance criteria: supports commit, no-op, rejected, rolled-back, and error outcomes; enforces
  base revision and final revision checks; preserves committed input on failure.
- Tests: transaction fixtures, rollback, no-op, revision conflict, duplicate transaction ID
  in-memory behavior.
- Risks: persistence semantics leaking into transaction; treating in-memory idempotency as durable.
- Why this order: Domain Events must only materialize from committed transaction results.

## TASK-025 - Domain Event Materializer

- Purpose: Implement deterministic confirmed event batch materialization from committed transaction
  results.
- Dependencies: TASK-016 through TASK-024; event identity slug algorithm decision must be resolved
  before implementation.
- Allowed files: `packages/engine-kernel/**`, `packages/validation/**`, `tests/**`.
- Forbidden files: Event Store, Event Bus, subscribers, replay, projections, save persistence.
- Acceptance criteria: produces confirmed events only for committed transactions, validates revision
  boundaries, event sequence ordering, duplicate IDs, and empty confirmed batches.
- Tests: domain-event fixtures, materialization determinism, no event for no-op/rejected/rollback.
- Risks: implementing storage or delivery too early; nondeterministic event identity.
- Why this order: event materialization depends on transaction outcomes.

## TASK-026 - Minimal End-to-End Contract Pipeline Test

- Purpose: Prove the full in-memory reference pipeline with one neutral example.
- Dependencies: TASK-016 through TASK-025.
- Allowed files: `tests/**`, `packages/test-support/**`, package tests for the runtime packages.
- Forbidden files: P0 gameplay content, UI, save files, editor fixtures, plugin runtime.
- Acceptance criteria: command -> plan -> transaction -> committed state -> confirmed event ->
  diagnostics is covered by a small deterministic test.
- Tests: one E2E contract pipeline test plus targeted regression checks.
- Risks: growing the example into gameplay content or a demo app.
- Why this order: E2E proof should validate existing primitives, not define them.

## TASK-027 - M2 Gate Review

- Purpose: Review the M2 reference runtime slice for contract alignment, package boundaries, test
  coverage, and deferred decisions.
- Dependencies: TASK-016 through TASK-026.
- Allowed files: `docs/reviews/**`, `docs/handoffs/**`, `docs/status/CURRENT_STATE.md`, task file.
- Forbidden files: runtime implementation changes unless a separate remediation task is created.
- Acceptance criteria: gate outcome is PASS, CONDITIONAL PASS, or FAIL with findings.
- Tests: required checks rerun before review; no new runtime behavior in the review itself.
- Risks: merging review and remediation in one uncontrolled change.
- Why this order: M2 needs a gate before broadening scope beyond the reference slice.
