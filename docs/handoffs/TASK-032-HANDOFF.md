# TASK-032 HANDOFF

## Status

REVIEW

## Summary

TASK-032 defines the first cross-reference validation contract for content packages in M3. The work
stays at the contract boundary only. It adds reference models, scope rules, duplicate-ID
expectations, missing and unresolved reference diagnostics, deterministic traversal rules, mapping
into content validation diagnostics, neutral examples, and explicit non-goals.

## Changed Files

- `docs/contracts/CONTENT_REFERENCE_VALIDATION.md`
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/handoffs/TASK-032-HANDOFF.md`
- `docs/planning/M3_DATA_MODEL_CONTENT_RUNTIME_BOUNDARY.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/review/TASK-032-cross-reference-validation-content-packages.md`

## Reference Validation Contract Location

- `docs/contracts/CONTENT_REFERENCE_VALIDATION.md`

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
- no schema validation engine
- no runtime execution
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime

## Risks / Open Questions

- package-global versus section-qualified identity may need tighter rules in later tasks
- cycle handling is intentionally deferred beyond stable diagnostic reporting
- future dependency-reference grammar still needs one canonical shape
- loader-boundary tasks will need to decide how validated references become graph edges without
  widening runtime scope

## Next Recommended Task

- `TASK-033 - Minimal neutral content package fixture`

## Active Task

none
