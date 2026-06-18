# M1 Contract Traceability Matrix

| Master spec / roadmap requirement | Contract | Schema | Tests | Fixtures | Task | Handoff | Status | Notes / gaps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Stable entity identity, aliases, provenance, deterministic IDs | `ENTITY_IDENTITY_CONTRACT.md` | `schemas/entity-identity.schema.json` | `tests/entity-identity-contract.test.ts` | `tests/fixtures/contracts/entity-identity/**` | `TASK-004` | `docs/handoffs/TASK-004-HANDOFF.md` | DONE | Coherent and used by all downstream identity-bearing contracts. |
| Integer schema versioning, compatibility, migrations | `SCHEMA_VERSIONING_CONTRACT.md` | `schemas/schema-versioning.schema.json` | `tests/schema-versioning-contract.test.ts` | `tests/fixtures/contracts/schema-versioning/**` | `TASK-005` | `docs/handoffs/TASK-005-HANDOFF.md` | DONE | Coherent; contract and schema version scopes are distinct. |
| Authoritative runtime state, revision, domains, canonical serialization | `ENGINE_STATE_CONTRACT.md` | `schemas/engine-state.schema.json` | `tests/engine-state-contract.test.ts` | `tests/fixtures/contracts/engine-state/**` | `TASK-006` | `docs/handoffs/TASK-006-HANDOFF.md` | DONE | Coherent; revision and state-domain grammar are compatible with later contracts. |
| Declarative read-only predicates with fail-closed semantics | `CONDITION_CONTRACT.md` | `schemas/condition.schema.json` | `tests/condition-contract.test.ts` | `tests/fixtures/contracts/condition/**` | `TASK-007` | `docs/handoffs/TASK-007-HANDOFF.md` | DONE | Inventory status in `CONTRACT_INVENTORY.md` is stale (`DRAFT_REQUIRED`), even though the contract exists. |
| Declarative candidate-state changes, guards, and targets | `EFFECT_CONTRACT.md` | `schemas/effect.schema.json` | `tests/effect-contract.test.ts` | `tests/fixtures/contracts/effect/**` | `TASK-008` | `docs/handoffs/TASK-008-HANDOFF.md` | DONE | Coherent with Condition and Engine State. |
| Serializable intent, invocations, targets, preconditions, idempotence | `COMMAND_CONTRACT.md` | `schemas/command.schema.json` | `tests/command-contract.test.ts` | `tests/fixtures/contracts/command/**` | `TASK-009` | `docs/handoffs/TASK-009-HANDOFF.md` | DONE | Coherent; command planning boundary is distinct from Transaction. |
| Atomic ordered-effect application, revision checks, rollback/no-op | `TRANSACTION_CONTRACT.md` | `schemas/transaction.schema.json` | `tests/transaction-contract.test.ts` | `tests/fixtures/contracts/transaction/**` | `TASK-010` | `docs/handoffs/TASK-010-HANDOFF.md` | DONE | Coherent; final revision check and no-op policy are explicit. |
| Immutable confirmed facts after successful commit | `DOMAIN_EVENT_CONTRACT.md` | `schemas/domain-event.schema.json` | `tests/domain-event-contract.test.ts` | `tests/fixtures/contracts/domain-event/**` | `TASK-011` | `docs/handoffs/TASK-011-HANDOFF.md` | DONE | Coherent; batch and revision boundary are explicit. |
| Safe diagnostics, codes, severity, categories, locations, redaction | `VALIDATION_DIAGNOSTIC_CONTRACT.md` | `schemas/validation-diagnostic.schema.json` | `tests/validation-diagnostic-contract.test.ts` | `tests/fixtures/contracts/validation-diagnostic/**` | `TASK-012` | `docs/handoffs/TASK-012-HANDOFF.md` | DONE | Coherent; owner-contract registry tuple is explicit. Inventory is incomplete for some codes. |
| Cross-contract diagnostic code registry / inventory traceability | `CONTRACT_INVENTORY.md` + diagnostics contract | N/A | Cross-contract contract tests and oracle checks | Existing fixtures use M1 diagnostic codes | `TASK-013` review, `TASK-014` remediation | This review doc and `docs/handoffs/TASK-014-HANDOFF.md` | PASS | TASK-014 added the M1 diagnostic code inventory, including `STATE_PATH_NOT_FOUND`, `DUPLICATE_EVENT_ID`, `DUPLICATE_EVENT_SEQUENCE`, `EVENT_MATERIALIZATION_FAILED`, `CONFIRMATION_BOUNDARY_VIOLATION`, `DUPLICATE_TRANSACTION_ID`, and `IDEMPOTENCY_CONFLICT`. |
| Milestone readiness and governance state | `CURRENT_STATE.md`, task workflow | N/A | Repository status checks | N/A | `TASK-013` review, `TASK-014` remediation | This review doc and `docs/handoffs/TASK-014-HANDOFF.md` | PASS | TASK-014 refreshed `Condition Contract` inventory status from `DRAFT_REQUIRED` to `DRAFTED`. |

## Contract Set Assessment

The nine M1 contracts are present, versioned, tested, and documented.

- Identity and schema versioning are the shared base layers.
- Engine State, Condition, Effect, Command, Transaction, and Domain Event form a consistent pipeline.
- Validation Diagnostic provides the common structured error surface.

TASK-014 resolved the governance metadata gaps found by the initial TASK-013 review.

## Required Follow-up

No additional M1 contract-foundation remediation is required by this review. Future tasks must keep
new diagnostic codes synchronized with `CONTRACT_INVENTORY.md`.
