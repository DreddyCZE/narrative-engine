# M1 Contract Foundation Review

**Date:** 2026-06-14

**Scope:** TASK-004 through TASK-012, their contract docs, schemas, fixtures, tests, handoffs, inventory, dependency order, versioning policy, and current state.

**Final acceptance update:** 2026-06-18 after TASK-014 inventory reconciliation.

**Reviewed commits:**
- `5735cc0` `docs(contracts): define entity identity contract`
- `44825a5` `docs(contracts): define schema versioning contract`
- `2494332` `docs(contracts): define engine state contract`
- `1f0ab0d` `docs(contracts): define condition contract`
- `0bdcf2c` `docs(contracts): define effect contract`
- `020cca1` `docs(contracts): define command contract`
- `d0190f9` `docs(contracts): finalize command contract review`
- `bf9dc3a` `docs(contracts): define transaction contract`
- `9447919` `docs(contracts): define domain event contract`
- `8de2275` `docs(contracts): define validation diagnostic contract`

## Gate Outcome

**PASS**

The M1 contract chain is coherent enough to support implementation planning. TASK-014 reconciled
the governance-layer inventory gaps found during the initial review. No blocker-level contradiction
was found in the Command -> Transaction -> Domain Event chain.

## Executive Summary

The M1 foundation is complete in the sense that the required contract documents, schemas, fixtures,
tests, and handoffs exist for the nine core contracts. The command, transaction, event, and
diagnostic boundaries are internally consistent and each contract uses deterministic, fail-closed,
JSON-safe models.

The initial review found limited governance drift:

1. `CONTRACT_INVENTORY.md` does not list every diagnostic code used by the M1 contract docs/tests.
2. `CONTRACT_INVENTORY.md` still marks `Condition Contract` as `DRAFT_REQUIRED` even though the
   contract exists and TASK-007 is done.

TASK-014 remediated both issues by adding the M1 diagnostic code inventory to
`CONTRACT_INVENTORY.md` and refreshing the `Condition Contract` status metadata.

## Findings

| ID | Severity | Dotčené kontrakty | Důkaz | Dopad | Doporučená náprava | Blokuje gate | Navržený vlastník / task |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M1-F001 | HIGH | `CONTRACT_INVENTORY.md`, `Condition`, `Effect`, `Command`, `Transaction`, `Domain Event`, `Validation Diagnostic` | M1 contract docs/tests use `STATE_PATH_NOT_FOUND`, `DUPLICATE_EVENT_ID`, `DUPLICATE_EVENT_SEQUENCE`, `EVENT_MATERIALIZATION_FAILED`, `CONFIRMATION_BOUNDARY_VIOLATION`, `DUPLICATE_TRANSACTION_ID`, and `IDEMPOTENCY_CONFLICT`, but the inventory did not list them. | The traceability matrix was incomplete, and registry-driven tooling would have missed codes that are already part of the contract surface. | Resolved by TASK-014. `CONTRACT_INVENTORY.md` now includes the M1 diagnostic code inventory with owner, category, severity, phase, and source metadata. | No | `TASK-014 – Reconcile M1 Diagnostic Inventory` |
| M1-F002 | MEDIUM | `CONTRACT_INVENTORY.md`, `Condition`, `CURRENT_STATE.md`, `TASK-007` | The inventory said `Condition Contract` current status was `DRAFT_REQUIRED`, while the contract file exists and TASK-007 is done. | Reviewers and task planning could misread a completed draft as still pending. | Resolved by TASK-014. `Condition Contract` is now marked `draft` / `DRAFTED`. | No | `TASK-014 – Reconcile M1 Diagnostic Inventory` |

## Contract-by-Contract Assessment

- **Entity Identity Contract:** PASS. Identity grammar, alias policy, provenance, and canonical
  serialization are coherent and used consistently by later contracts.
- **Schema Versioning Contract:** PASS. Contract version versus schema version scope is clear, and
  the compatibility model is explicit.
