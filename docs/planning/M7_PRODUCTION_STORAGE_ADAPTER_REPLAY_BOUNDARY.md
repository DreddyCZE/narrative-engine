# M7 Production Storage Adapter / Replay Boundary

## 1. M7 Goal

M7 exists to design a safe Production Storage Adapter / Replay Boundary above the accepted M6 in-memory persistence boundary.

The goal is to:

- define how production storage adapters can persist accepted event and snapshot envelopes later
- preserve the runtime host as a pure and in-memory boundary
- keep concrete production storage concerns outside runtime execution and outside the core persistence contracts
- avoid introducing UI/editor, gameplay/P0 content, plugin runtime, or external network behavior into runtime execution

M7 planning does not implement production file IO, DB storage, replay runtime behavior, or migration tooling. It defines the boundaries, interfaces, serialization rules, and task sequence required for future implementation.

## 2. Why M7 Exists

M5 delivered the pure in-memory runtime command execution boundary.

M6 delivered:

- persistence contracts
- in-memory Event Store boundary
- in-memory Save snapshot boundary
- runtime result to Event Store adapter
- in-memory persistence integration coverage

That gives the repository a deterministic runtime-to-persistence path in memory only. M7 exists to plan how production storage and replay can be added safely without leaking concrete IO, DB logic, serialization side effects, or replay orchestration into the runtime host or the accepted M6 persistence boundary.

## 3. Architecture Boundary

### Runtime host

The runtime host remains responsible for:

- consuming runtime inputs
- returning deterministic runtime results
- returning runtime domain event values
- avoiding production storage writes

The runtime host must never:

- write production files
- write databases
- choose a storage backend
- perform replay orchestration
- evaluate storage migrations

### Persistence boundary

The persistence boundary remains the layer that:

- validates event and snapshot envelopes
- owns append, save, and load semantics
- returns deterministic persistence diagnostics and metadata
- stays separate from UI/editor and gameplay flow

### Storage adapter boundary

The storage adapter boundary is a future implementation layer below persistence orchestration.

It should:

- implement concrete file or DB IO in explicit later tasks
- accept validated persistence inputs only
- expose append, save, load, list, and health-check capabilities through a common interface
- remain completely separate from runtime logic evaluation

### Replay boundary

Replay is a future boundary adjacent to persistence, not part of live command execution.

It should:

- rebuild state from snapshots plus later events or from event streams alone
- use validated persistence data only
- remain deterministic and diagnostic-rich
- avoid calling UI/editor or plugin logic

### UI / editor / plugin boundary

UI, editor, and plugin surfaces remain outside M7 planning scope except as future consumers of explicit persistence and replay boundaries. They must not bypass persistence contracts or call storage backends directly.

## 4. Production Storage Adapter Strategy

M7 should define a common storage adapter interface that later backends must satisfy.

### Core capabilities

A future adapter should support:

- append events
- save snapshots
- load snapshots
- list or read event records
- report diagnostics and health state
- surface transaction and atomicity metadata explicitly

### Deterministic serialization

The adapter strategy should require:

- canonical JSON serialization for persistence envelopes
- stable key ordering
- explicit UTF-8 and newline expectations where file-based storage appears later
- explicit checksum or hash fields outside runtime meaning
- deterministic schemaVersion and contractVersion handling

### Adapter metadata

The adapter boundary should carry:

- adapter kind
- backend-neutral diagnostics
- persistence operation metadata
- idempotency and duplicate handling outcomes
- storage health or corruption indicators when relevant

### Idempotency and atomicity

The strategy should define:

- how append or save detects identical duplicates safely
- how conflicting duplicates are rejected deterministically
- which operations require all-or-nothing behavior
- how partial-write failure modes are surfaced as explicit diagnostics

## 5. File Adapter Boundary

M7 planning should reserve a future JSON file adapter as an explicit boundary.

### File adapter expectations

- the future file adapter should live in a dedicated boundary task, not in runtime host code
- directory layout should separate event records, snapshots, indexes, and adapter metadata
- atomic write strategy should use a future temp-file or write-then-rename plan
- corruption detection should rely on checksums, shape validation, and version checks
- file adapter diagnostics should distinguish missing data, unreadable data, and invalid canonical data

