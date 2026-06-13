# Schema Versioning Contract

## Status

DRAFT

## Contract ID

`schema-versioning`

## Contract Version

`schema-versioning@0.1.0`

This is the first M1 draft. It is public but not stable. Acceptance of TASK-005 makes this the
current design output; it does not promote the contract to `stable` or `1.0.0`.

## Owner

`packages/engine-contracts`; validation tooling consumes the contract.

## Purpose

Schema Versioning defines how serialized data schemas declare versions, reader support, writer
versions, compatibility results, migration metadata, deprecation state, and future schema registry
records. It applies to entity schemas, manifests, diagnostics, plugin-facing documents, save
format descriptors, and other versioned project data.

This contract does not implement a runtime Schema Registry, migration runner, save migration,
Entity Registry, State Store, or command pipeline.

## Normative Terms

The terms MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are normative:

- MUST and MUST NOT define required behavior.
- SHOULD and SHOULD NOT define expected behavior with documented exceptions.
- MAY defines explicitly permitted behavior.

## Terminology

- **Schema ID:** Stable lowercase identifier for one serialized document shape family, for example
  `entity-identity`.
- **Schema version:** Positive integer version of a serialized shape under one schema ID.
- **Schema key:** Pair of schema ID and schema version, written `<schema-id>@<schema-version>`.
- **Reader:** Code or validation tooling that accepts one or more schema versions.
- **Writer:** Code or tooling that emits one schema version.
- **Migration descriptor:** Declarative metadata describing a future migration step. It is not
  executable code.
- **Content revision:** A revision of one entity or content item. It is not a schema version.

## Version Taxonomy

| Version type | Owner | Data type | Purpose | Changed by | Migration impact | Stored in |
| --- | --- | --- | --- | --- | --- | --- |
| Contract version | Contract owner | `<contract-id>@<semver>` string | Identifies public specification rules | Contract review, ADR when breaking | Breaking contract changes require migration assessment or major version | Contract docs, descriptors |
| Schema version | Schema owner | Positive integer | Identifies serialized JSON shape for one schema ID | Schema shape or semantic meaning change | May require reader update or migration | Serialized data, schema descriptors |
| Package version | Package owner | SemVer string | Identifies implementation artifact | Package release | May include multiple contract/schema versions | `package.json`, package metadata |
| Engine version | Engine release owner | SemVer string | Identifies engine release | Engine release | May affect supported contracts and schemas | Release metadata |
| Game package version | Game package owner | SemVer string unless later contract changes it | Identifies game content package release | Content package release | May include schema migrations or content changes | Game manifest |
| Save format version | Save Contract owner | Positive integer unless Save Contract changes it | Identifies persisted play-state envelope | Save Contract change | Directly affects save compatibility and migrations | Save file envelope |
| Plugin API version | Plugin Contract owner | SemVer string unless Plugin Contract changes it | Identifies plugin API compatibility | Plugin API contract change | May require plugin upgrade or compatibility gate | Plugin manifest |
| Content revision | Content owner or editor | Stable integer or stable source revision string | Tracks one entity/content edit | Authoring or build pipeline | Does not by itself require schema migration | Entity metadata, provenance, reports |

These version types MUST NOT be substituted for each other. In particular, `schemaVersion` MUST NOT
store contract SemVer, package SemVer, engine version, save format version, plugin API version, or
content revision.

## Schema Version Rules

- `schemaId` MUST be a JSON string using ASCII lowercase canonical form.
- `schemaId` MUST match `[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,63}`.
- `schemaId` length MUST be 2 to 64 characters.
- `schemaId` MUST NOT contain whitespace, uppercase letters, Unicode, underscores, dots, slashes,
  leading hyphens, trailing hyphens, or consecutive hyphens.
- `schemaId` shares grammar with current contract IDs. It intentionally does not include an Entity
  Identity namespace segment. The schema ID namespace is global for project contracts until a
  future Schema Registry ownership model exists.
- Schema ID ownership is deferred to the future registry and package ownership rules. This draft
  only defines canonical syntax and collision behavior.
- `schemaVersion` MUST be a JSON integer.
- `schemaVersion` MUST be greater than or equal to `1`.
- `schemaVersion` MUST NOT exceed `2147483647`.
- Version `1` is the first version for a schema ID.
- Schema versions are scoped by schema ID. Different schema IDs MAY both use `schemaVersion: 1`.
- One schema key MUST identify one serialized shape and meaning.
- A schema version MUST NOT be reused for a different shape or meaning.
- Schema versions MUST be monotonic for a schema ID and MUST NOT decrease.
- Removed versions MUST NOT be recycled.
- Skipping a version number MAY occur only with a documented reason.
- Minor or patch meaning MUST NOT be encoded in the integer.
- The canonical schema key format is `<schema-id>@<schema-version>`, for example
  `entity-identity@1`.
