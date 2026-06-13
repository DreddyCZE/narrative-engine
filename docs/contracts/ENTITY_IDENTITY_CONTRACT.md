# Entity Identity Contract

## Status

DRAFT

## Contract ID

`entity-identity`

## Contract Version

`entity-identity@0.1.0`

This is the first M1 draft. It is public but not yet accepted or stable. TASK-004 review may accept
the draft as the current M1 output, but that does not promote the contract to `stable` or `1.0.0`.
Compatibility guarantees begin only after a later review explicitly marks the contract `stable`.

## Owner

`packages/engine-contracts`; architecture and contract owners.

## Purpose

Entity Identity defines the stable identity envelope shared by all versioned entities in the
project. It applies to future rooms, NPCs, scenes, dialogues, quests, facts, items, portals,
assets, plugin-defined entities, and similar records without defining the schemas for those
systems.

This contract does not implement a runtime registry, reference resolver, state store, command
pipeline, or editor workflow.

## Normative Terms

The terms MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are normative:

- MUST and MUST NOT define required behavior.
- SHOULD and SHOULD NOT define expected behavior with documented exceptions.
- MAY defines explicitly permitted behavior.

## Terminology

- **Canonical ID:** The stable text ID stored on an entity and used for equality.
- **Entity type:** A stable lowercase type marker such as `room`, `npc`, or a plugin-declared type.
- **Namespace:** The second ID segment that scopes ownership and collision handling.
- **Local name:** The third ID segment that names an entity inside a namespace and type.
- **Published ID:** Any canonical ID that has appeared in released game data, saves, event logs, or
  public fixtures.
- **Alias:** A compatibility record mapping one previous ID to one current canonical ID.
- **Provenance:** Metadata that links an entity back to an authoring, generated, or build source.
- **Canonical JSON:** Deterministically formatted JSON data used for review, fixtures, validation,
  and future build input.

## Identity Shape

Every identity-bearing entity MUST include at least:

```json
{
  "contractVersion": "entity-identity@0.1.0",
  "id": "room.demo.start",
  "entityType": "room",
  "namespace": "demo",
  "schemaVersion": 1
}
```

The canonical JSON key order SHOULD be:

1. `contractVersion`
2. `id`
3. `entityType`
4. `namespace`
5. `schemaVersion`
6. `tags`
7. `aliases`
8. `provenance`
9. `change`

Fields not listed by this contract MUST NOT appear in the identity envelope. Future entity-specific
schemas MAY wrap this envelope or compose it, but unknown fields inside the identity envelope are a
validation error.

## Stable ID Rules

### Data Type

Canonical IDs MUST be JSON strings.

### Syntax

The canonical ID format is fixed at exactly three dot-separated segments:

```text
<entity-type>.<namespace>.<local-name>
```

The contract intentionally chooses a fixed three-segment form because it is easy to validate,
compare, index, and explain in diagnostics. A variable segment count would push package hierarchy,
world hierarchy, and implementation ownership into identity parsing. Hierarchies, episode markers,
module names, and package structure MUST be represented inside `namespace`, `local-name`, tags, or
entity-specific schemas instead of adding extra ID segments.

The namespace segment is mandatory even for engine and tooling entities. This keeps every identity
record in the same shape, prevents special-case parsers, and makes ownership explicit. Reserved
namespaces such as `engine` and `tooling` are still namespaces; they are not omitted.

### Characters and Length

- IDs MUST use ASCII only.
- IDs MUST be lowercase.
- IDs MUST NOT contain whitespace.
- IDs MUST NOT contain leading, trailing, or repeated `.` separators.
- `entity-type` MUST match `[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}`.
- `namespace` MUST match `[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,47}`.
- `local-name` MUST match `[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,79}`.
- Full ID length MUST be at least 6 and MUST NOT exceed 160 characters.
- One-character entity types and namespaces are intentionally forbidden. Two or more characters keep
  diagnostics readable and avoid overly dense abbreviations.
- Leading and trailing hyphens are forbidden in `entity-type` and `namespace`.
- Consecutive hyphens are forbidden in `entity-type` and `namespace`.
- `local-name` MAY use underscores because local names often come from authored slugs where
  underscore-separated words are easier to scan. `entity-type` and `namespace` remain stricter
  because they carry ownership and taxonomy.
- `local-name` MUST NOT end with `_` or `-`.
- Consecutive `_` or `-` separators are forbidden in `local-name`.
- The 160 character maximum is enforced directly on the whole ID and indirectly by segment limits.

