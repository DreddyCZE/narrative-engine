# Engine State Contract

## Status

DRAFT

## Contract ID

`engine-state`

## Contract Version

`engine-state@0.1.0`

This is the first M1 draft. It is public but not stable. Acceptance of TASK-006 makes this the
current design output; it does not promote the contract to `stable` or `1.0.0`.

## Owner

`packages/engine-state`; engine validation and contract consumers.

## Purpose

Engine State defines the authoritative runtime state boundary for a single running playthrough and
its associated persistent meta state. It explains what belongs in state, what does not, how state
is identified, how changes are prepared and validated, and how canonical snapshots are serialized
for future transaction and save contracts.

This contract does not implement a State Store, transaction pipeline, Condition Resolver, Effect
Executor, Command pipeline, or save system.

## Normative Terms

The terms MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are normative:

- MUST and MUST NOT define required behavior.
- SHOULD and SHOULD NOT define expected behavior with documented exceptions.
- MAY defines explicitly permitted behavior.

## Terminology

- **Runtime state:** The authoritative live state currently held by the engine.
- **Run state:** The authoritative state for one playthrough, including run metadata and run
  domains.
- **Meta state:** Persistent cross-run state that survives restart or loop boundaries.
- **Session state:** Client-local ephemeral UI or tool state. It is not part of Engine State.
- **Derived state:** Non-authoritative values reconstructed from authoritative state.
- **Committed state:** The last validated state committed by the engine.
- **Working state:** A mutable or copy-on-write candidate state.
- **Candidate state:** A working state prepared for validation and commit.
- **State snapshot:** The deterministic serializable representation of Engine State at one moment.
- **State domain:** A versioned sub-structure with its own schema, ownership, persistence profile,
  and authority label.

## State Taxonomy

- Engine State is the only authoritative source of current game state.
- UI MUST NOT mutate Engine State directly.
- Game Data are not runtime state.
- View Model is not authoritative state.
- Event Log is not automatically the same as current state.
- Cache and derived values are not authoritative unless explicitly declared.
- Future changes will flow through Command → Transaction → Effect.
- Direct mutation from plugins, UI, or game data is forbidden.
- Engine State MUST be deterministically serializable.
- Runtime state MUST NOT contain DOM references, functions, promises, open handles, network
  connections, or executable code.

`run` is the current playthrough container. `meta` is the cross-run container. `session` is
external to Engine State and belongs to the client or editor session model.

### Field Placement Decisions

- `stateId` belongs to the root snapshot envelope. It identifies the logical state branch and is not
  a Save Envelope field.
- `revision` belongs to the root committed state. It is part of structural identity.
- `seed` belongs to the snapshot only when deterministic replay requires it.
- `activeModules` belongs to the run state when the current run needs to record the active set for
  validation or replay. The installed module list itself belongs to the game manifest or future
  save metadata, not to Engine State.
- `engineVersion` and `gameVersion` do not belong to Engine State. They belong in the future Save
  Envelope or external compatibility metadata.
- Save-only metadata such as save slot, save name, save timestamp, screenshot, user note, checksum,
  or platform metadata MUST NOT appear in Engine State.

## Root Envelope

The canonical root envelope is a snapshot envelope, not a save envelope. It is intentionally minimal
and uses a separate state identifier rather than an Entity Identity ID.

`stateId` is a stable state-branch identifier with the grammar:

```text
state.<scope>.<name>
```

`stateId` is not an Entity Identity ID. It identifies the logical branch or snapshot family of the
state, not a gameplay entity.

`revision` MUST be a non-negative integer. It starts at `0` and increases by exactly `1` after each
successful committed state change.

`meta` MAY be omitted when a snapshot has no cross-run domains. When present, it follows the same
canonical serialization rules as `run`.

The root envelope SHOULD use this top-level key order:

1. `contractVersion`
2. `schemaId`
3. `schemaVersion`
4. `stateId`
5. `revision`
6. `requiredDomains`
7. `run`
8. `meta`

Example:

```json
{
  "contractVersion": "engine-state@0.1.0",
  "schemaId": "engine-state",
  "schemaVersion": 1,
  "stateId": "state.runtime.current",
  "revision": 0,
  "run": {
    "seed": "demo-seed",
    "activeModules": ["module.core"],
    "domains": []
  }
}
```

Engine and game versions are not authoritative Engine State. If needed, they belong in the future
save envelope or external compatibility metadata, not in equality-sensitive state.

## State Domains

State is composed of versioned domains. Every domain MUST declare:

- `domainId`
- `schemaId`
- `schemaVersion`
- `owner`
- `authority`
- `persistence`
- `data`

### Domain ID

`domainId` uses the grammar:

```text
state-domain.<scope>.<name>
```

