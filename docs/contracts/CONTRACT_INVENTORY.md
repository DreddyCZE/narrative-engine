# Contract Inventory

Canonical inventory for public and internal contracts identified during M0. This document is not a
schema implementation. It defines ownership, consumers, stability, versioning expectations, and
draft priority so future READY tasks can be created without changing scope silently.

## Status Values

- `IDENTIFIED`: known contract, enough information exists for planning.
- `DRAFT_REQUIRED`: required soon; a dedicated draft task should define it before implementation.
- `DRAFTED`: a concrete draft contract exists and is awaiting or undergoing review.
- `DEFERRED`: valid contract, but not needed for M1 or the first vertical slice.
- `NOT_REQUIRED`: considered and rejected for now.

## Stability Values

- `planning`: inventory only.
- `draft`: contract design may begin.
- `reviewed`: accepted by task review, not yet stable.
- `stable`: public compatibility guarantees apply.

## Inventory

### Entity Identity Contract

- **Purpose:** Defines stable entity IDs, namespaces, entity type markers, aliases, provenance hooks,
  and rules for renames.
- **Owner:** `packages/engine-contracts`; architecture and contract owners.
- **Contract document:** `docs/contracts/ENTITY_IDENTITY_CONTRACT.md`.
- **Schema:** `schemas/entity-identity.schema.json`.
- **Producers:** Game Data, Editor, migrations, content import tooling.
- **Consumers:** Engine, validation, save, event log, editor, context packs.
- **Visibility:** Public.
- **Stability:** draft.
- **Versioning:** Contract version plus schema-level rules for ID syntax and alias records.
- **Dependencies:** None.
- **Security or migration impact:** High. Broken identity rules corrupt references, saves, events,
  and migrations.
- **Needed for M1:** Yes.
- **Needed for first vertical slice:** Yes.
- **Current status:** `DRAFTED`.
- **MASTER_SPEC refs:** 2.2, 3, 33, 61.6, 61.11, 61.17.

### Schema Versioning Contract

- **Purpose:** Defines how schemas declare versions, compatibility, deprecation, migrations, and
  fixture expectations.
- **Owner:** `packages/engine-contracts`; validation package consumes it.
- **Contract document:** `docs/contracts/SCHEMA_VERSIONING_CONTRACT.md`.
- **Schema:** `schemas/schema-versioning.schema.json`.
- **Producers:** Contract authors, schema authors, migration tooling.
- **Consumers:** Game Data, Engine, Editor, CI validation, migrations, saves.
- **Visibility:** Public.
- **Stability:** draft.
- **Versioning:** Contract version `schema-versioning@0.1.0`; governs integer schemaVersion,
  compatibility status, migration descriptor, and registry descriptor rules.
- **Dependencies:** Entity Identity.
- **Security or migration impact:** High. Silent schema drift can invalidate content and saves.
- **Needed for M1:** Yes.
- **Needed for first vertical slice:** Yes.
- **Current status:** `DRAFTED`.
- **MASTER_SPEC refs:** 2.2, 33, 58.7, 58.9, 61.18.

### Game Manifest Contract

- **Purpose:** Describes a game package: ID, version, compatible engine, active modules, start
  points, languages, theme, assets, migrations, plugins, and save namespace.
- **Owner:** Game Data contract area.
- **Producers:** Game package authors, Editor export tooling.
- **Consumers:** Runtime loader, validation, build tooling, editor, save migration tooling.
- **Visibility:** Public.
- **Stability:** planning.
- **Versioning:** Manifest schema version plus game package semantic version.
- **Dependencies:** Entity Identity, Schema Versioning, Theme, Asset Manifest, Plugin,
  Localization.
- **Security or migration impact:** Medium. Incorrect compatibility metadata can load unsupported
  data or plugins.
- **Needed for M1:** No.
- **Needed for first vertical slice:** Yes.
- **Current status:** `IDENTIFIED`.
- **MASTER_SPEC refs:** 3, 33, 58.7, 61.8.

### Game Data Schema Contract

- **Purpose:** Defines the declarative shape of canonical game data and forbids executable code in
  data files.