- A document MAY contain multiple independently versioned subobjects only when each subobject has a
  clearly named schema ID and version. Otherwise, the parent document schema governs embedded
  structures.
- Shared metadata blocks SHOULD have their own schema ID and version when they are reused by
  multiple schemas and can evolve independently.
- Referenced structures SHOULD keep their own schema key; embedded structures SHOULD use the parent
  schema unless independent validation is required.

`entity-identity@1` is a schema key. It is not the same as the Entity Identity Contract version
`entity-identity@0.1.0`.

`schema-versioning@0.1.0` is this contract version. `entity-identity@1` is a schema key. These
strings look similar but answer different questions.

## Compatibility Model

Reader compatibility MUST resolve to one of these machine-readable status values:

| Status | Meaning |
| --- | --- |
| `EXACT` | The reader directly supports the input schema version and it equals the canonical writer version. No migration is needed. |
| `READABLE` | The reader can safely load the input without migration even though it is not the canonical writer version. |
| `MIGRATION_REQUIRED` | The input is not directly readable, but a complete supported migration path exists to a readable version or canonical writer version. |
| `UNSUPPORTED_NEWER` | The document version is newer than the reader can safely interpret. |
| `UNSUPPORTED_OLDER` | The document version is older than retained reader or migration support. |
| `INVALID_VERSION` | The version is missing, non-integer, zero, negative, too large, or otherwise invalid. |
| `MISSING_SCHEMA` | The schema ID is unknown or no descriptor is available. |

Compatibility result priority MUST be:

1. `MISSING_SCHEMA` when schema ID or descriptor is unavailable.
2. `INVALID_VERSION` when the input version is missing or invalid.
3. `EXACT` when input version equals a directly supported canonical writer version.
4. `READABLE` when input version is inside the direct reader support range but is not the writer
   version.
5. `MIGRATION_REQUIRED` only when a complete, valid migration path exists.
6. `UNSUPPORTED_NEWER` when input version is newer than direct support and no valid path exists.
7. `UNSUPPORTED_OLDER` when input version is older than direct support and no valid path exists.

Unknown `schemaId` is covered by `MISSING_SCHEMA`.

Forward-compatible reading is not a default assumption. A reader MUST NOT silently interpret a
newer unknown schema version.

## Reader and Writer Policy

- A reader MUST declare `schemaId`, `minVersion`, and `maxVersion`.
- The supported range MUST be contiguous and includes every integer version between `minVersion`
  and `maxVersion`, including both boundaries.
- Sparse reader support is not allowed in `schema-versioning@0.1.0`.
- If any integer version inside the declared reader range has no version entry, the descriptor is
  semantically invalid.
- Future sparse support is deferred and requires a new contract version or new descriptor model.
- `minVersion` MUST be less than or equal to `maxVersion`.
- A reader MUST reject missing `schemaVersion` unless an explicit legacy import profile defines how
  to infer it.
- A reader MUST treat unknown newer versions as `UNSUPPORTED_NEWER` unless a declared reader rule
  proves safe forward compatibility.
- A reader MUST treat unsupported older versions as `UNSUPPORTED_OLDER` unless a migration path is
  known.
- A production writer SHOULD emit only the current canonical writer version.
- `writerVersion` MUST be within the reader support range declared for the same descriptor.
- `writerVersion` MUST match an existing version entry.
- A production writer MUST NOT write a `draft` schema unless an explicit development profile is in
  use.
- A writer MUST NOT silently write an older version.
- A writer MUST NOT read an unknown newer version and then write it back as the current writer
  version, because that can silently discard unknown data.
- Downgrade export is not implicit. A writer MAY emit an older version only under an explicit
  compatibility export profile and must still validate the output against the target schema.

## Change Classification

