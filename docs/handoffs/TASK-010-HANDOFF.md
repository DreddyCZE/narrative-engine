# TASK-010 Handoff - Transaction Contract

## Status

DONE. No commit has been created for this task.

## Scope Delivered

- `docs/contracts/TRANSACTION_CONTRACT.md`
- `schemas/transaction.schema.json`
- `tests/transaction-contract.test.ts`
- `tests/fixtures/contracts/transaction/**`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-010-design-transaction-contract.md`

## Core Decisions

- Transaction input is a canonical, versioned envelope with `baseRevision`, ordered `effects`, and
  an explicit `source`.
- `transactionId` is optional in the draft, but when present it uses the Entity Identity Contract.
- `source.kind` supports `command-plan` and `system`; `allowNoOp` is an explicit policy switch.
- `baseRevision` is required and optimistic concurrency is enforced by rejecting revision mismatch
  before working-state creation, and the committed revision is checked again immediately before
  any commit path. Initial mismatches are rejected with `REVISION_CONFLICT`; final mismatches roll
  back the transaction with the same diagnostic code.
- Ordered Effect application is semantic. Repeated writes to the same target path in a single
  transaction are treated as an ambiguity blocker in the current draft.
- Transaction results are modeled as `committed`, `no-op`, `rolled-back`, `rejected`, or `error`.
- No-op transactions do not increment revision by default.
- Candidate state is never published as committed on failure.

## Test Oracle Boundary

- The transaction test helper is a contract oracle only.
- It is not a production Transaction Manager.
- It does not implement Command Bus, Event Store, Save, or permission systems.
- It does not model real concurrent commits; the final revision-check path is simulated through a
  test-only hook so the boundary remains explicit.
- It is intentionally scoped to the contract draft and regression coverage.

## Fixture Coverage

- Valid fixtures cover command-plan source, system source, transaction identity, no-op policy,
  ordered effects, and base revision zero.
- Invalid fixtures cover malformed envelopes, invalid revisions, invalid effect shapes, and payload
  limits.
- Semantic-invalid fixtures cover revision conflict, guard failure, candidate invalidity, metadata
  mutation, idempotence conflicts, no-op rejection policy, effect-order ambiguity, and unsupported
  schema versions.
- Runtime-invalid fixtures cover non-JSON host values and forbidden nested keys.

## Known Limits

- There is no production Transaction Manager.
- There is no Event Store or Save implementation.
- Authorization remains a boundary only; no permission system is implemented.
- Idempotence and duplicate handling are oracle-scoped and not backed by persistent storage.
- The draft currently rejects repeated writes to the same target path as an ambiguity case rather
  than attempting path resolution heuristics.

## Next Step

Review TASK-010.
