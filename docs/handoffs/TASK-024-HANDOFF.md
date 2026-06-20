# TASK-024 HANDOFF

## Status

DONE

## Acceptance

TASK-024 was accepted after implementation and merge on `main`.

## Summary

TASK-024 adds a deterministic in-memory Transaction Manager reference implementation in
`packages/engine-kernel`. It validates transaction envelopes, supports the command-planning
boundary through a command-wrapper path, applies ordered effects to a cloned candidate state in
memory, preserves input immutability, and returns stable transaction diagnostics without
introducing persistence, event storage, save, UI, or runtime pipeline behavior.

## Changed Files

- `docs/handoffs/TASK-024-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-024-transaction-manager-reference-implementation.md`
- `packages/engine-kernel/src/index.ts`
- `packages/engine-kernel/src/transaction/transaction.ts`
- `tests/transaction-manager-reference.test.ts`

## API Summary

- `TRANSACTION_CONTRACT_VERSION`
- `TRANSACTION_SCHEMA_ID`
- `TRANSACTION_SCHEMA_VERSION`
- `TransactionStatus`
- `TransactionIssueCode`
- `TransactionIssue`
- `TransactionHistoryEntry`
- `TransactionHistory`
- `TransactionOptions`
- `TransactionResult`
- `inspectTransaction()`
- `runTransaction()`
- `runCommandTransaction()`
- `applyTransaction()`

## Transaction Semantics

- Supported transaction inputs are validated before any candidate state work.
- Command-plan inputs can be planned through `runCommandTransaction()` using the Command planning
  boundary.
- Ordered effects apply in memory to a cloned candidate state.
- `committed` results increment revision by exactly `1`.
- `no-op` results keep the revision unchanged.
- `rejected` results cover revision conflicts and no-op policy violations before commit.
- `rolled-back` results cover effect application failures, candidate validation failures, and final
  revision conflicts after candidate work exists.
- `error` results cover malformed input, unsupported schema versions, budget violations, and other
  contract failures.

## Supported Statuses

- `committed`
- `no-op`
- `rejected`
- `rolled-back`
- `error`

## Rollback / No-op Behavior

- Rollback discards the in-memory candidate state.
- No-op returns a successful result without incrementing revision.
- `allowNoOp: false` rejects a no-op transaction.
- Final revision conflicts after candidate work exists return `rolled-back`.

## Tests

- valid transaction inspection
- commit and no-op behavior
- no-op rejection
- initial and final revision conflicts
- effect application rollback
- candidate state invalid rollback
- invalid shape, forbidden-key, and cyclic transaction rejection
- duplicate transaction and idempotency handling
- command-wrapper commit and precondition rejection
- input immutability
- stable diagnostics paths

## Validation

- `corepack pnpm test -- tests/transaction-manager-reference.test.ts` - pass
- `corepack pnpm lint` - pass
- `corepack pnpm typecheck` - pass
- `corepack pnpm test` - pass, 20 test files / 362 tests
- `corepack pnpm build` - pass
- `corepack pnpm validate` - pass
- `git diff --check` - pass

## Boundary Notes

- The transaction manager uses only public exports from `@narrative-engine/core`,
  `@narrative-engine/engine-contracts`, and the kernel command boundary.
- It does not import docs, tests, fixtures, UI, save, event store, or any plugin/runtime system.
- It stays in-memory and does not become a persistence or event pipeline.

## Explicit Non-Goals

- No Domain Event materializer.
- No Event Store.
- No Save system.
- No persistence.
- No crash recovery.
- No distributed transactions.
- No UI/editor.
- No gameplay/P0 content.
- No plugin runtime.
- No TASK-025.

## Known Non-Blockers

- Local Node is `v24.16.0` while the repository expects Node 22.
- `corepack pnpm` emits the corresponding engine warning locally.

## Active Task

none

## Next Recommended Task

`TASK-025 - Domain Event materializer`
