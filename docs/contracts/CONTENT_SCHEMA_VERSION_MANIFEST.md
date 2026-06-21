# Content Schema and Version Manifest

## Status

DRAFT

## Contract ID

`content-schema-version-manifest`

## Contract Version

`content-schema-version-manifest@0.1.0`

This is the first M3 draft for content package manifest version semantics. It defines the
data-model boundary for manifest fields, compatibility status, declared sections, and deterministic
diagnostics. It does not implement a loader, resolver, runtime host, Save system, or Event Store.

## Purpose

Content Schema and Version Manifest defines the required top-level manifest shape for a Content
Package and the version semantics attached to that manifest.

The manifest contract:

- MUST remain data-only
- MUST be JSON-safe
- MUST define compatibility metadata without executing runtime behavior
- MUST support deterministic validation and diagnostics
- MUST act as input to future validation and loader boundaries

## Relationship to Content Package Contract

The manifest is a required top-level part of every Content Package.

- `CONTENT_PACKAGE_CONTRACT.md` defines the broader package envelope and section model.
- This contract defines the manifest-specific version, compatibility, and declared-sections rules.
- A Content Package without a valid manifest is invalid.

## Manifest Fields

The first contract version defines these canonical manifest fields:

1. `id`
2. `name`
3. `version`
4. `schemaVersion`
5. `contentVersion`
6. `engineRange`
7. `contractVersion`
8. `dependencies`
9. `declaredSections`
10. `capabilities`
11. `diagnosticsPolicy`

Field rules:

- `id`
  - MUST be a stable lowercase ASCII identifier
  - SHOULD follow the same package-ID shape documented by the Content Package Contract
- `name`
  - MUST be human-readable
  - MUST NOT be used as stable identity
- `version`
  - MUST be a semantic version string for the package release
- `schemaVersion`
  - MUST be a positive integer
  - MUST identify the manifest schema version
- `contentVersion`
  - MAY be a semantic version string or another stable authored content revision string
  - MUST NOT be confused with `schemaVersion`
- `engineRange`
  - MAY declare compatible engine or contract bundle ranges
- `contractVersion`
  - MUST identify the contract version that governs the manifest shape when present
  - SHOULD be `content-schema-version-manifest@0.1.0` for this draft
- `dependencies`
  - MAY declare package dependencies with version ranges
  - MUST be deterministic and deduplicated
- `declaredSections`
  - MUST list the named sections that the package intentionally provides
  - MUST preserve deterministic order
- `capabilities`
  - MAY declare optional features
  - MUST NOT grant runtime permission by themselves
- `diagnosticsPolicy`
  - MAY declare reporting profile metadata
  - MUST remain data-only and deterministic

Unknown manifest fields are validation errors unless a future schema version explicitly allows
extension points.

## Version Semantics

The manifest distinguishes several version fields with different meanings:

- `schemaVersion`
  - identifies the serialized manifest shape
  - follows `SCHEMA_VERSIONING_CONTRACT.md`
- `contentVersion`
  - identifies authored content revision or content bundle revision
  - does not by itself imply schema compatibility
- `version`
  - identifies the package release version
  - may change even when `schemaVersion` does not
- `contractVersion`
  - identifies the public contract design used by the manifest
  - is separate from `schemaVersion`
- `engineRange`
  - identifies compatibility expectations against engine releases or approved contract bundles
- dependency version ranges
  - constrain acceptable versions of dependent content packages

These fields MUST NOT be substituted for each other.

## Compatibility Policy

Manifest compatibility SHOULD resolve to these machine-readable states:

- `compatible`
  - the manifest schema version, contract version, and engine range are acceptable
- `incompatible`
  - the manifest explicitly conflicts with the current reader or engine boundary
- `unknown`
  - compatibility cannot be determined from available metadata
- `deprecated`
  - the manifest can still be read, but should no longer be the standard writer target
- `future-schema`
  - the manifest schema version is newer than the reader can safely interpret
- `missing-required-version`
  - one or more required version fields are absent or invalid

Rules:

- unknown newer `schemaVersion` values MUST NOT be silently accepted
- invalid or missing required version fields MUST produce diagnostics
- `engineRange` mismatch MUST be treated as compatibility failure, not as a runtime warning only
- dependency range mismatches MUST be explicit diagnostics