| Change | Requires schemaVersion increase? | Notes |
| --- | --- | --- |
| Add required field | Yes | Existing documents become invalid. |
| Add optional field | Usually yes | Not automatically compatible when readers use `additionalProperties: false`; old readers may reject it. |
| Remove field | Yes | Reader and migration impact required. |
| Rename field | Yes | Treat as remove plus add. |
| Change data type | Yes | Includes integer/string/array/object changes. |
| Change default value | Yes when runtime meaning changes | Semantic changes must be versioned even with same JSON shape. |
| Change meaning of existing value | Yes | Semantic breaking or migration-required change. |
| Expand enum | Usually yes | Can be breaking for older readers that reject unknown values. |
| Narrow enum | Yes | Previously valid data can become invalid. |
| Change regex pattern | Yes if accepted values change | Tightening or loosening validation changes compatibility. |
| Increase length/count limit | Usually yes | May be forward-incompatible for older readers. |
| Decrease length/count limit | Yes | Existing data can become invalid. |
| Change canonical sort order | Yes | Serialized deterministic bytes change. |
| Change `additionalProperties` policy | Yes | Unknown-field handling affects compatibility. |
| Move field into nested object | Yes | Serialized shape changes. |
| Change identity or alias rules | Yes | Also requires compatibility and migration review. |
| Redaction or wording clarification | No | Only when normative behavior is unchanged. |

A change to contract documentation, JSON Schema, or runtime meaning may require versioning
independently. A semantic meaning change MUST be versioned even if the JSON shape remains the same.

## Migration Metadata

Migration descriptors are declarative compatibility records:

```json
{
  "migrationId": "entity-identity.1-to-2",
  "schemaId": "entity-identity",
  "fromVersion": 1,
  "toVersion": 2,
  "direction": "upgrade",
  "deterministic": true,
  "lossy": false,
  "requiresContext": false
}
```

- `migrationId` MUST be stable and globally unique enough for diagnostics. The recommended form is
  `<schema-id>.<fromVersion>-to-<toVersion>`.
- Migration IDs MUST NOT be duplicated within one descriptor.
- `fromVersion` and `toVersion` MUST be positive integers and MUST NOT be equal.
- `direction: "upgrade"` means `toVersion` is greater than `fromVersion`.
- `direction: "downgrade"` means `toVersion` is less than `fromVersion`.
- A migration MUST operate within one schema ID.
- Upgrade paths MUST be deterministic.
- Each migration step result MUST be validated against the target schema.
- Migration metadata MUST NOT contain executable JavaScript, TypeScript, shell code, or dynamic
  expressions.
- Migration descriptors MUST NOT silently change stable entity IDs.
- Lossy migrations MUST set `lossy: true` and MUST include `lossDescription`.
- Lossless migrations MUST set `lossy: false` and MUST NOT include `lossDescription`.
- `requiresContext: false` means the migration is a pure function of the input document and the
  declared migration metadata.
- `requiresContext: true` means the migration requires explicitly supplied, versioned, validated
  context. It MUST NOT read hidden global state, network resources, filesystem paths, or secrets.
- Downgrade migrations MAY be unsupported.
- Missing migration steps are blocker compatibility errors.
- Multi-step migrations MAY be composed when every adjacent step exists, is acyclic, and validates
  after each step.
- Skip migrations such as `1 -> 3` MAY exist.
- Skip migrations MAY coexist with `1 -> 2 -> 3` only when exactly one canonical path is declared
  for an input version to the canonical writer version.
- Ambiguous alternative canonical paths are semantic blocker errors.
- Path selection is a future migration-runner concern; this contract only requires the descriptor
  to be unambiguous.
- Migration graph cycles are semantic validation errors.
- Every migration endpoint MUST reference an existing schema key.
- A schema hash or fingerprint MAY help detect changed files, but it is not the semantic identity
  of the schema. The schema key remains the identity.

This contract does not implement a migration runner.

## Schema Registry Descriptor

The descriptor model in `schema-versioning@0.1.0` is one logical schema descriptor with a list of
version entries. A schema key is created by combining the descriptor `schemaId` with one
`versions[].schemaVersion` entry.

The future Schema Registry MUST be able to record:

- `contractVersion`
- `schemaId`
- `owningPackage`
- contract ID and contract version
- version entries with schema version, lifecycle status, and JSON Schema location
- reader support range
- writer version
- migration descriptors
- optional schema or meaning hash

Registry source should be source declarations plus a build-time generated index. The source
declarations are reviewable in Git; the generated index can optimize validation and runtime
diagnostics. This contract does not choose a runtime registry implementation.

The descriptor schema is:

```text
schemas/schema-versioning.schema.json
```

JSON Schema validates local descriptor shape. Cross-document migration graph checks, duplicate
schema keys, reused versions with changed hashes, missing version entries, writer entry existence,
ambiguous migration paths, and registry completeness are semantic validation.

## Lifecycle Status

- `draft` means the schema version is under design. A production canonical writer MUST NOT emit it
  unless an explicit development profile is declared.