- **Engine State Contract:** PASS. Revision, snapshot immutability, and state-domain addressing are
  well bounded.
- **Condition Contract:** PASS with metadata drift. The read-only predicate model and selector rules
  are coherent; inventory status needs refresh.
- **Effect Contract:** PASS. Candidate mutation semantics, target addressing, and guard behavior are
  aligned with Engine State and Condition.
- **Command Contract:** PASS. Intent, invocation identity, preconditions, and command planning are
  unambiguous.
- **Transaction Contract:** PASS. Initial and final revision checks, working/candidate isolation,
  effect ordering, rollback, and no-op semantics are internally consistent.
- **Domain Event Contract:** PASS. Confirmed facts, revision boundary, event identity, and batch
  ordering are clear.
- **Validation Diagnostic Contract:** PASS. Owner-context registry identity, code grammar,
  severity/category/phase, location, redaction, and aggregate derivation are consistent.

## Cross-Contract Assessment

The core chain is explicit and implementable:

```text
Command -> Preconditions -> Command Plan -> Ordered Effects -> Transaction -> Working State ->
Candidate State -> Validation -> Revision checks -> Commit/Rollback -> Domain Event
```

All nine contracts use compatible JSON-safe models, deterministic serialization rules, and
fail-closed handling for invalid or unsafe values.

The validation-diagnostic owner tuple model is sound. After TASK-014, `CONTRACT_INVENTORY.md`
contains the M1 diagnostic code inventory needed for milestone traceability.

## Security Assessment

No new runtime attack surface was introduced during the contract foundation work.

- Executable payloads are banned in all M1 contracts.
- Prototype-pollution keys are rejected across the state, effect, command, transaction, event, and
  diagnostic value models.
- Diagnostics are redaction-aware and not a localization or telemetry envelope.
- No production runtime validator, event bus, state store, or transaction manager exists yet.

Residual risk is now limited to normal review risk for future contracts: downstream automated
consumers must keep adding new codes to the inventory when new contract surfaces are introduced.

## Test Assessment

The contract test surface exists and is aligned with the docs. Current contract test counts are:

- `entity-identity-contract.test.ts` - 14 tests
- `schema-versioning-contract.test.ts` - 16 tests
- `engine-state-contract.test.ts` - 12 tests
- `condition-contract.test.ts` - 23 tests
- `effect-contract.test.ts` - 19 tests
- `command-contract.test.ts` - 20 tests
- `transaction-contract.test.ts` - 21 tests
- `domain-event-contract.test.ts` - 14 tests
- `validation-diagnostic-contract.test.ts` - 19 tests
- `contracts.test.ts` - 1 test

Total contract tests: 159. Repository test suite remains green on the latest run.

Fixtures and oracle helpers are present for each M1 contract, and the helpers remain test-scoped.

## Implementability Assessment

An independent implementer can build the M1 contract boundaries from the current docs without
guessing core semantics for identity, schema versioning, state, conditions, effects, commands,
transactions, events, or diagnostics.

No implementation-adjacent blocker remains in the reviewed M1 contract foundation. The inventory is
now reconciled for the M1 codes found during this review.

## Conditions

1. Reconcile the M1 diagnostic code inventory. Resolved by TASK-014.
2. Refresh the stale `Condition Contract` inventory status. Resolved by TASK-014.
3. Re-run the acceptance review after the remediation is landed. Completed on 2026-06-18.

## Blockers

None.

## Remediation Plan

1. Created `TASK-014 – Reconcile M1 Diagnostic Inventory`.
2. Updated `CONTRACT_INVENTORY.md` for the missing code catalogue and stale Condition metadata.
3. Re-ran the acceptance review for TASK-013 on 2026-06-18.

## Final Recommendation

**PASS**

M1 is ready for implementation planning once TASK-013 and TASK-014 complete normal review. No
runtime implementation work has been started by this gate review.