- **Owner:** Game Data contract area with validation owner.
- **Producers:** Authors, Editor, import tools, AI draft tools after human approval.
- **Consumers:** Engine, validation, Editor, build tooling, context packs.
- **Visibility:** Public.
- **Stability:** planning.
- **Versioning:** Schema major/minor with migration obligations for incompatible changes.
- **Dependencies:** Entity Identity, Schema Versioning, Source Provenance, Validation Diagnostic.
- **Security or migration impact:** High. Data code execution or reference drift violates trust
  boundaries.
- **Needed for M1:** No.
- **Needed for first vertical slice:** Yes.
- **Current status:** `DRAFT_REQUIRED`.
- **MASTER_SPEC refs:** 2A.B, 3, 35, 61.3, 61.6, 61.36.

### Engine State Contract

- **Purpose:** Defines the canonical internal state boundary and what may be persisted, exposed, or
  mutated through commands.
- **Owner:** `packages/engine-state`.
- **Producers:** Engine transaction pipeline and migration tooling.
- **Consumers:** Engine rules, View Model builder, Save, diagnostics, tests.
- **Visibility:** Internal with public compatibility touchpoints through Save, View Model, and Event
  contracts.
- **Stability:** planning.
- **Versioning:** Internal state schema version; incompatible changes require migration analysis if
  state is persisted.
- **Dependencies:** Entity Identity, Schema Versioning.
- **Security or migration impact:** High. UI must not mutate state directly; save compatibility
  depends on state evolution.
- **Needed for M1:** Yes.
- **Needed for first vertical slice:** Yes.
- **Current status:** `DRAFT_REQUIRED`.
- **MASTER_SPEC refs:** 2A.A, 2A.E, 33, 61.1, 61.2.

### Command Contract

- **Purpose:** Represents user or system intent entering the engine pipeline.
- **Owner:** `packages/engine-contracts` with Engine owner.
- **Producers:** Runtime UI, AI agent adapters, tests, Editor preview.
- **Consumers:** Command validation, transaction pipeline, diagnostics, event trace.
- **Visibility:** Public.
- **Stability:** planning.
- **Versioning:** Contract version plus per-command type version if payloads diverge.
- **Dependencies:** Entity Identity, Schema Versioning, Validation Diagnostic.
- **Security or migration impact:** High. Commands are the only sanctioned mutation entry point.
- **Needed for M1:** Yes.
- **Needed for first vertical slice:** Yes.
- **Current status:** `DRAFT_REQUIRED`.
- **MASTER_SPEC refs:** 2A.E, 61.1, 61.2, 61.36.

### Transaction Contract

- **Purpose:** Defines atomic application of validated effects, rollback behavior, trace metadata,
  and commit semantics.
- **Owner:** Engine owner.
- **Producers:** Command pipeline, scheduled systems, tests.
- **Consumers:** Engine State, Event Log, Save, diagnostics, Editor explain tools.
- **Visibility:** Internal with public diagnostics.
- **Stability:** planning.
- **Versioning:** Contract version for transaction trace and diagnostics; implementation remains
  internal.
- **Dependencies:** Command, Condition, Effect, Engine State, Domain Event, Validation Diagnostic.
- **Security or migration impact:** High. Partial state application must be impossible.
- **Needed for M1:** Yes.
- **Needed for first vertical slice:** Yes.
- **Current status:** `DRAFT_REQUIRED`.
- **MASTER_SPEC refs:** 61.1, 61.2, 61.9.

### Condition Contract

- **Purpose:** Defines declarative predicates, explainability, allowed inputs, and forbidden direct
  UI evaluation.
- **Owner:** `packages/engine-rules`.
- **Producers:** Game Data, plugins through declared extensions, Editor.
- **Consumers:** Engine rules, validation, View Model builder, Editor explain tools.
- **Visibility:** Public.
- **Stability:** planning.
- **Versioning:** Schema version for condition expression format and extension capability version.
- **Dependencies:** Entity Identity, Schema Versioning, Validation Diagnostic.
- **Security or migration impact:** High. Conditions gate content, commands, and player-visible
  choices.
- **Needed for M1:** Yes.
- **Needed for first vertical slice:** Yes.
- **Current status:** `DRAFT_REQUIRED`.
- **MASTER_SPEC refs:** 4, 2A.F, 34.1, 61.1, 61.36.

