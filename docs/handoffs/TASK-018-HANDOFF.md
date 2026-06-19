# Handoff: TASK-018 Schema Versioning Compatibility Helper

## Task

TASK-018 - Schema Versioning Compatibility Helper

## Status

DONE

## Summary

Accepted TASK-018 and moved it to DONE. The production Schema Versioning compatibility helper
remains in place on top of TASK-016 shared JSON-safe and canonical utilities. It validates schema
descriptors, compares schema versions, and derives compatibility outcomes for exact, readable,
migration-required, unsupported-newer, unsupported-older, invalid-version, and missing-schema
cases without introducing a migration runner or persistence layer.

## Changed Files

- `packages/engine-contracts/src/schema-versioning/schema-versioning.ts`
- `packages/engine-contracts/src/index.ts`
- `packages/engine-contracts/src/entity/entity-identity.ts`
- `tests/schema-versioning-helper.test.ts`
- `docs/tasks/done/TASK-018-schema-versioning-compatibility-helper.md`
- `docs/status/CURRENT_STATE.md`

## API Summary

- `inspectSchemaVersionDescriptor(value)`
- `isSchemaVersionDescriptor(value)`
- `assertSchemaVersionDescriptor(value)`
- `compareSchemaVersions(left, right)`
- `checkSchemaCompatibility(descriptor, schemaVersion)`
- `formatSchemaVersioningValidationMessage(issues)`
- `SchemaVersioningValidationError`
- `SchemaCompatibilityResult`
- `SchemaCompatibilityStatus`
- `SchemaDescriptor`
- `SchemaVersionEntry`
- `SchemaMigration`
- `SchemaReaderSupport`

## Tests

- Valid descriptors using the schema-versioning contract fixtures.
- Readable, migration-required, unsupported-newer, unsupported-older, invalid-version, and
  missing-schema compatibility outcomes.
- Stable diagnostics paths and deterministic results.
- Assertion success/failure.
- Input immutability and no migration side effects.

## Validation

- `corepack pnpm lint` - passed.
- `corepack pnpm typecheck` - passed.
- `corepack pnpm test` - passed, 299 tests.
- `corepack pnpm build` - passed.
- `corepack pnpm validate` - passed.
- `git diff --check` - passed.

Local note: the workstation is on Node `v24.16.0`, while the repository expects Node 22. The
warning is environment debt only because all checks passed.

## Boundary Notes

- `packages/engine-contracts` imports `@narrative-engine/core` through the workspace public entry.
- Runtime code does not import docs, tests, or fixtures.
- The helper does not introduce Engine State, Condition, Effect, Command, Transaction, Domain
  Event, Save, Event Store, UI, editor, plugin, or gameplay behavior.

## Known Non-Blockers

- `TASK-019` is intentionally deferred until TASK-018 is accepted.
- Package-lock churn came from the workspace package wiring already established for
  `@narrative-engine/core`.
- The Node 22 engine pin remains unchanged by design.

## Explicit Non-Goals

- No Engine State validator.
- No save migration or persistence logic.
- No UI or editor integration.
- No plugin runtime or gameplay content.
- No migration runner.

## Next Recommended Task

- `TASK-019 - Engine State shape and snapshot validator`

## Active Task

none
