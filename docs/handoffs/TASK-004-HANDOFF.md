# Handoff: TASK-004 Design Entity Identity Contract

## Task

TASK-004 - Design Entity Identity Contract

## Summary

Designed the first M1 public contract draft for stable entity identity. The work added a normative
contract document, JSON Schema, valid and invalid fixtures, and focused contract tests. No runtime
entity registry, State Store, resolver, command pipeline, save migration, UI, editor, plugin
lifecycle, or concrete game entity implementation was added.

## Main Contract Decisions

- Canonical IDs are fixed three-segment ASCII strings: `<entity-type>.<namespace>.<local-name>`.
- IDs are lowercase, case-sensitive, byte-for-byte compared, and never silently normalized.
- `entityType` is stored explicitly and must match the ID prefix.
- `namespace` is the second ID segment and is part of stable identity.
- `schemaVersion` is a positive integer for the concrete entity schema and is separate from
  contract version, game package version, save format version, and entity revision.
- Tags are metadata only and do not affect identity.

## ID Grammar

```text
<entity-type>.<namespace>.<local-name>
```

- `entity-type`: `[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}`
- `namespace`: `[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,47}`
- `local-name`: `[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,79}`
- full ID length: 6 to 160 characters

## Alias Policy

- Published canonical IDs must not be silently renamed.
- Renames require an alias or migration.
- One old ID maps to one canonical ID.
- Alias self-reference, duplicate alias IDs, alias conflicts, and cycles are invalid.
- Authoring data may temporarily contain alias chains during migration, but distribution builds must
  flatten them and runtime must not resolve chains iteratively.
- Alias cycles are semantic validation because they require package-level graph checks.

## Provenance Policy

- Authoring/editor profile should include `sourceFile`, `sourceEntityId`, `taskId`, and
  `approvalState`.
- Distribution builds should include provenance when available but must not require live Git
  metadata.
- Runtime may omit provenance for bundle size, while diagnostics should preserve enough source
  mapping from build output.
- `sourceFile` must be relative and must not contain path traversal.

## Schema and Fixtures

- Schema: `schemas/entity-identity.schema.json`
- Contract: `docs/contracts/ENTITY_IDENTITY_CONTRACT.md`
- Fixtures: `tests/fixtures/contracts/entity-identity/`

Valid fixtures include minimal identity, engine namespace, non-default namespace, tags, provenance,
alias, plugin-owned namespace identity, and game-package identity examples.

Invalid fixtures include empty ID, uppercase ID, whitespace ID, invalid entity type, prefix
mismatch, duplicate tag, duplicate alias, alias self-reference, invalid schema version, unknown
field, invalid provenance, source path violations, noncanonical ordering, schema version variants,
and semantic alias cycle/chain examples.

## Tests

- `tests/entity-identity-contract.test.ts` validates fixture behavior and deterministic rules.
- Tests prove valid fixtures pass, invalid fixtures fail with expected rule IDs, canonical ID
  comparison is deterministic, tags and aliases are ordered, unknown fields fail, prefix mismatch
  fails, alias self-reference fails, duplicate values fail, stable serialization is preserved, and
  alias cycles are marked semantic validation.

## Compatibility Impact

The draft classifies ID pattern, case sensitivity, namespace semantics, alias semantics, required
fields, schema version representation, and stable ID reuse as potentially breaking changes. Future
breaking changes must follow `CONTRACT_VERSIONING_POLICY.md`.

## Security Impact

The draft addresses path traversal in `sourceFile`, ID misuse as paths/URLs/selectors, Unicode
homoglyph risk, length limits, tag and metadata injection, provenance trust limits, plugin namespace
collisions, and reserved namespace abuse.

## Deferred Decisions

- Built-in entity type registry.
- Game manifest namespace ownership.
- Plugin namespace and type registration.
- Package-level alias graph validation.
- Full reference contract.
- Generated documentation from schemas.

## Known Limits

- JSON Schema validates local identity shape only.
- Alias cycles, alias conflicts with canonical IDs, dangling references, and namespace ownership
  need future package-level validation.
- The test validator is intentionally test-scoped and is not a production schema engine.
- No external JSON Schema validation dependency was added.

## Files Changed

- `docs/contracts/ENTITY_IDENTITY_CONTRACT.md`
- `schemas/entity-identity.schema.json`
- `tests/fixtures/contracts/entity-identity/**`
- `tests/entity-identity-contract.test.ts`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/review/TASK-004-design-entity-identity-contract.md`
- `docs/handoffs/TASK-004-HANDOFF.md`

## Checks

- `corepack pnpm lint` - passed.
- `corepack pnpm typecheck` - passed.
- `corepack pnpm test` - passed, 25 tests.
- `corepack pnpm build` - passed.
- `corepack pnpm check:boundaries` - passed.
- `corepack pnpm validate` - passed.
- `git diff --check` - passed.

Local note: Node `v24.16.0` emitted the expected engine warning because the project is pinned to
Node 22. The pin was not changed.

## Recommended Next Task

Create a precise task for Schema Versioning Contract design.
