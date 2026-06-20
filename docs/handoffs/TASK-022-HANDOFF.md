# TASK-022 HANDOFF

## Status

DONE

## Acceptance

TASK-022 was accepted after PR #9 merged into `origin/main`.

## Summary

TASK-022 adds a deterministic production Effect applicator in the contract layer. It applies
supported effect envelopes to a cloned candidate Engine State snapshot, preserves input
immutability, and returns stable diagnostics without introducing command, transaction, event,
save, UI, or runtime pipeline behavior.

## Changed Files

- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-022-effect-applicator.md`
- `docs/handoffs/TASK-022-HANDOFF.md`
- `packages/engine-contracts/src/effect/effect.ts`
- `packages/engine-contracts/src/index.ts`
- `tests/effect-applicator.test.ts`

## API Summary

- `EFFECT_CONTRACT_VERSION`
- `EFFECT_SCHEMA_ID`
- `EFFECT_SCHEMA_VERSION`
- `EffectType`
- `EffectApplicationStatus`
- `EffectApplicationIssueCode`
- `EffectApplicationIssue`
- `EffectChange`
- `EffectTarget`
- `EffectApplicationOptions`
- `EffectApplicationResult`
- `EffectEnvelope`
- `inspectEffect()`
- `applyEffect()`
- `formatEffectApplicationIssues()`

## Supported Effect Operators

- `set`
- `unset`
- `increment`
- `append`
- `remove-at`
- `add-unique`
- `remove-value`

## Unsupported / Deferred

- Any effect type or target shape not defined by the contract is rejected.
- Command handling, transaction handling, event materialization, event storage, save systems,
  persistence, UI/editor, plugin runtime, and gameplay/P0 content remain out of scope.
- TASK-023 was not created or activated.

## Tests

- valid and invalid effect envelopes
- supported operator application and no-op behavior
- deterministic candidate-state updates
- input immutability
- path resolution and invalid path rejection
- non-JSON and forbidden-key rejection
- stable diagnostics for applied, skipped, no-op, and error outcomes

## Validation

- `corepack pnpm lint` - pass
- `corepack pnpm typecheck` - pass
- `corepack pnpm test` - pass, 18 test files / 336 tests
- `corepack pnpm build` - pass
- `corepack pnpm validate` - pass
- `git diff --check` - pass

## Boundary Notes

- The applicator operates only on cloned candidate state snapshots.
- No command planning, transaction management, event materialization, save pipeline, UI, or
  plugin runtime behavior was introduced.
- The implementation stays inside the contract layer and uses the existing JSON-safe helpers and
  condition evaluator contract only through public exports.

## Known Non-Blockers

- Local Node is `v24.16.0` while the repository expects Node 22.
- `corepack pnpm` emits the corresponding engine warning locally.

## Explicit Non-Goals

- No Command handling.
- No Transaction Manager.
- No Domain Event materializer.
- No Event Store or Save system.
- No persistence.
- No UI/editor.
- No gameplay/P0 content.
- No plugin runtime.

## Next Recommended Task

`TASK-023 - Command planning boundary/reference handlers`

## Active Task

none