## Declared Sections Policy

`declaredSections` is the manifest-owned list of intended package sections.

Rules:

- required sections declared by the manifest MUST exist in the package if their policy requires
  presence
- optional sections MAY be omitted
- undeclared sections SHOULD be surfaced as diagnostics
- duplicate section identifiers are diagnostics
- section order MUST be deterministic
- section policy checks in this task stop at declared section presence and ordering

This task does not implement deeper cross-reference validation across section contents.

## Diagnostics

Manifest validators SHOULD produce stable diagnostics for at least:

- missing manifest
- invalid ID
- invalid version
- incompatible engine range
- unknown schema
- duplicate dependency
- missing declared section
- undeclared section
- unsupported capability
- invalid diagnostics policy

Suggested stable diagnostic codes:

- `MISSING_MANIFEST`
- `INVALID_MANIFEST_ID`
- `INVALID_MANIFEST_VERSION`
- `INVALID_SCHEMA_VERSION`
- `INCOMPATIBLE_ENGINE_RANGE`
- `UNKNOWN_MANIFEST_SCHEMA`
- `DUPLICATE_DEPENDENCY`
- `MISSING_DECLARED_SECTION`
- `UNDECLARED_SECTION`
- `UNSUPPORTED_CAPABILITY`
- `INVALID_DIAGNOSTICS_POLICY`

Diagnostics MUST follow `VALIDATION_DIAGNOSTIC_CONTRACT.md` and preserve stable paths such as:

- `/manifest`
- `/manifest/id`
- `/manifest/version`
- `/manifest/schemaVersion`
- `/manifest/engineRange`
- `/manifest/dependencies/0`
- `/manifest/declaredSections/1`

## Determinism

Manifest processing MUST be deterministic.

Rules:

- stable sorting MUST apply to dependency and capability collections when order is not semantic
- diagnostic paths MUST be stable
- no runtime execution is allowed during validation
- no filesystem, network, time, locale, or randomness inputs are allowed
- manifest data MUST be JSON-safe only
- canonical serialization SHOULD use UTF-8, LF line endings, 2-space indentation, stable key order,
  and a final newline

Suggested canonical key order:

1. `id`
2. `name`
3. `version`
4. `schemaVersion`
5. `contentVersion`
6. `engineRange`
7. `contractVersion`
8. `dependencies`
9. `declaredSections`
10. `capabilities`
11. `diagnosticsPolicy`

## Non-Goals

- no loader implementation
- no resolver implementation
- no cross-reference validation beyond declared sections policy
- no Event Store
- no Save system
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime

## Example

Minimal neutral manifest example:

```json
{
  "id": "content.demo.core",
  "name": "Demo Core Content",
  "version": "0.1.0",
  "schemaVersion": 1,
  "contentVersion": "0.1.0",
  "engineRange": "^0.1.0",
  "contractVersion": "content-schema-version-manifest@0.1.0",
  "dependencies": [
    {
      "id": "content.demo.shared",
      "versionRange": "^0.1.0"
    }
  ],
  "declaredSections": [
    "entities",
    "locations",
    "commands",
    "conditions",
    "effects"
  ],
  "capabilities": [
    "content-package"
  ],
  "diagnosticsPolicy": {
    "mode": "strict"
  }
}
```

## Acceptance Criteria

TASK-030 is complete when:

- the manifest contract exists at `docs/contracts/CONTENT_SCHEMA_VERSION_MANIFEST.md`
- manifest fields and version semantics are documented
- compatibility policy is documented
- declared sections policy is documented
- deterministic diagnostics expectations are documented
- no loader, resolver, or runtime implementation is added
- the next recommended task is `TASK-031 - Content validation diagnostic adapters`

## Known Limitations

- no manifest schema file is defined in this task
- no manifest inspector helper is implemented
- no dependency resolver exists
- no cross-reference validator exists
- no compatibility engine exists beyond documented policy

## Deferred Decisions

- exact schema file location and registry ownership
- exact `engineRange` grammar and parser ownership
- exact dependency-version grammar beyond version-range intent
- capability registry ownership
- relationship between manifest diagnostics policy and future loader profiles
