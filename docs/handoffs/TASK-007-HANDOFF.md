# TASK-007 HANDOFF

## Summary

TASK-007 defines the `Condition Contract` as a public, versioned, fail-closed, deterministic predicate
system that reads committed Engine State and returns either a resolved boolean or an explicit error.

## Main Decisions

- Condition is pure read-only logic and cannot mutate Engine State.
- Named conditions may use canonical Entity IDs; inline conditions remain anonymous.
- Condition evaluation returns a structured result model with `resolved` and `error`.
- Fail-closed behavior is mandatory for runtime decisions.
- Condition selectors are constrained to `domainId` + safe relative `path`.
- `all`, `any`, and `not` are the first composition operators.
- Atomic condition types are limited to `constant`, `exists`, `compare`, `contains`, `entity-is`,
  `domain-exists`, and `condition-ref`.
- Condition references are declarative and cyclic graphs are semantic blockers.
- Canonical serialization is deterministic and stable for Git diff review.

## Files Changed

- `docs/contracts/CONDITION_CONTRACT.md`
- `schemas/condition.schema.json`
- `tests/condition-contract.test.ts`
- `tests/fixtures/contracts/condition/**`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-007-design-condition-contract.md`
- `docs/handoffs/TASK-007-HANDOFF.md`

## Test Fixtures

- 12 valid fixtures
- 14 invalid fixtures
- 10 semantic-invalid fixtures

## Test Results

- `corepack pnpm lint` passed
- `corepack pnpm typecheck` passed
- `corepack pnpm test` passed, 102 tests total
- `corepack pnpm build` passed
- `corepack pnpm check:boundaries` passed
- `corepack pnpm validate` passed
- `git diff --check` passed

## Known Limits

- The schema validates the condition envelope and discriminated forms, not runtime availability of state paths.
- Semantic checks for reference acyclicity, access control, and budget overflow remain test-scoped.
- No production resolver, registry, or scripting engine was introduced.

## Risks

- Overly broad selectors could expose internals if future resolver code is careless.
- Fail-open handling would undermine gated gameplay and editor previews.
- Referenced condition graphs must remain acyclic and bounded.

## Deferred Decisions

- Runtime condition registry implementation.
- Capability and permission enforcement.
- Regex-based matching and any future advanced operator families.
- Additional condition types for game-specific domains.

## Recommended Next Step

Create the precise design task for the Effect Contract.