### Effect Contract

- **Purpose:** Defines declarative, validated state changes that are applied only inside
  transactions.
- **Owner:** Engine rules and state owners.
- **Producers:** Game Data, command handlers, scheduler, plugins through declared extensions.
- **Consumers:** Transaction pipeline, Engine State, Event production, validation.
- **Visibility:** Public.
- **Stability:** planning.
- **Versioning:** Schema version for effect records and extension capability version.
- **Dependencies:** Entity Identity, Schema Versioning, Engine State, Validation Diagnostic.
- **Security or migration impact:** High. Effects are the only sanctioned state mutation records.
- **Needed for M1:** Yes.
- **Needed for first vertical slice:** Yes.
- **Current status:** `DRAFT_REQUIRED`.
- **MASTER_SPEC refs:** 5, 61.1, 61.2, 61.12.

### Domain Event Contract

- **Purpose:** Defines immutable records of facts that occurred after transaction commit.
- **Owner:** Engine contract owner.
- **Producers:** Transaction pipeline, scheduler, plugin adapters.
- **Consumers:** Event Log, Save, replay tools, Editor explain tools, analytics exports.
- **Visibility:** Public.
- **Stability:** planning.
- **Versioning:** Event envelope version plus event type version.
- **Dependencies:** Entity Identity, Schema Versioning, Transaction, Source Provenance.
- **Security or migration impact:** High. Events must not be commands or effects and must preserve
  replay meaning.
- **Needed for M1:** Yes.
- **Needed for first vertical slice:** Yes.
- **Current status:** `DRAFT_REQUIRED`.
- **MASTER_SPEC refs:** 6, 61.1, 61.2.

### Event Log Contract

- **Purpose:** Defines ordering, seed trace, replay metadata, retention, and event stream integrity.
- **Owner:** Engine and persistence owners.
- **Producers:** Domain Event pipeline.
- **Consumers:** Save, replay, tests, diagnostics, migration tools.
- **Visibility:** Public for tooling; runtime storage internals remain internal.
- **Stability:** planning.
- **Versioning:** Log envelope version; event entries use Domain Event versions.
- **Dependencies:** Domain Event, Schema Versioning, Source Provenance.
- **Security or migration impact:** High. Replay and debugging depend on stable event semantics.
- **Needed for M1:** No.
- **Needed for first vertical slice:** Yes.
- **Current status:** `IDENTIFIED`.
- **MASTER_SPEC refs:** 6, 33, 61.21.

### Scheduler Contract

- **Purpose:** Defines scheduled event metadata, timing models, priorities, cancellation, and
  deterministic execution boundaries.
- **Owner:** Engine rules owner.
- **Producers:** Game Data, engine systems, plugins.
- **Consumers:** Transaction pipeline, Domain Event production, validation, Editor preview.
- **Visibility:** Public.
- **Stability:** planning.
- **Versioning:** Scheduler schema version and timing model version.
- **Dependencies:** Entity Identity, Condition, Effect, Domain Event.
- **Security or migration impact:** Medium. Bad schedules can create nondeterministic or stuck
  content.
- **Needed for M1:** No.
- **Needed for first vertical slice:** No.
- **Current status:** `DEFERRED`.
- **MASTER_SPEC refs:** 7, 61.1, 61.11.

### Check Resolver Contract

- **Purpose:** Defines generic checks, deterministic randomness, result bands, and explainability.
- **Owner:** Engine rules owner.
- **Producers:** Game Data, plugins, tests.
- **Consumers:** Condition evaluation, Effect selection, View Model, diagnostics.
- **Visibility:** Public.
- **Stability:** planning.
- **Versioning:** Rule profile version plus check payload schema version.
- **Dependencies:** Entity Identity, Condition, Domain Event, Validation Diagnostic.
- **Security or migration impact:** Medium. Affects fairness, replay, and save determinism.
- **Needed for M1:** No.
- **Needed for first vertical slice:** No.
- **Current status:** `DEFERRED`.
- **MASTER_SPEC refs:** 18, 34.1, 61.1.

### View Model Contract

- **Purpose:** Defines the safe presentation model produced from engine state for UX and editor
  preview.