No file IO is implemented in TASK-060.

## 6. DB Adapter Boundary

M7 planning should reserve a future DB adapter as a separate, later boundary.

### DB adapter expectations

- event table or equivalent append-only record collection
- snapshot table or equivalent snapshot collection
- schema version metadata table
- migration coordination rules
- transaction constraints for append and snapshot save operations
- adapter diagnostics for constraint conflicts, connectivity, and version mismatch

No database adapter is implemented in TASK-060.

## 7. Replay Boundary

Replay remains planning-only in M7.

### Replay entry points

Future replay should support:

- rebuild from snapshot plus subsequent event records
- rebuild from event stream only when no trusted snapshot is available

### Replay expectations

- replay inputs must be version-aware and validated before rebuild
- replay must preserve deterministic rebuild semantics
- replay diagnostics must distinguish invalid persistence data from runtime rule failures
- replay must not call UI/editor or plugin runtime
- replay must not mutate source event records or snapshots
- replay must not bypass content or runtime contracts

Replay implementation remains deferred to later tasks.

## 8. Migration / Schema Evolution Strategy

M7 planning should define how persistence schemas evolve without corrupting stored data.

### Versioning expectations

- event and snapshot envelopes should carry explicit schema versions
- content package references and runtime version references should remain explicit
- migration compatibility should be checked before load or replay
- migration diagnostics should remain deterministic and machine-readable

### Migration boundary

A future migration registry should:

- register supported migration paths
- declare deterministic or lossy migration properties
- reject unsupported upgrade or downgrade paths explicitly
- keep migration execution outside runtime host execution

### Failure modes

Planned failure modes should include:

- unsupported schema version
- missing migration path
- invalid migrated envelope
- backward compatibility violation
- version mismatch between persistence data and runtime/content expectations

## 9. Test Strategy

M7 should plan tests for:

- storage adapter interface conformance
- canonical serialization and schema version validation
- file adapter behavior using temp directories only in an explicit future file-adapter task
- replay deterministic smoke tests in explicit replay-scoped tasks
- migration validation and failure diagnostics
- corruption and health-check diagnostics
- proof that runtime host never writes production storage directly
- proof that UI/editor and plugin surfaces remain outside persistence internals

Tests should remain:

- data-first
- deterministic
- boundary-focused
- explicit about deferred production IO work

## 10. M7 Task Breakdown

Recommended task sequence:

1. `TASK-061 - Storage adapter interface contracts`
2. `TASK-062 - Serialization and schema version contracts`
3. `TASK-063 - File storage adapter boundary`
4. `TASK-064 - Replay planning and contract boundary`
5. `TASK-065 - Storage adapter conformance tests`
6. `TASK-066 - M7 gate review`

### Breakdown notes

- `TASK-061` should define public storage adapter interface contracts and capability/result shapes.
- `TASK-062` should define canonical serialization and persistence schema version compatibility contracts.
- `TASK-063` should implement the first explicit production file-storage boundary with isolated IO.
- `TASK-064` should define replay-specific boundaries and deterministic rebuild contracts before implementation broadens.
- `TASK-065` should prove adapter conformance and prevent runtime-host leakage into storage behavior.
- `TASK-066` should audit the completed M7 planning and implementation boundary.

## 11. Non-Goals

M7 planning explicitly excludes:

- production storage implementation inside TASK-060
- file IO inside TASK-060
- DB implementation
- cloud or external network storage
- UI/editor save-load flow
- gameplay/P0 content
- plugin runtime
- auth or multi-user save behavior

## 12. Risks and Open Questions

Key risks and open questions:

- how deterministic timestamps should be handled in production persistence metadata
- how atomic file writes will be guaranteed without corrupting canonical data
- how corruption detection and recovery should be surfaced safely
- how schema migration complexity will be kept bounded and testable
- how replay semantics will stay deterministic across content and runtime versions
- how to guarantee storage adapters never call runtime execution logic directly
- how future UI save/load flow will remain constrained to persistence boundaries
- Node version mismatch remains environment debt until local Node aligns with Node 22

## 13. Recommendation

First implementation task after this plan is accepted:

- `TASK-061 - Storage adapter interface contracts`