Unicode is forbidden in canonical IDs to avoid homoglyph ambiguity, filesystem surprises, and
locale-dependent comparison behavior. Localized display names belong in Localization, not IDs.

### Canonical Form and Comparison

- Canonical form is the exact stored string.
- Consumers MUST compare IDs byte-for-byte after JSON string decoding.
- Consumers MUST NOT lowercase, trim, normalize Unicode, or otherwise rewrite IDs at comparison
  time.
- A non-canonical but parseable ID is invalid; it is not silently repaired.

### Serialization

IDs MUST serialize as JSON strings and MUST NOT be used as unescaped file paths, URLs, HTML IDs, CSS
selectors, SQL fragments, shell arguments, or DOM selectors.

## Entity Type Rules

- `entityType` MUST be stored explicitly.
- `entityType` MUST equal the first segment of `id`.
- A mismatch between `entityType` and the ID prefix is a blocker validation error.
- Built-in entity types are reserved by the engine contract owner.
- Game packages MAY use built-in entity types once their specific schemas exist.
- Plugins MAY declare new entity types in their future plugin manifest.
- A plugin MUST NOT redefine a built-in entity type.

This contract does not create a type registry or plugin registry. Entity type ownership,
registration, plugin-provided type definitions, and collision handling are deferred to a future Type
Registry or Plugin Contract. Entity type names identify the kind of entity; they MUST NOT encode the
implementation owner unless that is later required by a dedicated registry contract.

## Namespace Rules

Namespace is part of stable identity.

- `namespace` MUST equal the second ID segment.
- Namespace changes are identity changes.
- Published namespace changes require alias records or migrations.
- `engine` is reserved for engine-owned contract fixtures and internal neutral examples.
- `tooling` is reserved for generated tooling fixtures and diagnostics.
- Namespaces beginning with `plugin-` are reserved for plugin packages.
- Game package namespaces MUST be original, lowercase, and project-local.
- A namespace collision across packages is a validation error unless a future manifest explicitly
  declares a shared namespace ownership model.

These reserved namespace rules are intentionally minimal. The contract does not claim to know every
future reserved namespace and does not define a game manifest or plugin namespace registry. It
defines the identity rules those future contracts must enforce.

## Schema Version Rules

Do not confuse these versions:

- `contractVersion`: Entity Identity Contract version, for example `entity-identity@0.1.0`.
- `schemaVersion`: positive integer version of the concrete entity type schema.
- Entity revision: optional stable authoring/change counter in `change.revision`.
- Game package version: version of a full game package, outside this contract.
- Save format version: version of persisted play state, outside this contract.

`schemaVersion` MUST be an integer greater than or equal to 1. Version `1` is the first version of a
concrete entity type schema. Decimal numbers, negative numbers, zero, and strings are invalid. It
MUST NOT be a semantic version string. Future entity-specific schemas MAY define their own
compatibility matrices.

## Tag Rules

- Tags MUST be JSON strings.
- Tags MUST use ASCII lowercase canonical form.
- Tags MUST match `[a-z][a-z0-9-]{1,31}`.
- Tags MUST NOT contain whitespace.
- Tags MUST be unique after exact byte-for-byte comparison.
- Tags MUST be sorted lexicographically in canonical JSON.
- Tag order MUST NOT affect meaning.
- Tags MUST NOT affect entity equality or stable identity.
- An entity SHOULD NOT define more than 32 tags.

Tags are classification metadata. They are not a namespace, type, or alias system.

## Source Provenance Policy

The `provenance` block MAY appear in canonical source data and SHOULD appear in generated or
compiled data when the information exists.

```json
{
  "sourceFile": "games/demo/entities/rooms.json",
  "sourceEntityId": "room.demo.start",
  "sourceRevision": "content-v1",
  "sourceLine": 12,
  "generatedBy": "manual",
  "taskId": "TASK-004",
  "commit": "6e874df",
  "approvalState": "approved"
}
```

### Authoring and Editor Profile

Authoring/editor data SHOULD include:

- `sourceFile`
- `sourceEntityId`
- `taskId`
- `approvalState`

`sourceLine`, `generatedBy`, `sourceRevision`, and `commit` MAY be present when known.

### Distribution Build Profile

Distribution builds SHOULD include provenance when it is available without requiring live Git
metadata. A distribution build MUST NOT fail only because `commit` is absent.

### Runtime Profile

Runtime MAY omit provenance to reduce bundle size. Runtime diagnostics SHOULD preserve enough source
mapping from the build pipeline to identify the problematic source entity.