- **Owner:** UX contract owner with Engine owner.
- **Producers:** View Model builder in Engine boundary.
- **Consumers:** Runtime UI, Editor preview, accessibility tooling, tests.
- **Visibility:** Public.
- **Stability:** planning.
- **Versioning:** View Model schema version independent of Engine State.
- **Dependencies:** Entity Identity, Engine State, Condition, Command, Localization, Theme.
- **Security or migration impact:** High. UI must not infer hidden state or evaluate conditions.
- **Needed for M1:** No.
- **Needed for first vertical slice:** Yes.
- **Current status:** `DRAFT_REQUIRED`.
- **MASTER_SPEC refs:** 2A.F, 34.1, 61.1, 61.10, 61.36.

### Save Contract

- **Purpose:** Defines persisted game state, compatibility metadata, seed, event trace references,
  and what must not be saved as game state.
- **Owner:** Persistence owner.
- **Producers:** Runtime persistence adapter, tests, import tools.
- **Consumers:** Engine restore, migration tools, validation, support diagnostics.
- **Visibility:** Public.
- **Stability:** planning.
- **Versioning:** Save format version separate from package, schema, and contract versions.
- **Dependencies:** Entity Identity, Schema Versioning, Engine State, Event Log, Migration.
- **Security or migration impact:** High. Must not persist UX layout as game state; incompatible
  changes require migrations.
- **Needed for M1:** No.
- **Needed for first vertical slice:** No.
- **Current status:** `DEFERRED`.
- **MASTER_SPEC refs:** 33, 58.7, 61.9, 61.18, 61.36.

### Migration Contract

- **Purpose:** Defines migration records, source/target versions, compatibility checks, alias use,
  and failure diagnostics.
- **Owner:** Validation and persistence owners.
- **Producers:** Contract owners, schema authors, game package maintainers.
- **Consumers:** Build tooling, runtime load, save restore, editor upgrade tools.
- **Visibility:** Public.
- **Stability:** planning.
- **Versioning:** Migration manifest version plus source/target contract or schema versions.
- **Dependencies:** Entity Identity, Schema Versioning, Save, Validation Diagnostic.
- **Security or migration impact:** High. Failed migrations can corrupt canonical content or saves.
- **Needed for M1:** No.
- **Needed for first vertical slice:** No.
- **Current status:** `IDENTIFIED`.
- **MASTER_SPEC refs:** 2.2, 33, 58.9, 61.18.

### Validation Diagnostic Contract

- **Purpose:** Defines structured validation findings with severity, source references, rule IDs,
  remediation hints, and CI behavior.
- **Owner:** `packages/validation`.
- **Producers:** Schema validation, reference validation, architecture boundary checks, narrative
  lint, migration checks.
- **Consumers:** CI, Editor, agents, reports, task handoffs.
- **Visibility:** Public.
- **Stability:** planning.
- **Versioning:** Diagnostic envelope version and rule ID versioning.
- **Dependencies:** Entity Identity, Source Provenance, Schema Versioning.
- **Security or migration impact:** Medium. Poor diagnostics hide blockers or mislead automated
  agents.
- **Needed for M1:** Yes.
- **Needed for first vertical slice:** Yes.
- **Current status:** `DRAFT_REQUIRED`.
- **MASTER_SPEC refs:** 35, 58.10, 61.6, 61.9, 61.36.

### Localization Contract

- **Purpose:** Defines stable localization IDs, language metadata, fallbacks, pluralization, and
  separation from game logic.
- **Owner:** Localization owner in Game Data layer.
- **Producers:** Authors, translators, Editor, import tools.
- **Consumers:** Runtime UI, View Model, validation, Editor, build tooling.
- **Visibility:** Public.
- **Stability:** planning.
- **Versioning:** Localization schema version plus language pack version.
- **Dependencies:** Entity Identity, Schema Versioning, Source Provenance.
- **Security or migration impact:** Medium. Localization must not change logic or leak spoilers
  outside policy.
- **Needed for M1:** No.
- **Needed for first vertical slice:** Yes, minimal only.
- **Current status:** `IDENTIFIED`.
- **MASTER_SPEC refs:** 13, 29, 2A.I, 61.5.

### Theme Contract

- **Purpose:** Defines swappable presentation tokens and asset references without game-state
  mutation.