`domainId` is not an Entity Identity ID. It is a state-domain identifier with its own namespace.
Domain IDs are canonical lowercase identifiers and MUST be unique within a snapshot.

### Ownership

`owner` is the stable owner token for the domain, such as `engine`, `game`, or `module.foo`.
Ownership identifies who defines the domain schema and owns its evolution. It does not grant
authority by itself.

### Authority

The minimal authority model is:

- `engine`
- `module`
- `game`

`ui`, `editor`, and `plugin` are not authorities for Engine State. Plugins may change state only
through future declared commands and effects.

### Persistence Profiles

The persistence profile MUST be one of:

- `transient`
- `run`
- `meta`
- `snapshot-only`
- `reconstructable`

Profiles mean:

- `transient`: runtime-only working data. It is not part of canonical snapshots.
- `run`: authoritative playthrough state that belongs in the snapshot.
- `meta`: authoritative state that persists between runs.
- `snapshot-only`: serialized auxiliary data that may be preserved in snapshots but is not
  authoritative.
- `reconstructable`: derived or rebuildable data that may be omitted from snapshots and rebuilt
  later.

Canonical snapshots SHOULD NOT contain `transient` domains. If they appear, the state is semantically
invalid for canonical Engine State.

### Data

`data` MUST be a JSON object. It MAY contain arbitrary JSON-safe nested data validated by the
domain's own schema. The domain schema is identified by `schemaId` and `schemaVersion`.

## Run and Meta State

`run` contains the active playthrough context and run domains. `meta` contains cross-run domains.
`run.domains` and `meta.domains` are separately ordered collections of state domains.

`requiredDomains`, when present, declares domains that MUST exist across `run.domains` and
`meta.domains`. If `requiredDomains` is absent, the snapshot may be empty.

`run.seed` is a stable deterministic seed string. `run.activeModules` is the set of active module
identifiers for the current run. The canonical source for module selection remains the game
manifest, but the live state records the active set for validation and replay.

## Equality and Determinism

- Structural equality compares canonical snapshot bytes.
- Semantic equality ignores non-authoritative, non-persisted, and derived content.
- Identity equality is the same `stateId` plus the same `revision`.
- `revision` is part of structural and identity equality.
- `stateId` does not by itself change semantic equality, but it does change identity equality.
- Domain ordering affects structural equality through canonical serialization, not the underlying
  game meaning.
- Provenance of derived values does not change semantic equality.
- Arrays are ordered unless a domain schema explicitly defines a set-like canonical order.
- Canonical objects MUST use deterministic key order.
- Canonical snapshots MUST be byte-for-byte reproducible from the same logical state.
- Pre-serialization validation MUST reject non-JSON runtime values before canonicalization.

## Revision Policy

- `revision` MUST start at `0`.
- `revision` MUST increase by exactly `1` for each successful committed state change.
- Rollback or failed validation MUST NOT change `revision`.
- Read-only operations MUST NOT change `revision`.
- `revision` MAY be used by future commands for optimistic concurrency.
- `revision` overflow is a blocker error.
- `revision` is not a substitute for transaction ID.

## Reference Policy

- Canonical snapshots MUST store canonical Entity Identity IDs for entity references.
- Aliases MAY be accepted only at import or boundary normalization time and MUST be resolved before
  commit.
- Canonical snapshots MUST NOT store alias IDs as canonical references.
- Dangling references are semantic validation errors in the affected domain.
- Typed references may exist at authoring or boundary layers, but the canonical snapshot stores the
  canonical ID string form.

## Initial State

Game Data MAY provide declarative initial-state fragments. The engine or a future initialization
step composes them into the first committed runtime snapshot.

- Initial state MUST validate against the same schemas as runtime snapshots.
- Initial state revision SHOULD be `0`.
- Start events, if any, belong to future Event and Transaction contracts.
- Initialization is a contract boundary, not a separate executable runner.

## Mutation Boundary

Engine State defines the boundary only:

- Reading MAY occur through read-only snapshot or query APIs.
- Change preparation MUST occur on a working or candidate state.
- The candidate state MUST be validated before commit.
- Commit MUST be atomic.
- On failure, the last valid committed state MUST remain unchanged.
- UI MUST NOT write directly to Engine State.

## Snapshot Lifecycle

Normative lifecycle:

```text
Committed State
→ Working State
→ Candidate State
→ Validation
→ Commit or Rollback
```

- Committed State is immutable from the perspective of the running engine.
- Working State may be mutable or copy-on-write.
- Candidate State is the version prepared for validation.
- The contract does not require a specific immutability library.

## Validation Layers

- Structural validation checks JSON shape and local schema rules.
- Referential validation checks references to other entities and domains.
- Semantic validation checks domain invariants.
- Transaction validation decides whether the candidate state can be atomically committed.

