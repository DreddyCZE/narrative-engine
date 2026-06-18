# TASK-014 - Reconcile M1 Diagnostic Inventory

## ID

TASK-014

## Title

Reconcile M1 Diagnostic Inventory

## Milestone

M1 - Core Foundation

## Status

REVIEW

## Priority

P0

## Objective

Resolve the bounded governance drift found by TASK-013 by reconciling M1 diagnostic code inventory
metadata and stale completed-contract status metadata.

## Context

TASK-013 produced a conditional M1 contract foundation review. The review found no runtime
contract blocker, but it identified that `CONTRACT_INVENTORY.md` does not yet expose a reconciled
M1 diagnostic code inventory and still marks the completed Condition Contract as `DRAFT_REQUIRED`.

## Authoritative References

- `AGENTS.md`
- `docs/status/CURRENT_STATE.md`
- `docs/reviews/M1_CONTRACT_FOUNDATION_REVIEW.md`
- `docs/reviews/M1_CONTRACT_TRACEABILITY_MATRIX.md`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/contracts/VALIDATION_DIAGNOSTIC_CONTRACT.md`
- M1 contract docs and tests for TASK-004 through TASK-012

## Scope

- Add or reconcile diagnostic code entries in `CONTRACT_INVENTORY.md` for M1 codes already used by
  the contract docs and tests.
- Refresh the `Condition Contract` inventory status so it reflects the completed draft.
- Document the remediation and handoff.

## Out of Scope

- Runtime validator, registry, State Store, Command Bus, Transaction Manager, Event Store, Save,
  telemetry, localization, or UI implementation.
- New contract semantics.
- New domain contracts.
- Broad refactors of M1 contract documents or schemas.

## Acceptance Criteria

- `CONTRACT_INVENTORY.md` includes the M1 diagnostic code entries called out by TASK-013.
- `Condition Contract` status is no longer stale.
- TASK-014 handoff records the remediation and verification.
- No implementation subsystem is introduced.

## Required Checks

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm validate`

## Handoff

See `docs/handoffs/TASK-014-HANDOFF.md`.