- **Owner:** UX layer.
- **Producers:** Theme authors, Editor preview tooling.
- **Consumers:** Runtime UI, Editor preview, validation, build tooling.
- **Visibility:** Public.
- **Stability:** planning.
- **Versioning:** Theme schema version plus theme package semantic version.
- **Dependencies:** Asset Manifest, Localization where text appears, Schema Versioning.
- **Security or migration impact:** Medium. Theme must not change save, state, or logic.
- **Needed for M1:** No.
- **Needed for first vertical slice:** No.
- **Current status:** `DEFERRED`.
- **MASTER_SPEC refs:** 2A.G, 2A.I, 30, 61.36.

### Asset Manifest Contract

- **Purpose:** Defines asset IDs, file metadata, hashes, license data, variants, fallbacks, and
  approval state.
- **Owner:** Tooling and UX asset pipeline owners.
- **Producers:** Asset import tools, authors, build tooling.
- **Consumers:** Runtime UI, Editor, validation, build pipeline, diagnostics.
- **Visibility:** Public.
- **Stability:** planning.
- **Versioning:** Manifest schema version plus asset package version.
- **Dependencies:** Entity Identity, Schema Versioning, Source Provenance.
- **Security or migration impact:** Medium. License, hash, and fallback mistakes affect release
  safety.
- **Needed for M1:** No.
- **Needed for first vertical slice:** No.
- **Current status:** `DEFERRED`.
- **MASTER_SPEC refs:** 3, 61.7, 61.8, 61.19.

### Plugin Contract

- **Purpose:** Defines plugin metadata, compatibility, permissions, lifecycle, commands, effects,
  view model extensions, save data, and migrations.
- **Owner:** Plugin API owner.
- **Producers:** Plugin authors, engine extension maintainers.
- **Consumers:** Engine runtime, validation, build tooling, Editor, Save, migrations.
- **Visibility:** Public.
- **Stability:** planning.
- **Versioning:** Plugin API major/minor plus plugin package semantic version.
- **Dependencies:** Entity Identity, Schema Versioning, Command, Effect, View Model, Save,
  Migration.
- **Security or migration impact:** High. Plugins must not bypass command, transaction, and effect
  pipeline or use forbidden internals.
- **Needed for M1:** No.
- **Needed for first vertical slice:** No.
- **Current status:** `DEFERRED`.
- **MASTER_SPEC refs:** 25, 27, 61.12, 61.36.

### Script Extension Contract

- **Purpose:** Defines typed, registered extension points for custom logic while banning arbitrary
  executable code in game data.
- **Owner:** Engine contract and security owners.
- **Producers:** Engine extension maintainers, plugin authors.
- **Consumers:** Condition, Effect, Check, validation, plugin lifecycle.
- **Visibility:** Public for extension authors.
- **Stability:** planning.
- **Versioning:** Extension API version and permission model version.
- **Dependencies:** Plugin, Condition, Effect, Check Resolver, Validation Diagnostic.
- **Security or migration impact:** High. This is the boundary preventing unsafe data execution.
- **Needed for M1:** No.
- **Needed for first vertical slice:** No.
- **Current status:** `DEFERRED`.
- **MASTER_SPEC refs:** 61.3, 61.12, 61.13, 61.36.

### Source Provenance Contract

- **Purpose:** Defines source file, source entity ID, source revision, task, commit, generator, and
  approval metadata for generated or compiled entities.
- **Owner:** Tooling and Editor owners.
- **Producers:** Editor, compiler/build pipeline, AI draft tools, migrations.
- **Consumers:** Validation, diagnostics, context packs, handoffs, runtime error reports.
- **Visibility:** Public.
- **Stability:** planning.
- **Versioning:** Provenance metadata schema version.
- **Dependencies:** Entity Identity, Schema Versioning.
- **Security or migration impact:** Medium. Missing provenance makes review, rollback, and error
  localization unreliable.
- **Needed for M1:** No.
- **Needed for first vertical slice:** Yes, minimal only.
- **Current status:** `IDENTIFIED`.
- **MASTER_SPEC refs:** 61.6, 61.33, 61.34.

### Runtime Error Contract

- **Purpose:** Defines safe runtime error categories, recovery metadata, diagnostic export, and
  player-safe messaging.
