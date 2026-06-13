# Handoff: TASK-005 Design Schema Versioning Contract

## Task

TASK-005 - Design Schema Versioning Contract

## Summary

Designed the draft M1 Schema Versioning Contract. The work defines `schemaVersion` as a positive
integer scoped to a schema ID, separates it from other project version types, and adds descriptor
schema, fixtures, and focused contract tests. No runtime Schema Registry, migration runner, save
system, Entity Registry, State Store, command pipeline, UI, editor, or plugin runtime was added.

## Main Contract Decisions

- Contract ID: `schema-versioning`.
- Contract version: `schema-versioning@0.1.0`.
- `schemaVersion` is a JSON integer from `1` to `2147483647`.
- Schema versions are scoped by global lowercase `schemaId`; the canonical schema key is
  `<schema-id>@<schema-version>`.
- One schema key identifies one serialized shape and meaning.
- One schema descriptor represents a logical schema and contains numerically sorted `versions`
  entries.
- Contract version, schema version, package version, engine version, game package version, save
  format version, plugin API version, and content revision are distinct.
- Future schema registry records are source declarations plus a build-time generated index.

## Schema Version Model

- Version `1` is the first version of a schema ID.
- Versions are monotonic and must not be reused for another shape or meaning.
- Different schema IDs may use the same integer value independently.
- Skipped integers are allowed only with documented rationale.
- Minor and patch meaning is not encoded in `schemaVersion`.
- Removed versions remain tombstones and must not be recycled.

## Compatibility Model

Compatibility status values:

- `EXACT`
- `READABLE`
- `MIGRATION_REQUIRED`
- `UNSUPPORTED_NEWER`
- `UNSUPPORTED_OLDER`
- `INVALID_VERSION`
- `MISSING_SCHEMA`

Priority is `MISSING_SCHEMA`, `INVALID_VERSION`, `EXACT`, `READABLE`, `MIGRATION_REQUIRED`,
`UNSUPPORTED_NEWER`, then `UNSUPPORTED_OLDER`. Forward-compatible reading is not assumed. Unknown
newer versions must not be silently interpreted or overwritten.

## Reader and Writer Policy

- Readers declare `schemaId`, `minVersion`, and `maxVersion`.
- Current support is a contiguous range and every integer version inside it must have a version
  entry.
- Writers normally emit the current canonical writer version.
- `writerVersion` must be inside the declared reader support range.
- `writerVersion` must match an existing version entry.
- Production writers must not emit draft versions.
- Downgrade export is not implicit and remains a future explicit profile.
- Missing `schemaVersion` is invalid unless a future legacy import profile says otherwise.

## Migration Metadata

Migration descriptors define:

- `migrationId`
- `schemaId`
- `fromVersion`
- `toVersion`
- `direction`
- `deterministic`
- `lossy`
- `lossDescription`, required when `lossy` is true
- `requiresContext`

Upgrade paths must be deterministic, validated after each step, and must not silently change stable
entity IDs. Migration metadata is declarative and cannot contain executable JavaScript,
TypeScript, shell code, or dynamic expressions.

Skip migrations may exist, but a descriptor must not define ambiguous canonical paths to the writer
version. Graph cycles, duplicate migration IDs, duplicate edges, missing endpoints, and missing
steps are semantic errors.

## Deprecation Policy

- Deprecated schema versions must document replacement or rationale.
- Public schema versions must not be removed silently.
- Removed versions remain tombstone metadata.
- Reader and migration support should survive until an incompatible major contract/package
  milestone or ADR-backed removal.
- Deprecated fixtures should remain while the version is accepted or migratable.

## Schema and Fixtures

- Contract: `docs/contracts/SCHEMA_VERSIONING_CONTRACT.md`
- Schema: `schemas/schema-versioning.schema.json`
- Fixtures: `tests/fixtures/contracts/schema-versioning/`

Valid fixtures:

- `schema-version-1.json`
- `reader-exact.json`
- `reader-range.json`
- `writer-current.json`
- `migration-upgrade.json`
- `migration-lossy.json`
- `deprecated-schema.json`

Invalid fixtures:

- `schema-version-zero.json`
- `schema-version-negative.json`
- `schema-version-decimal.json`
- `schema-version-string.json`
- `reader-min-greater-than-max.json`
- `writer-outside-range.json`
- `migration-same-from-to.json`
- `downgrade-marked-upgrade.json`
- `unknown-field.json`
- `missing-schema-id.json`
- `invalid-status.json`
- `lossy-migration-without-description.json`
- `lossy-false-with-description.json`
- `downgrade-marked-downgrade-wrong-way.json`
- `migration-schema-id-mismatch.json`

Semantic-invalid fixtures:

- `migration-cycle.json`
- `missing-upgrade-step.json`
- `duplicate-schema-version.json`
- `reused-version-different-hash.json`
- `reader-range-missing-inner-version.json`
- `writer-version-missing-entry.json`
- `ambiguous-canonical-path.json`
- `removed-version-reused.json`
- `production-writer-draft-version.json`

## Tests

- `tests/schema-versioning-contract.test.ts`
- Test suite result during final review: 37 tests passed, including 12 Schema Versioning tests.
- Tests prove valid fixtures pass, invalid fixtures fail with expected rule IDs, semantic graph
  issues are detected, version rules are positive bounded integers, compatibility status priority is
  deterministic, reader/writer ranges are consistent, migration direction is validated, graph cycles,
  missing steps, ambiguous paths, missing version entries, and version reuse are detected,
  serialization is stable and idempotent, and Entity Identity `schemaVersion` remains compatible.

## Compatibility Impact

The draft classifies schema shape and semantic meaning changes that require `schemaVersion`
increments. It follows `CONTRACT_VERSIONING_POLICY.md` and does not modify Entity Identity unless a
future contradiction is found.

## Security Impact

The draft caps version integers, warns about denial of service from huge migration graphs, forbids
executable migration declarations, treats metadata as untrusted, and identifies downgrade attacks as
an explicit compatibility risk.

## Deferred Decisions

- Sparse reader support lists.
- Exact registry file location and generation command.
- Schema hash or signature policy.
- Legacy import profiles for missing `schemaVersion`.
- Save-format-specific retention window.
- Plugin API schema declaration details.

## Known Limits

- JSON Schema validates local descriptor shape only.
- Reader range comparison, writer support, graph cycles, missing steps, duplicate schema keys,
  ambiguous canonical paths, missing version entries, draft production writer use, and reused
  versions are semantic validation in tests.
- No external JSON Schema validation dependency was added.
- No runtime registry or migration runner exists.

## Files Changed

- `docs/tasks/done/TASK-005-design-schema-versioning-contract.md`
- `docs/contracts/SCHEMA_VERSIONING_CONTRACT.md`
- `schemas/schema-versioning.schema.json`
- `tests/schema-versioning-contract.test.ts`
- `tests/fixtures/contracts/schema-versioning/**`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/status/CURRENT_STATE.md`
- `docs/handoffs/TASK-005-HANDOFF.md`

## Checks

- `corepack pnpm lint` - passed during final review.
- `corepack pnpm typecheck` - passed during final review.
- `corepack pnpm test` - passed during final review, 37 tests.
- `corepack pnpm build` - passed during final review.
- `corepack pnpm check:boundaries` - passed during final review.
- `corepack pnpm validate` - passed during final review.
- `git diff --check` - passed during final review.

Local note: checks use `corepack pnpm`. Local Node is expected to emit the Node 24 warning because
the project is pinned to Node 22.

## Recommended Next Step

Create a precise design task for Engine State Contract. Do not start it automatically.
