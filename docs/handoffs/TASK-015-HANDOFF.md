# Handoff: TASK-015 Plan M2 Reference Runtime Implementation

## Task

TASK-015 - Plan M2 Reference Runtime Implementation

## Status

DONE

Acceptance review passed.

## Outcome

`READY_FOR_M2A`

The first M2 implementation task can safely begin with shared JSON-safe and canonical
serialization utilities. The plan is constrained to documentation and governance only; no runtime
implementation was started.

## Summary

TASK-015 established the M2 planning boundary after the M1 Contract Foundation PASS. The task
produced the M2 reference runtime plan, the implementation sequence, package/runtime boundaries,
and a recheck of deferred decisions against the M2 cut.

The plan deliberately keeps the first implementation slice in memory and separates it from UI,
Save, Event Store, plugin, telemetry, localization, networking, and gameplay scope.

## Key Planning Decisions

- First safe M2 task: shared JSON-safe and canonical serialization utilities.
- M2 should be implemented as a narrow reference runtime, not a monolithic engine.
- The existing packages provide the right boundaries for the first slices:
  - `packages/engine-contracts`
  - `packages/validation`
  - `packages/engine-state`
  - `packages/engine-rules`
  - `packages/engine-kernel`
  - `packages/test-support`
- `packages/test-support` remains test-only and must not become a production dependency.
- `docs`, `tests`, and fixtures are reference material, not runtime inputs.
- Save/persistence, Event Store, plugins, UI, and gameplay content remain deferred.

## Findings

| ID | Severity | Evidence | Impact | Recommendation | Blocks M2A | Proposed task |
| --- | --- | --- | --- | --- | --- | --- |
| M2-F001 | NOTE | `docs/contracts/VALIDATION_DIAGNOSTIC_CONTRACT.md` and `docs/contracts/CONTRACT_INVENTORY.md` still diverge on some command diagnostic code labels (`PRECONDITION_FALSE`, `PRECONDITION_ERROR`, `DUPLICATE_COMMAND` vs `PRECONDITION_FAILED`, `COMMAND_REJECTED`). | Traceability drift remains visible to future runtime planning and may confuse code-to-inventory mapping. | Reconcile the diagnostic inventory labels in a dedicated documentation-only follow-up if later M2 work depends on the exact command code set. | No | Future diagnostic inventory remediation task |

## Mandatory Outputs

- `docs/planning/M2_REFERENCE_RUNTIME_PLAN.md`
- `docs/planning/M2_IMPLEMENTATION_SEQUENCE.md`
- `docs/planning/M2_RUNTIME_BOUNDARIES.md`
- `docs/planning/M2_DEFERRED_DECISIONS_RECHECK.md`
- `docs/handoffs/TASK-015-HANDOFF.md`

## Validation

- `corepack pnpm lint` - passed.
- `corepack pnpm typecheck` - passed.
- `corepack pnpm test` - passed.
- `corepack pnpm build` - passed.
- `corepack pnpm validate` - passed.
- `git diff --check` - passed.

Local note: the workstation is on Node `v24.16.0`, while the repository expects Node 22. The
warning is unchanged and was treated as environment debt, not a blocker.

## Repository / Workflow State

- TASK-015 is now in `docs/tasks/done/`.
- No ACTIVE task remains.
- `docs/status/CURRENT_STATE.md` was updated to reflect accepted M2 planning state.
- No commit was created by the review itself.
- No runtime implementation was started.
- No new domain contract was created.

## Next Step

Recommended first M2 task:

- `TASK-016 - Shared JSON-safe and canonical serialization utilities`

Create and activate the first M2A implementation task explicitly. Do not start runtime work before
that step.