- **Owner:** Runtime boundary and validation owners.
- **Producers:** Engine, runtime adapters, plugin adapters, asset pipeline.
- **Consumers:** Runtime UI, Editor bug task creation, diagnostics, support tooling.
- **Visibility:** Public diagnostic contract; internal stack traces remain private.
- **Stability:** planning.
- **Versioning:** Error envelope version and category registry version.
- **Dependencies:** Validation Diagnostic, Source Provenance, Entity Identity.
- **Security or migration impact:** Medium. Must avoid leaking stack traces, secrets, hidden content,
  or prompts.
- **Needed for M1:** No.
- **Needed for first vertical slice:** No.
- **Current status:** `DEFERRED`.
- **MASTER_SPEC refs:** 61.9, 61.21.

### Editor Draft and Approval Contract

- **Purpose:** Defines draft states, approval states, roles, AI provenance, diff readiness, and what
  may become canonical.
- **Owner:** Editor workflow owner.
- **Producers:** Editor, AI draft tools, reviewers.
- **Consumers:** Git workflow, validation, context packs, build tooling.
- **Visibility:** Public workflow contract.
- **Stability:** planning.
- **Versioning:** Workflow metadata schema version.
- **Dependencies:** Source Provenance, Validation Diagnostic, Context Pack.
- **Security or migration impact:** Medium. AI drafts must not silently become canonical or alter
  public contracts without review.
- **Needed for M1:** No.
- **Needed for first vertical slice:** No.
- **Current status:** `DEFERRED`.
- **MASTER_SPEC refs:** 34, 61.14, 61.15, 61.33.

### Context Pack Contract

- **Purpose:** Defines the manifest, version, hash, included files, active task, relevant contracts,
  and freshness checks for AI and editor-assisted work.
- **Owner:** AI workflow and tooling owners.
- **Producers:** Editor, agent tooling, handoff tooling.
- **Consumers:** AI agents, reviewers, validation, task workflow.
- **Visibility:** Public workflow contract.
- **Stability:** planning.
- **Versioning:** Context pack manifest version plus hash over included content.
- **Dependencies:** Source Provenance, Validation Diagnostic, active task metadata.
- **Security or migration impact:** Medium. Stale context can cause wrong-scope edits or contract
  violations.
- **Needed for M1:** No.
- **Needed for first vertical slice:** No.
- **Current status:** `DEFERRED`.
- **MASTER_SPEC refs:** 61.34, 37, 40, 60.

### Architecture Boundary Contract

- **Purpose:** Defines allowed dependencies between Engine, Game Data, UX, Editor, Tooling, plugins,
  themes, and saves.
- **Owner:** Architecture owner.
- **Producers:** Governance docs, validation rules, ADRs.
- **Consumers:** CI validation, code review, agents, package design.
- **Visibility:** Public governance contract.
- **Stability:** planning.
- **Versioning:** Governance contract version; changes require ADR if they alter layer permissions.
- **Dependencies:** Entity Identity, public contract registry.
- **Security or migration impact:** High. Boundary violations couple engine behavior to concrete
  games or presentation.
- **Needed for M1:** Yes.
- **Needed for first vertical slice:** Yes.
- **Current status:** `IDENTIFIED`.
- **MASTER_SPEC refs:** 2A, 37, 58.3, 61.36.

## Boundary Findings

- Engine must not depend on a concrete game package.
- UX may issue Commands and render View Models; it must not mutate Engine State directly.
- Game Data must remain declarative and must not contain arbitrary JavaScript.
- Editor must not be a runtime dependency.
- Theme must not change game state or save semantics.
- Plugins must enter through declared command, transaction, effect, and extension boundaries.
- Save must persist game state, not UX layout.
- Event is neither Command nor Effect; it records what happened after commit.
- View Model is not a copy of internal Engine State; it is a safe projection.

## ADR Assessment

No new ADR is required by this inventory. Existing ADR-0001 covers greenfield independence and layer
boundaries. TASK-002 only inventories and elaborates those existing boundaries; it does not create a
new architectural decision. Future ADRs may be needed when a public contract changes behavior, when
runtime/editor frameworks are selected, or when extension permissions are designed.
