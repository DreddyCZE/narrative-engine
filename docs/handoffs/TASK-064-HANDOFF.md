# TASK-064 HANDOFF

## Status

REVIEW

## Summary

TASK-064 adds the replay planning and contract boundary for M7 without implementing replay execution. The task introduces data-only replay contracts for replay statuses, source descriptors, inputs, results, diagnostics, metadata, and replay plans, plus a dedicated replay planning document that keeps replay separate from runtime execution, storage writes, and adapter implementation details.

## Changed Files

- `docs/handoffs/TASK-064-HANDOFF.md`
- `docs/planning/M7_PRODUCTION_STORAGE_ADAPTER_REPLAY_BOUNDARY.md`
- `docs/planning/M7_REPLAY_BOUNDARY.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/review/TASK-064-replay-planning-and-contract-boundary.md`
- `packages/engine-contracts/src/index.ts`
- `packages/engine-contracts/src/replay/replay-types.ts`
- `tests/replay-contracts.test.ts`

## Contract Location

- `packages/engine-contracts/src/replay/replay-types.ts`
- `packages/engine-contracts/src/index.ts`

## Planning Doc Location

- `docs/planning/M7_REPLAY_BOUNDARY.md`
- `docs/planning/M7_PRODUCTION_STORAGE_ADAPTER_REPLAY_BOUNDARY.md`

## Test Location

- `tests/replay-contracts.test.ts`

## Supported Replay Contract Behavior

- replay status and source-kind contracts
- data-only replay source descriptors for snapshot-only, event-stream-only, snapshot-and-events, and storage-adapter sourced plans
- replay input validation with deterministic diagnostics
- replay result, metadata, plan, and step descriptors
- deterministic replay policy metadata
- no storage adapter invocation and no runtime execution

## Unsupported / Deferred Behavior

- no replay runtime execution
- no event stream replay implementation
- no state rebuild implementation
- no production file IO in replay contracts
- no DB adapter
- no external storage adapter
- no UI/editor save-load flow
- no gameplay/P0 content
- no plugin runtime
- no external network calls

## Validation

- `corepack pnpm test -- tests/replay-contracts.test.ts`
- `corepack pnpm test -- tests/file-storage-adapter-boundary.test.ts`
- `corepack pnpm test -- tests/storage-adapter-contracts.test.ts`
- `corepack pnpm test -- tests/serialization-schema-contracts.test.ts`
- `corepack pnpm test -- tests/in-memory-persistence-integration.test.ts`
- `corepack pnpm test -- tests/runtime-result-event-store-adapter.test.ts`
- `corepack pnpm test -- tests/persistence-envelope-contracts.test.ts`
- `corepack pnpm test -- tests/in-memory-event-store-boundary.test.ts`
- `corepack pnpm test -- tests/in-memory-save-snapshot-boundary.test.ts`
- `corepack pnpm test -- tests/runtime-domain-event-return-values.test.ts`
- `corepack pnpm test -- tests/minimal-fixture-runtime-command-integration.test.ts`
- `corepack pnpm test -- tests/in-memory-command-execution-pipeline.test.ts`
- `corepack pnpm test -- tests/runtime-condition-effect-binding-adapter.test.ts`
- `corepack pnpm test -- tests/runtime-command-request-resolver.test.ts`
- `corepack pnpm test -- tests/runtime-host-input-result-contracts.test.ts`
- `corepack pnpm test -- tests/content-m2-primitive-integration.test.ts`
- `corepack pnpm test -- tests/content-loader-boundary-minimal-fixture-integration.test.ts`
- `corepack pnpm test -- tests/content-loader-m2-primitive-binding-validation.test.ts`
- `corepack pnpm test -- tests/content-loader-validated-content-graph-builder.test.ts`
- `corepack pnpm test -- tests/content-loader-reference-validation.test.ts`
- `corepack pnpm test -- tests/content-loader-id-indexing.test.ts`
- `corepack pnpm test -- tests/content-loader-manifest-section-validation.test.ts`
- `corepack pnpm test -- tests/content-loader-input-result-types.test.ts`
- `corepack pnpm test -- tests/minimal-neutral-content-package-fixture.test.ts`
- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm build`
- `corepack pnpm validate`
- `git diff --check`

## Next Recommended Task

- `TASK-065 - Storage adapter conformance tests`

## Active Task

none
