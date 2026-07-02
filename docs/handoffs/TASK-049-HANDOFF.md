# TASK-049 HANDOFF

## Status

DONE

## Summary

TASK-049 adds a pure in-memory runtime command execution pipeline in `engine-kernel`. The pipeline accepts caller-provided `RuntimeHostInput`, resolves the requested command from the validated content graph, adapts condition and effect bindings, evaluates M2 conditions, applies adapted M2 effects through the transaction primitive, rebuilds deterministic next state values in memory, and returns `RuntimeHostResult` summaries with deterministic diagnostics and metadata.

No persistence, file IO, Save system, Event Store write, UI/editor, gameplay content, plugin runtime, or long-running runtime host process was added.

## Changed Files

- `docs/handoffs/TASK-049-HANDOFF.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/review/TASK-049-in-memory-command-execution-pipeline.md`
- `packages/engine-kernel/src/index.ts`
- `packages/engine-kernel/src/runtime-host/in-memory-command-execution-pipeline.ts`
- `tests/in-memory-command-execution-pipeline.test.ts`

## Production Function Location

- `packages/engine-kernel/src/runtime-host/in-memory-command-execution-pipeline.ts`
- export: `packages/engine-kernel/src/index.ts`

## Test Location

- `tests/in-memory-command-execution-pipeline.test.ts`

## Supported Pipeline Behavior

- resolve runtime command requests from `RuntimeHostInput`
- adapt command-linked condition and effect definitions from the validated content graph
- evaluate adapted conditions through existing M2 condition primitives only
- adapt shorthand content effects into canonical M2 effect envelopes with resolved `domainId`
- execute accepted effects through the existing M2 transaction primitive only
- rebuild deterministic next-state snapshots in memory without mutating input state or graph values
- return deterministic `RuntimeHostResult` values for `committed`, `rejected`, `blocked`, and `error`
- summarize matching event mapping types as deterministic runtime domain-event metadata
- preserve runtime boundary constraints with no persistence, file IO, or external runtime process

## Unsupported / Deferred Behavior

- no domain event materialization or persistence
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
- no production file loader
- no file IO
- no replay system
- no long-running runtime host process

## Validation

- `corepack pnpm test -- tests/in-memory-command-execution-pipeline.test.ts` - passed, 1 file / 7 tests
- `corepack pnpm lint` - passed
- `corepack pnpm typecheck` - passed
- `corepack pnpm test` - passed, 35 files / 458 tests
- `corepack pnpm build` - passed
- `corepack pnpm validate` - passed

## Non-Goals

- no domain event materialization or persistence
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
- no production file loader
- no file IO
- no replay system
- no long-running runtime host process

## Risks / Open Questions

- the pipeline currently derives `domainId` for shorthand `set-field` effects by matching the target path root against domain data keys, so later multi-domain authoring may need stricter ownership rules
- runtime domain events are still returned only as summary metadata; TASK-050 must keep that boundary explicit when introducing runtime domain event return values
- command planning still uses the existing `core.validate-only` primitive as a deterministic gate before runtime-owned effects execute, so later command-type expansion should stay aligned with M2 planning contracts

## Next Recommended Task

- `TASK-050 - Runtime domain event return values`

## Active Task

none