Successful commit requires a valid resulting state.

## Error Categories

Recommended machine-readable categories:

- `INVALID_STATE_SHAPE`
- `UNKNOWN_STATE_DOMAIN`
- `DUPLICATE_STATE_DOMAIN`
- `SCHEMA_VERSION_UNSUPPORTED`
- `INVALID_REFERENCE`
- `INVARIANT_VIOLATION`
- `REVISION_CONFLICT`
- `NON_SERIALIZABLE_VALUE`
- `STATE_SIZE_LIMIT_EXCEEDED`
- `FORBIDDEN_OBJECT_KEY`

Minimum diagnostic fields:

- `code`
- `message`
- `path`
- `domainId`
- `entityId`
- `expected`
- `actual`

Sensitive internal details MUST NOT be shown to players by default.

## Value Model

Engine State snapshots MUST contain JSON-safe values only:

- object
- array
- string
- boolean
- integer
- finite number
- `null` only when the schema explicitly allows it

The following are forbidden in canonical snapshots:

- `undefined`
- `NaN`
- `Infinity`
- `-Infinity`
- functions
- symbols
- bigint unless a future explicit serialization contract exists
- Date objects
- Map
- Set
- class instances
- cyclic object graphs
- binary data unless a future blob or asset contract exists

Integer values SHOULD stay within JavaScript safe integer range. Negative zero is not permitted in
canonical snapshots.

## Performance and Limits

The contract MUST allow configurable limits for:

- maximum snapshot size
- maximum domain count
- maximum object depth
- maximum array length
- maximum string length
- maximum number of changes in one transaction

Concrete production limits are intentionally deferred. Snapshots and fixtures SHOULD still use
reasonable technical bounds where possible.

## Security Considerations

- Prototype pollution keys `__proto__`, `prototype`, and `constructor` MUST be rejected where they
  would affect object creation or hydration.
- Extremely deep or large structures can create denial-of-service risk.
- Non-finite numbers and cyclic data are forbidden.
- Snapshot data MUST NOT determine executable code.
- Provenance and metadata are untrusted and MUST NOT authorize writes.
- Plugin state injection is forbidden except through future declared state mutation contracts.
- Replay of an old revision MUST be rejected.
- Unknown state domains MUST be treated as invalid unless explicitly declared by the current
  contract or game package.
- Read-modify-write against an unknown newer schema version MUST be blocked.

## Canonical Serialization

Canonical Engine State MUST be deterministic:

- UTF-8 JSON
- LF line endings in fixtures
- two-space indentation
- final newline
- stable top-level key order
- stable `run.domains` and `meta.domains` order
- stable ordering for set-like arrays defined by the specific domain schema
- object keys sorted deterministically
- `undefined` omitted because it is not allowed
- empty optional blocks omitted unless they carry explicit meaning
- repeated canonicalization MUST be idempotent

`run.domains` and `meta.domains` SHOULD be sorted by `domainId`.

## Relationship to Future Contracts

- `Condition` will read committed state.
- `Effect` will describe state changes for candidate state.
- `Command` will express intent and may use `expectedRevision`.
- `Transaction` will control working state, validation, commit, and rollback.
- `Domain Event` will record the committed result.
- `Save` will store a validated snapshot inside its own envelope.
- `View Model` will produce a safe projection of state.

This contract does not define those contracts yet.

## Examples

Minimal empty state:

```json
{
  "contractVersion": "engine-state@0.1.0",
  "schemaId": "engine-state",
  "schemaVersion": 1,
  "stateId": "state.runtime.current",
  "revision": 0,
  "run": {
    "domains": []
  }
}
```

State with a run domain:

```json
{
  "contractVersion": "engine-state@0.1.0",
  "schemaId": "engine-state",
  "schemaVersion": 1,
  "stateId": "state.demo.current",
  "revision": 1,
  "run": {
    "seed": "demo-seed",
    "activeModules": ["module.world"],
    "domains": [
      {
        "domainId": "state-domain.core.clock",
        "schemaId": "state-clock",
        "schemaVersion": 1,
        "owner": "engine",
        "authority": "engine",
        "persistence": "run",
        "data": {
          "turn": 0
        }
      }
    ]
  }
}
```

## Known Limitations

- JSON Schema can validate local envelope and descriptor shape only.
- Referential integrity, revision history, transaction validity, and semantic invariants remain
  semantic or runtime validation.
- The contract does not implement a State Store, transaction runner, or save system.
- Session state is intentionally outside Engine State.

## Deferred Decisions

- Exact required core domains for every future game package.
- Specific save envelope layout.
- Concrete transaction boundary and command semantics.
- Exact diagnostics contract for revision conflict reporting.
- Specific performance budgets.
- Future permission/capability contract for cross-domain mutation.