- `accepted` means the schema version is valid for current use.
- `deprecated` means readers may still support it, but standard writers SHOULD NOT emit it.
- `removed` means a tombstone entry remains for compatibility history. Removed versions are not
  readable or writable by default and MUST NOT be reused.

`removed` does not mean the record disappears from compatibility evidence; it means the tombstone
must remain wherever published compatibility history is tracked.

## Deprecation and Removal

- A schema version MAY be marked `deprecated` only when a replacement version or removal rationale
  is documented.
- Publicly released schema versions MUST NOT be removed silently.
- Reader support SHOULD be retained until the next incompatible major contract/package milestone or
  until an ADR documents why support cannot be retained.
- Migration paths SHOULD remain available for deprecated public versions while readers or saved
  data can still reference them.
- Removing a migration path is an incompatible compatibility change unless the source version was
  never published.
- Deprecated fixtures SHOULD remain in tests as long as the version is accepted or migratable.
- Standard writers SHOULD NOT create deprecated versions.
- Migration paths MUST NOT be removed while supported data still depends on them.
- Removed versions MUST produce deterministic diagnostics rather than being guessed.

No calendar duration is defined because the project does not yet have a release cadence.

## Determinism

- Schema descriptors MUST be deterministic JSON.
- Canonical descriptor JSON uses UTF-8, two-space indentation, LF in fixtures, and a final newline.
- Top-level key order SHOULD be: `contractVersion`, `schemaId`, `owningPackage`, `contract`,
  `versions`, `readerSupport`, `writerVersion`, `writerProfile`, `migrations`.
- Version entries SHOULD be sorted numerically by `schemaVersion`; `1, 2, 10` is correct and
  `1, 10, 2` is not.
- Version entry key order SHOULD be: `schemaVersion`, `status`, `jsonSchema`, `schemaHash`,
  `meaningHash`, `deprecation`.
- Migrations SHOULD be sorted by `schemaId`, then `fromVersion`, then `toVersion`, then
  `migrationId`.
- Empty optional arrays and objects SHOULD be omitted unless they carry explicit meaning.
- Missing optional fields are preferred over `null`; `null` MUST NOT be used unless a future schema
  explicitly permits it.

## Security Considerations

- Version integers are capped at `2147483647` to reduce overflow risk across runtimes.
- Very large migration graphs can be used for denial of service; descriptors SHOULD keep migration
  arrays bounded and validators SHOULD cap graph traversal.
- Migration metadata is untrusted input and MUST NOT be treated as executable code.
- Migration metadata is not authorization to run a migration.
- A schema hash or signature MAY be added later as integrity metadata, but it is not the identity of
  a schema version.
- Downgrade paths can re-enable vulnerable old behavior and MUST be explicit when supported.
- Schema descriptor paths are diagnostic references and MUST NOT grant filesystem access.
- Schema descriptor paths MUST NOT imply network access.
- Unknown newer data MUST NOT be overwritten by a read-modify-write cycle.
- Hashes, commits, and descriptor metadata are not proof of trust without external verification.
- Compatibility results are validation decisions, not authorization decisions.

## Examples

Minimal descriptor:

```json
{
  "contractVersion": "schema-versioning@0.1.0",
  "schemaId": "entity-identity",
  "owningPackage": "@narrative-engine/engine-contracts",
  "contract": {
    "id": "entity-identity",
    "version": "entity-identity@0.1.0"
  },
  "versions": [
    {
      "schemaVersion": 1,
      "status": "accepted",
      "jsonSchema": "schemas/entity-identity.schema.json"
    }
  ],
  "readerSupport": {
    "minVersion": 1,
    "maxVersion": 1
  },
  "writerVersion": 1
}
```

## Relationship to Entity Identity

`schemaVersion` in `ENTITY_IDENTITY_CONTRACT.md` is compatible with this contract: it is a positive
integer scoped to the concrete entity schema and separate from `entity-identity@0.1.0`. Any future
change to Entity Identity serialized shape or semantic meaning must update its schema version
according to the change classification above.

## Known Limitations

- JSON Schema cannot compare `minVersion` and `maxVersion` without nonstandard extensions; tests
  cover that semantic rule.
- JSON Schema cannot prove migration graph acyclicity or path continuity.
- JSON Schema cannot detect duplicate schema keys, missing inner version entries, writer entry
  existence, ambiguous paths, or removed-version reuse.
- The descriptor contract is not a runtime registry.
- No downgrade export profile is designed.

## Deferred Decisions

- Sparse reader support lists.
- Exact registry file location and generation command.
- Schema hash or signature policy.
- Legacy import profiles for missing `schemaVersion`.
- Save-format-specific retention window.
- Plugin API schema declaration details.
