# TASK-021 HANDOFF

## Status

REVIEW

## Summary

TASK-021 adds the readonly Condition evaluator for the contract layer. The implementation stays
inside the M2B state read/write primitive boundary and does not introduce any effect, command,
transaction, event store, save, UI, or plugin runtime behavior.

## Changed Files

- `docs/status/CURRENT_STATE.md`
- `docs/tasks/review/TASK-021-condition-evaluator.md`
- `docs/handoffs/TASK-021-HANDOFF.md`
- `packages/engine-contracts/src/condition/condition.ts`
- `packages/engine-contracts/src/index.ts`
- `tests/condition-evaluator.test.ts`

## API Summary

- `CONDITION_CONTRACT_VERSION`
- `CONDITION_SCHEMA_ID`
- `CONDITION_SCHEMA_VERSION`
- `ConditionComparisonOperator`
- `ConditionType`
- `ConditionEvaluationIssueCode`
- `ConditionEvaluationIssue`
- `ConditionEvaluationContext`
- `ConditionEvaluationOptions`
- `ConditionEvaluationResult`
- `inspectCondition()`
- `evaluateCondition()`
- `formatConditionEvaluationIssues()`

## Supported Operators

- `all`
- `any`
- `not`
- `constant`
- `exists`
- `compare`
- `contains`
- `entity-is`
- `domain-exists`
- `condition-ref`

## Unsupported / Deferred

- Any operator or selector form not defined by the contract is rejected.
- Effect application, command planning, transaction handling, event materialization, save,
  persistence, UI, and plugin runtime remain out of scope.

## Tests

- valid and invalid condition shapes
- non-JSON and forbidden-key rejection
- selector validation and missing-state-path handling
- supported operator evaluation
- named condition reference resolution and cycles
- deterministic results and input immutability
- stable diagnostic path reporting

## Validation

- `corepack pnpm lint` - pass
- `corepack pnpm typecheck` - pass
- `corepack pnpm test` - pass, 325/325
- `corepack pnpm build` - pass
- `corepack pnpm validate` - pass
- `git diff --check` - pass

## Boundary Notes

- The evaluator uses the JSON-safe utilities and contract validators only through public exports.
- No docs, tests, fixtures, UI, save, event store, or transaction code is imported by the
  production evaluator.
- No runtime pipeline was introduced.

## Known Non-Blockers

- Local Node is `v24.16.0` while the repository expects Node 22.
- The old incorrect remote still exists historically but was not used.
- `M2-F001` remains deferred.

## Explicit Non-Goals

- No Effect applicator.
- No Command handling.
- No Transaction Manager.
- No Domain Event materializer.
- No Event Store or Save system.
- No persistence.
- No UI/editor.
- No gameplay/P0 content.
- No plugin runtime.

## Next Recommended Task

`TASK-022 - Effect applicator`

## Active Task

none