### Provenance Field Rules

- `sourceFile` MUST be a relative, slash-separated path when present.
- `sourceFile` MUST use canonical `/` separators.
- `sourceFile` MUST NOT be absolute.
- `sourceFile` MUST NOT start with a Windows drive prefix.
- `sourceFile` MUST NOT contain `.` or `..` path segments.
- `sourceFile` MUST NOT contain NUL.
- `sourceFile` MUST NOT exceed 240 characters.
- `sourceEntityId` SHOULD be an Entity Identity ID when it names another identity-bearing source.
- `sourceRevision`, `generatedBy`, and `taskId` MUST be stable strings when present.
- `commit` MUST be a 7 to 40 character lowercase hexadecimal Git commit when present.
- `approvalState` MUST be one of `draft`, `ai-draft`, `human-edited`, `approved`, or `canonical`.

Provenance is evidence, not authority. Consumers MUST NOT trust provenance as proof that data is
safe or approved without validation and review policy. `commit` is diagnostic metadata only unless
an external Git verification process confirms it.

## Change Metadata Policy

The optional `change` block is for deterministic authoring metadata:

```json
{
  "revision": 3,
  "createdBy": "author.content",
  "updatedBy": "author.content"
}
```

- `change.revision` MAY appear in canonical data and MUST be a positive integer.
- `createdBy` and `updatedBy` MAY appear if they are stable actor IDs.
- `createdAt` and `updatedAt` MUST NOT appear in canonical runtime data because timestamps create
  noisy diffs and nondeterministic builds.
- Editors MAY store timestamps in editor-only draft metadata outside the identity envelope.
- Build tools MAY generate timestamps in reports, not in canonical identity records.
- A build MUST NOT generate a new timestamp only because a file was reserialized.
- Change metadata is not part of entity identity or equality.
- Distribution builds MAY strip editor-only change metadata when it is not needed for diagnostics.

## Alias and Rename Rules

Aliases preserve compatibility after published ID changes. TASK-004 uses identity-local alias
representation: each canonical entity contains the list of its previous IDs. This is not a global
resolver and does not implement a repository-wide alias map.

```json
[
  {
    "id": "room.demo.start",
    "reason": "renamed",
    "sinceSchemaVersion": 2
  }
]
```

- A published canonical ID MUST NOT be silently renamed.
- Renaming a published canonical ID MUST provide an alias or a migration.
- An alias record maps one previous ID to the current canonical ID that contains it.
- One old ID MUST NOT point to more than one canonical ID.
- Alias `id` MUST be a valid Entity Identity ID.
- Alias `id` MUST NOT equal the current canonical `id`.
- Alias `id` SHOULD have the same entity type as the current canonical ID unless a migration
  explicitly documents a type split.
- Alias records SHOULD be sorted lexicographically by `id`.
- Duplicate alias IDs are validation errors.
- Authoring data MAY temporarily contain alias chains during migration work, but a validated
  distribution build MUST flatten aliases directly to canonical IDs.
- Runtime MUST NOT resolve alias chains iteratively.
- Alias cycles are blocker semantic validation errors.
- An alias MUST NOT conflict with any canonical ID in the same validated package.
- Removed aliases are potentially breaking and require compatibility review.
- Reusing an old alias for a different meaning is forbidden.

JSON Schema can validate alias shape and exact duplicate objects. Duplicate alias IDs are also
checked by contract tests. Alias conflicts with canonical IDs, alias reuse across entities, alias
chains, and cycles are semantic validation rules that require package-level validation.

## Equality and References

- Entity equality is determined by canonical ID.
- `entityType` is redundant for equality but MUST match the ID prefix to catch corrupt data.
- References MAY contain only `id` when the expected type is obvious from schema context.
- References SHOULD contain both `id` and expected `entityType` when crossing subsystem boundaries.
- Dangling references are semantic validation errors.
- References through aliases MAY be accepted during migration, but build output SHOULD normalize
  references to canonical IDs.

This contract does not implement a reference resolver.

## Canonical JSON Serialization

Canonical JSON MUST be deterministic:

- UTF-8 JSON.
- Line endings follow the repository formatter; canonical fixtures use LF.
- No executable code.
- No comments.
- Two-space indentation.
- Final newline.
- Stable key order as defined by this contract.
- Provenance key order SHOULD be: `sourceFile`, `sourceEntityId`, `sourceRevision`, `sourceLine`,
  `generatedBy`, `taskId`, `commit`, `approvalState`.
