# TASK-012 - Design Validation Diagnostic Contract

## ID

TASK-012

## Title

Design Validation Diagnostic Contract

## Milestone

M1 - Core Foundation

## Status

DONE

## Priority

P1

## Objective

Design a public, versioned Validation Diagnostic Contract that defines stable, serializable,
safe diagnostics for validation, planning, transaction, event, authoring, and migration workflows.

## Context

The engine needs one canonical diagnostic shape before runtime validators, authoring tools, and
future telemetry are allowed to diverge. Diagnostics must remain machine-readable, deterministic,
and redaction-safe without becoming a logger, localization runtime, or exception hierarchy.

## Authoritative References

- `PROJECT_CHARTER.md`
- `AGENTS.md`
- `docs/spec/MASTER_SPEC.md`
- `docs/roadmap/ROADMAP.md`
- `docs/status/CURRENT_STATE.md`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`
- `docs/contracts/CONTRACT_VERSIONING_POLICY.md`
- `docs/contracts/ENTITY_IDENTITY_CONTRACT.md`
- `docs/contracts/SCHEMA_VERSIONING_CONTRACT.md`
- `docs/contracts/ENGINE_STATE_CONTRACT.md`
- `docs/contracts/CONDITION_CONTRACT.md`
- `docs/contracts/EFFECT_CONTRACT.md`
- `docs/contracts/COMMAND_CONTRACT.md`
- `docs/contracts/TRANSACTION_CONTRACT.md`
- `docs/contracts/DOMAIN_EVENT_CONTRACT.md`
- `schemas/entity-identity.schema.json`
- `schemas/schema-versioning.schema.json`
- `schemas/engine-state.schema.json`
- `schemas/condition.schema.json`
- `schemas/effect.schema.json`
- `schemas/command.schema.json`
- `schemas/transaction.schema.json`
- `schemas/domain-event.schema.json`
- `docs/handoffs/TASK-004-HANDOFF.md`
- `docs/handoffs/TASK-005-HANDOFF.md`
- `docs/handoffs/TASK-006-HANDOFF.md`
- `docs/handoffs/TASK-007-HANDOFF.md`
- `docs/handoffs/TASK-008-HANDOFF.md`
- `docs/handoffs/TASK-009-HANDOFF.md`
- `docs/handoffs/TASK-010-HANDOFF.md`
- `docs/handoffs/TASK-011-HANDOFF.md`

## Dependencies

- TASK-004 - Design Entity Identity Contract
- TASK-005 - Design Schema Versioning Contract
- TASK-006 - Design Engine State Contract
- TASK-007 - Design Condition Contract
- TASK-008 - Design Effect Contract
- TASK-009 - Design Command Contract
- TASK-010 - Design Transaction Contract
- TASK-011 - Design Domain Event Contract

## Scope

- Define the diagnostic envelope, identity model, code grammar, severity model, category model,
  phase model, location model, source and related references, message policy, expected/actual
  redaction, aggregate result model, deterministic ordering, deduplication policy, validation
  modes, cross-contract code inventory, canonical serialization, budgets, and security boundary.
- Provide a contract document, schema, fixtures, tests, inventory update, current-state update, and
  handoff.

## Out of Scope

- Production validation framework.
- Logger or telemetry pipeline.
- Localization runtime.
- Player-facing error UI.
- Exception hierarchy.
- Monitoring backend.
- Event Bus, Event Store, replay engine, projection runtime, subscriber system, scheduler, or save
  system.
- Automatic mass refactoring of previous contracts.

## Acceptance Criteria

- The Validation Diagnostic Contract is publicly documented and versioned.
- Diagnostics are JSON-safe, deterministic, and redaction-safe.
- Code, severity, category, phase, and path semantics are explicit.
- The contract separates diagnostics from exceptions, logs, and player-facing text.
- Existing codes from related contracts are inventoried without silent remapping.
- No production validator, logger, telemetry, or localization runtime is introduced.

## Mandatory Tests and Fixtures

- Valid fixtures for error, warning, info, and fatal diagnostics; document and state locations;
  source references; related references; safe expected/actual values; redacted actual values; and
  aggregate results.
- Invalid fixtures for malformed envelopes, invalid codes, invalid severities, invalid categories,
  invalid phases, invalid locations, invalid source references, oversized messages, excessive
  related references, executable fields, unsafe nested metadata, and invalid expected/actual
  shapes.
- Semantic-invalid fixtures for unknown codes, registry default mismatches, source/location kind
  mismatches, duplicate fingerprints, aggregate severity mismatches, sensitive data without
  redaction, budget overflow, and causal cycles.
- Runtime-invalid fixtures for non-JSON host values and forbidden nested keys.
- Contract tests for deterministic ordering, fingerprinting, redaction, aggregate status, and
  canonical serialization.

## Allowed Files

- `docs/contracts/VALIDATION_DIAGNOSTIC_CONTRACT.md`
- `schemas/validation-diagnostic.schema.json`
- `tests/validation-diagnostic-contract.test.ts`
- `tests/fixtures/contracts/validation-diagnostic/**`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/status/CURRENT_STATE.md`
- `docs/handoffs/TASK-012-HANDOFF.md`
- `docs/tasks/done/TASK-012-design-validation-diagnostic-contract.md`
- `packages/test-support/**` for test-only oracle helpers

## Forbidden Changes

- Production validation framework implementation.
- Logger, telemetry, or monitoring backend implementation.
- Localization runtime implementation.
- Exception hierarchy implementation.
- Player-facing error UI implementation.
- Automatic refactoring of previous contract documents.

## Risks

- Diagnostics becoming a proxy localization system.
- Leaking command, state, or event payloads through diagnostics.
- Treating code strings as globally unique without owner context.
- Creating an exception model instead of a contract model.
- Allowing nondeterministic ordering or unbounded diagnostics graphs.

## Compatibility and Migration Impact

- Diagnostic code semantics must remain stable once published.
- Existing contract codes must be inventoried with owner context to avoid silent collisions.
- Future localization, telemetry, and monitoring layers must consume this contract rather than invent
  their own shape.
- Future migration rules must preserve diagnostic meaning even when schemas evolve.

## Output Artifacts

- Validation Diagnostic contract document.
- Validation Diagnostic JSON Schema.
- Validation Diagnostic contract test suite.
- Validation Diagnostic fixtures.
- Updated contract inventory.
- Updated current state.
- Task handoff.

## Definition of Done

- Contract document, schema, fixtures, and tests exist.
- Inventory and current state are updated.
- Handoff is complete.
- No production validation framework exists.
- No second ACTIVE task exists.
- The task is ready for review after implementation and verification.
