# TASK-047 HANDOFF

## Status

REVIEW

## Summary

TASK-047 adds a pure runtime command request resolver in `engine-kernel`. The resolver accepts caller-provided `RuntimeHostInput`, reads only the provided validated content graph value, resolves a command or action by `commandId`, and returns either a value-only resolved summary or deterministic diagnostics.

No runtime host execution pipeline was added.

## Changed Files

- `docs/handoffs/TASK-047-HANDOFF.md`
- `docs/planning/M5_RUNTIME_HOST_COMMAND_EXECUTION_INTEGRATION.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/review/TASK-047-runtime-command-request-resolver.md`
- `packages/engine-kernel/src/index.ts`
- `packages/engine-kernel/src/runtime-host/runtime-command-request-resolver.ts`
- `tests/runtime-command-request-resolver.test.ts`

## Production Function Location

- `packages/engine-kernel/src/runtime-host/runtime-command-request-resolver.ts`
- export: `packages/engine-kernel/src/index.ts`

## Test Location

- `tests/runtime-command-request-resolver.test.ts`

## Supported Resolver Behavior

- resolve a command from `validatedContentGraph.sections.commands` by `RuntimeCommandRequest.commandId`
- resolve an action from `validatedContentGraph.sections.actions` by `RuntimeCommandRequest.commandId`
- return stable resolve paths
- return value-only command definition summaries with condition, effect, and event-mapping refs
- return deterministic diagnostics for missing, invalid, unknown, ambiguous, and graph-invalid command requests
- preserve input and validated graph immutability

## Unsupported / Deferred Behavior

- no runtime host execution
- no condition evaluation
- no effect application
- no command execution
- no transaction commit
- no domain event materialization
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
- no production file loader
- no file IO

## Validation

- `corepack pnpm test -- tests/runtime-command-request-resolver.test.ts` - passed, 1 file / 7 tests
- `corepack pnpm test -- tests/runtime-host-input-result-contracts.test.ts` - passed, 1 file / 5 tests
- `corepack pnpm test -- tests/content-loader-boundary-minimal-fixture-integration.test.ts` - passed, 1 file / 3 tests
- `corepack pnpm test -- tests/content-loader-m2-primitive-binding-validation.test.ts` - passed, 1 file / 7 tests
- `corepack pnpm test -- tests/content-loader-validated-content-graph-builder.test.ts` - passed, 1 file / 6 tests
- `corepack pnpm test -- tests/content-loader-reference-validation.test.ts` - passed, 1 file / 5 tests
- `corepack pnpm test -- tests/content-loader-id-indexing.test.ts` - passed, 1 file / 6 tests
- `corepack pnpm test -- tests/content-loader-manifest-section-validation.test.ts` - passed, 1 file / 7 tests
- `corepack pnpm test -- tests/content-loader-input-result-types.test.ts` - passed, 1 file / 5 tests
- `corepack pnpm test -- tests/minimal-neutral-content-package-fixture.test.ts` - passed, 1 file / 5 tests
- `corepack pnpm test -- tests/content-m2-primitive-integration.test.ts` - passed, 1 file / 3 tests
- `corepack pnpm lint` - passed
- `corepack pnpm typecheck` - passed
- `corepack pnpm test` - passed, 33 files / 440 tests
- `corepack pnpm build` - passed
- `corepack pnpm validate` - passed
- `git diff --check` - passed

## Non-Goals

- no runtime host execution pipeline
- no condition evaluation flow
- no effect application flow
- no command execution
- no transaction commit flow
- no domain event materialization flow
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
- no production file loader
- no file IO

## Risks / Open Questions

- ambiguous command matching currently reports all matching content paths, but later M5 tasks may need stricter command-vs-action precedence rules
- graph shape assumptions are intentionally narrow to the current validated content graph boundary and may need extension if later M5 tasks widen graph metadata
- resolver diagnostics are deterministic, but downstream planning and transaction stages must preserve that determinism when they consume resolver output

## Next Recommended Task

- `TASK-048 - Runtime condition/effect binding adapter`

## Active Task

none
