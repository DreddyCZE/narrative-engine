# TASK-031 HANDOFF

## Status

REVIEW

## Summary

TASK-031 defines the first content validation diagnostic adapter contract for M3. The work stays at
the contract and diagnostic boundary only. It adds content-specific diagnostic taxonomy, severity
policy, deterministic path and ordering rules, mapping guidance into the generic Validation
Diagnostic Contract, neutral examples, and explicit non-goals.

## Changed Files

- `docs/contracts/CONTENT_VALIDATION_DIAGNOSTICS.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/handoffs/TASK-031-HANDOFF.md`
- `docs/planning/M3_DATA_MODEL_CONTENT_RUNTIME_BOUNDARY.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/review/TASK-031-content-validation-diagnostic-adapters.md`

## Diagnostic Contract Location

- `docs/contracts/CONTENT_VALIDATION_DIAGNOSTICS.md`

## Validation

- `corepack pnpm lint` - pass
- `corepack pnpm typecheck` - pass
- `corepack pnpm test` - pass, 22 test files / 381 tests
- `corepack pnpm build` - pass
- `corepack pnpm validate` - pass
- `git diff --check` - pass

## Non-Goals

- no loader implementation
- no content graph resolver
- no cross-reference resolver implementation
- no schema validation engine
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime

## Risks / Open Questions

- future helper shape is still deferred
- exact content diagnostic batch budget policy remains open
- source-kind vocabulary may need refinement once content-model packages exist
- cross-reference validation integration remains future work

## Next Recommended Task

- `TASK-032 - Cross-reference validation for content packages`

## Active Task

none
