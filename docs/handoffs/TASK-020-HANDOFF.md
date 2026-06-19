# TASK-020 HANDOFF

## Status

DONE

## Acceptance

Accepted after TASK-020 review passed and PR #7 was merged into `origin/main`.

## Summary

TASK-020 implemented the shared validation diagnostic adapter/core model for contract validators. The
work stayed within the shared diagnostic foundation boundary and did not introduce runtime pipeline
behavior.

## Changed Files

- `docs/status/CURRENT_STATE.md`
- `docs/tasks/review/TASK-020-validation-diagnostic-adapter-core-model.md`
- `docs/handoffs/TASK-020-HANDOFF.md`
- `packages/engine-contracts/src/index.ts`
- `packages/engine-contracts/src/validation-diagnostic/validation-diagnostic.ts`
- `tests/validation-diagnostic-adapter.test.ts`

## API Summary

- `ValidationDiagnosticSeverity`
- `ValidationDiagnosticCategory`
- `ValidationDiagnostic`
- `ValidationDiagnosticInput`
- `ValidationDiagnosticIssue`
- `ValidationDiagnosticValidationError`
- `inspectValidationDiagnostic()`
- `createValidationDiagnostic()`
- `isValidationDiagnostic()`
- `assertValidationDiagnostic()`
- `normalizeValidationDiagnostics()`
- `sortValidationDiagnostics()`
- `formatValidationDiagnostic()`
- `formatValidationDiagnosticMessage()`
- `adaptJsonSafetyIssues()`
- `adaptEntityIdentityIssues()`
- `adaptSchemaVersioningIssues()`
- `adaptEngineStateIssues()`

## Tests

- valid diagnostic creation and default severity
- invalid code, severity, and path rejection
- invalid, forbidden, and cyclic details rejection
- immutability of inputs and outputs
- deterministic sorting and normalization
- adapters for JSON safety, Entity Identity, Schema Versioning, and Engine State issues
- assert helper success and failure

## Validation

- `corepack pnpm lint` - pass
- `corepack pnpm typecheck` - pass
- `corepack pnpm test` - pass, 316/316
- `corepack pnpm build` - pass
- `corepack pnpm validate` - pass
- `git diff --check` - pass

## Boundary Notes

- No Condition, Effect, Command, Transaction, Event Store, or Save system code was added.
- No UI, editor, plugin runtime, or gameplay content was added.
- The adapter only normalizes diagnostics; it does not start a runtime pipeline.
- The repository boundary checks remain green.

## Known Non-Blockers

- Local Node is `v24.16.0` while the repository expects Node 22.
- `wrong-purgatorium-vii` still exists historically but was not used.

## M2-F001 Status

deferred

`M2-F001` remains a documentation traceability mismatch in `docs/handoffs/TASK-015-HANDOFF.md` between
the validation diagnostic contract and the contract inventory for some command diagnostic labels.
TASK-020 did not need to change the inventory to complete the adapter work, so the note is left as a
deferred follow-up.

## Explicit Non-Goals

- No Condition evaluator.
- No Effect applicator.
- No Command handling.
- No Transaction Manager.
- No Domain Event materializer.
- No Event Store or Save system.
- No persistence.
- No UI/editor.
- No gameplay/P0 content.
- No plugin runtime.
- No new contract.

## Next Recommended Task

`TASK-021 - Condition evaluator`

## Active Task

none