- Change key order SHOULD be: `revision`, `createdBy`, `updatedBy`.
- Alias key order SHOULD be: `id`, `reason`, `sinceSchemaVersion`, `removeAfterSchemaVersion`.
- Tags sorted lexicographically.
- Aliases sorted lexicographically by `id`.
- Optional metadata blocks omitted when empty.
- Empty optional arrays SHOULD be omitted unless a surrounding schema needs to preserve an explicit
  empty collection.
- Unknown fields inside the identity envelope rejected.
- Missing optional fields preferred over `null`.
- `null` MUST NOT be used for optional fields unless a future schema explicitly permits it.

## JSON Schema

The normative schema for the identity envelope is:

```text
schemas/entity-identity.schema.json
```

The schema validates local shape. Cross-entity semantic validation remains deferred to future
validation tooling. It does not claim to validate alias cycles, namespace ownership, canonical ID
conflicts across entities, dangling references, global alias uniqueness, or package-level alias
reuse.

## Validation Rules

Validation diagnostics SHOULD use stable rule IDs. Initial rule names:

- `entity-identity.id.required`
- `entity-identity.id.pattern`
- `entity-identity.entity-type.required`
- `entity-identity.entity-type.prefix-mismatch`
- `entity-identity.namespace.prefix-mismatch`
- `entity-identity.schema-version.invalid`
- `entity-identity.tag.invalid`
- `entity-identity.tag.duplicate`
- `entity-identity.tag.order`
- `entity-identity.alias.invalid`
- `entity-identity.alias.duplicate`
- `entity-identity.alias.order`
- `entity-identity.alias.self`
- `entity-identity.alias.cycle`
- `entity-identity.alias.conflict`
- `entity-identity.unknown-field`
- `entity-identity.provenance.invalid`
- `entity-identity.change.invalid`
- `entity-identity.serialization.noncanonical`

## Compatibility Rules

### Compatible Changes

- Clarifying documentation without changing normative behavior.
- Adding optional metadata fields when unknown-field policy is updated through a compatible schema
  version and consumers can ignore them safely.
- Adding a new reserved namespace without changing existing IDs.
- Adding a new validation warning that does not block previously valid data.

### Potentially Breaking Changes

- Changing ID pattern, segment count, case sensitivity, ASCII policy, or comparison rules.
- Changing namespace meaning.
- Removing or changing alias semantics.
- Making optional fields required.
- Changing schema version representation.
- Allowing Unicode in canonical IDs.
- Reusing stable IDs or aliases for new meanings.

Breaking changes MUST follow `CONTRACT_VERSIONING_POLICY.md` and require migration impact review.

## Migration Rules

- Published canonical IDs must remain valid or be covered by aliases or migrations.
- Saves, event logs, and references that contain old IDs must have a declared resolution strategy.
- Alias removal must be treated as potentially breaking.
- Future migrations SHOULD normalize aliases to canonical IDs during build or load.
- Failed alias resolution MUST produce diagnostics rather than silently dropping references.

## Security Considerations

- `sourceFile` path traversal is forbidden.
- IDs MUST NOT be used as file paths, URLs, DOM IDs, shell arguments, or selectors without context
  escaping.
- `sourceFile` is a diagnostic path reference, not permission to access the filesystem.
- ASCII-only IDs avoid Unicode homoglyph attacks.
- Length limits prevent oversized diagnostic, path, and index keys.
- Tags and metadata are untrusted input and MUST be escaped by consumers.
- Provenance can be forged and MUST NOT replace validation or review.
- Plugin namespaces can collide; future Plugin Contract must define ownership checks.
- Reserved namespaces MUST be protected by validators.

## Determinism Considerations

- Canonical IDs are case-sensitive byte strings.
- Tags and aliases have deterministic ordering rules.
- Timestamps are excluded from canonical runtime identity data.
- Optional empty metadata is omitted rather than serialized as `null`.
- Build output should be stable across operating systems and locales.

## Known Limitations

- JSON Schema cannot detect alias cycles across multiple entities.
- JSON Schema cannot prove namespace ownership.
- JSON Schema cannot validate dangling references without a package-level reference graph.
- The contract does not define concrete schemas for rooms, NPCs, scenes, quests, assets, or plugins.
- The contract does not implement runtime lookup or migration.

## Deferred Decisions

- Built-in entity type registry.
- Game manifest namespace ownership.
- Plugin namespace and type registration.
- Package-level alias graph validation.
- Full reference contract.
- Generated documentation from schemas.
