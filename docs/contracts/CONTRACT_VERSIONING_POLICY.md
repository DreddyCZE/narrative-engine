# Contract Versioning Policy

This policy defines how public contracts evolve. It applies to schemas, APIs, save formats,
diagnostic envelopes, manifests, and workflow contracts.

## Version Types

### Package Version

Package versions identify published code packages such as `engine-kernel`, `engine-contracts`, or
`validation`. They use semantic versioning once packages become public.

Package versions answer: "Which implementation artifact is this?"

### Contract Version

Contract versions identify public interface expectations independent of a package release. A
package may implement multiple contract versions during migrations.

Contract versions answer: "Which public interface rules does this data or code follow?"

### Schema Version

Schema versions identify the shape of serialized data such as game data entities, manifests,
diagnostics, assets, localization files, or migrations.

Schema versions answer: "Which serialized data shape is this?"

### Save Format Version

Save format versions identify persisted play state compatibility. They are separate because saves
may need long-term compatibility even when engine packages or schemas evolve.

Save format versions answer: "Can this saved play state be restored or migrated?"

### Plugin API Version

Plugin API versions identify extension compatibility across plugin manifests, lifecycle hooks,
declared commands, declared effects, view model extensions, permissions, migrations, and plugin save
data.

Plugin API versions answer: "Can this plugin safely run against this engine and contract set?"

## Compatible Changes

Compatible public contract changes may include:

- Adding optional fields with defined defaults.
- Adding new enum-like values only when consumers are required to ignore unknown values safely.
- Adding new diagnostic rule IDs.
- Adding new event, command, condition, or effect types behind explicit capability/version gates.
- Clarifying documentation without changing behavior.

Compatible changes still require tests and changelog notes when public behavior is affected.

## Incompatible Changes

Incompatible public contract changes include:

- Removing or renaming public fields.
- Changing field meaning, units, ordering guarantees, or default behavior.
- Making optional fields required.
- Reusing an ID for a different meaning.
- Changing save semantics or event replay meaning.
- Allowing a layer to access another layer's internals.
- Changing validation severity in a way that can break CI or publication.

Incompatible changes require an ADR, migration impact assessment, and either a compatible migration
path or an explicit major version change for the affected public contract, schema, save format, or
plugin API.

## Deprecation Policy

Public contract elements must move through:

1. Active
2. Deprecated with replacement documented
3. Migration available where applicable
4. Removal in an incompatible version

Removal without deprecation is allowed only before a contract is marked `stable`, or through an ADR
that documents why deprecation is impossible.

## Migration Obligation

Any incompatible change to public schemas, save formats, IDs, manifests, plugin APIs, or event
records must define:

- Source version.
- Target version.
- Migration owner.
- Data loss risk.
- Validation diagnostics for unsupported inputs.
- Rollback or recovery expectation.

If migration is not provided, the contract must explicitly declare unsupported compatibility and the
runtime/editor behavior for that case.

## Stable ID Aliasing

Stable entity IDs must not be reused. Published IDs may be renamed only with an alias or migration
record. Alias records must include:

- Old ID.
- New ID.
- Entity type.
- First version where alias applies.
- Removal policy, if any.

Aliases are compatibility records, not a substitute for careless naming.

## Contract Test Fixtures

Each public contract must eventually include fixtures for:

- Minimal valid data.
- Representative valid data.
- Invalid data for each important rule.
- Deprecated but accepted data, when deprecation exists.
- Migration source and target data, when migration exists.

Fixtures must be deterministic and must not include concrete game content beyond neutral examples.
Concrete fixture files are not created by this policy. They must be added by separate tasks when
individual contracts are drafted.

## No Silent Public Contract Changes

Public contracts may not change silently. Every public contract change must be traceable to at least
one of:

- Active task.
- ADR.
- Migration document.
- Changelog entry.
- Contract fixture update.

AI-generated drafts cannot publish public contract changes without human review.
