# TASK-023 HANDOFF

## Status

REVIEW

## Summary

TASK-023 adds a deterministic command planning boundary in `packages/engine-kernel`. The planner validates
command envelopes, checks preconditions, produces ordered unconfirmed effect plans for neutral reference
commands, preserves input immutability, and returns stable diagnostics without introducing transaction,
event, save, UI, or runtime pipeline behavior.

## Changed Files

- `docs/status/CURRENT_STATE.md`
- `docs/tasks/review/TASK-023-command-planning-boundary-reference-handlers.md`
- `docs/handoffs/TASK-023-HANDOFF.md`
- `packages/engine-kernel/package.json`
- `packages/engine-kernel/src/index.ts`
- `packages/engine-kernel/src/command/command.ts`
- `pnpm-lock.yaml`
- `tests/command-planning-boundary.test.ts`

## API Summary

- `COMMAND_CONTRACT_VERSION`
- `COMMAND_SCHEMA_ID`
- `COMMAND_SCHEMA_VERSION`
- `CommandPlanningStatus`
- `CommandPlanningIssueCode`
- `CommandPlanningIssue`
- `CommandPlanningPlan`
- `CommandPlanningResult`
- `PlanningHistory`
- `CommandPlanningOptions`
- `inspectCommand()`
- `planCommand()`

## Planning Semantics

- Valid command envelopes are inspected deterministically.
- Supported neutral command types plan to ordered, unconfirmed effect envelopes.
- False preconditions return `rejected`.
- Invalid command shape, invalid preconditions, missing handlers, invalid planned effects, and
  duplicate conflicts return `error`.
- Duplicate `commandId` and `idempotencyKey` replay is detected through planning history.
- Candidate command and state inputs are not mutated.

## Supported Command Shape / Handlers

- Envelope validation follows the Command Contract.
- Supported neutral command types:
  - `core.validate-only`
  - `core.set-value`
  - `core.double-set`
  - `core.missing-handler`
  - `core.invalid-effect-plan`
  - `core.deterministic-check`
  - `core.dedup-check`
- Preconditions are evaluated through the readonly Condition evaluator.
- Planned effects are validated through the Effect contract helpers before acceptance.

## Unsupported / Deferred

- Transaction Manager.
- Commit / rollback.
- Revision conflict resolution beyond planning diagnostics.
- Domain Event materializer.
- Event Store.
- Save system.
- Persistence implementation.
- UI or editor work.
- Gameplay/P0 content.
- Plugin runtime.
- General-purpose command bus or registry.

## Tests

- valid command inspection
- validate-only command planning
- single set-value planning
- deterministic double-set planning
- false precondition rejection
- stable diagnostics for invalid preconditions and planned effects
- missing-handler and unknown-type errors
- invalid, non-JSON, forbidden-key, and cyclic command rejection
- duplicate command and idempotency handling
- input immutability
- no transaction/runtime side effects

## Validation

- `corepack pnpm test -- tests/command-planning-boundary.test.ts` - pass
- `corepack pnpm test` - pass, 19 test files / 348 tests
- `corepack pnpm lint` - pass
- `corepack pnpm typecheck` - pass
- `corepack pnpm build` - pass
- `corepack pnpm validate` - pass
- `git diff --check` - pass

## Boundary Notes

- The planner uses only public exports from `@narrative-engine/core` and `@narrative-engine/engine-contracts`.
- It does not import docs, tests, fixtures, UI, save, event, or transaction systems.
- It stays in the command-planning boundary and does not become a transaction pipeline.

## Explicit Non-Goals

- No Transaction Manager.
- No Domain Event materializer.
- No Event Store or Save system.
- No persistence.
- No UI/editor.
- No gameplay/P0 content.
- No plugin runtime.
- No TASK-024.

## Known Non-Blockers

- Local Node is `v24.16.0` while the repository expects Node 22.
- `corepack pnpm` emits the corresponding engine warning locally.

## Active Task

none

## Next Recommended Task

`TASK-024 - Transaction Manager reference implementation`
