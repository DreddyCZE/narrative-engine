# Handoff: TASK-017 Entity Identity Validator

## Task

TASK-017 - Entity Identity Validator

## Status

DONE

## Summary

Implemented the production Entity Identity validator on top of TASK-016 shared JSON-safe and
canonical utilities. The validator checks contractVersion, id grammar, entityType and namespace
prefix matching, schemaVersion, optional tags, aliases, provenance, and change metadata while
rejecting unsafe payloads and forbidden keys.

## Changed Files

- `packages/engine-contracts/package.json`
- `packages/engine-contracts/tsconfig.json`
- `packages/engine-contracts/src/index.ts`
- `packages/engine-contracts/src/entity/entity-identity.ts`
- `tests/entity-identity-validator.test.ts`
- `docs/tasks/review/TASK-017-entity-identity-validator.md`
- `docs/status/CURRENT_STATE.md`
- `pnpm-lock.yaml`
- `packages/core/tsconfig.json`

## API Summary

- `inspectEntityIdentity(value)`
- `isEntityIdentity(value)`
- `assertEntityIdentity(value)`
- `EntityIdentityValidationError`
- `EntityIdentityIssue`
- `EntityIdentity`
- `EntityIdentityAlias`
- `EntityIdentityProvenance`
- `EntityIdentityChange`

## Tests

- Valid minimal identity.
- Valid identity with tags, aliases, provenance, and change metadata.
- Missing id, invalid id type, empty id, missing type, missing namespace, missing schemaVersion.
- Prefix mismatches for entityType and namespace.
- Forbidden keys, non-JSON values, and cyclic values.
- Invalid provenance and change metadata.
- Deterministic diagnostics and input immutability.
- Assertion success/failure.

## Validation

- `corepack pnpm lint` - passed.
- `corepack pnpm typecheck` - passed.
- `corepack pnpm test` - passed, 291 tests.
- `corepack pnpm build` - passed.
- `corepack pnpm validate` - passed.
- `git diff --check` - passed.

Local note: the workstation is on Node `v24.16.0`, while the repository expects Node 22. The
warning is environment debt only because all checks passed.

## Boundary Notes

- `packages/engine-contracts` imports `@narrative-engine/core` through the workspace public entry.
- Runtime code does not import docs, tests, or fixtures.
- The validator does not introduce Engine State, Condition, Effect, Command, Transaction, Domain
  Event, Save, Event Store, UI, editor, plugin, or gameplay behavior.

## Known Non-Blockers

- `TASK-018` is intentionally deferred until TASK-017 is accepted.
- Package-lock churn came from refreshing the workspace dependency link for `@narrative-engine/core`.
- The Node 22 engine pin remains unchanged by design.

## Explicit Non-Goals

- No schema compatibility helper.
- No runtime pipeline beyond the identity validator.
- No persistence or save logic.
- No UI or editor integration.
- No plugin runtime or gameplay content.

## Next Recommended Task

- `TASK-018 - Schema Versioning compatibility helper`

## Acceptance Review

Acceptance passed after PR #4 merged into `origin/main`. The validator remained within scope,
validation passed, and the task was moved to `docs/tasks/done/`.

## Active Task

none
