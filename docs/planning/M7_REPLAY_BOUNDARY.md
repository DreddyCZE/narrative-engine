# M7 Replay Boundary

## Replay Goal

The M7 replay boundary exists to define how future replay work can rebuild state deterministically without leaking replay orchestration into the runtime host, persistence contracts, or storage adapters.

Replay is contract-only in TASK-064. It does not execute replay, rebuild state, or invoke storage adapters.

## Relation to M6 and M7 Storage Boundaries

- M6 established deterministic persistence envelopes, in-memory Event Store behavior, in-memory snapshot behavior, and runtime-result-to-event persistence adaptation.
- M7 added production storage adapter planning, storage adapter contracts, serialization/schema contracts, and explicit file storage adapter boundaries.
- TASK-064 defines the replay-facing contract boundary that a future implementation will consume after validated persistence data has already been loaded.

Replay remains separate from:

- live runtime command execution
- runtime host result generation
- storage adapter write behavior
- UI/editor save-load flow

## Replay Source Types

Replay sources must remain explicit and data-only.

Current source categories are:

- `snapshot-only`
- `event-stream-only`
- `snapshot-and-events`
- `storage-adapter`

These categories allow future replay entry points to describe:

- snapshot-only rebuild candidates
- event-stream-only rebuild candidates
- snapshot plus subsequent event replay
- future file or storage-adapter sourced replay plans

## Replay Phases

A future replay implementation should follow these ordered phases:

1. load records
2. validate envelopes
3. validate schema versions
4. order events
5. rebuild state
6. produce diagnostics

TASK-064 defines these phases as planning and descriptor concepts only.

## Contract-Only Scope Now

TASK-064 currently delivers:

- replay statuses
- replay source kinds and source descriptors
- replay input, metadata, diagnostics, and result shapes
- replay plan and replay step descriptors
- deterministic replay policy metadata
- validation helpers for replay inputs and plans

TASK-064 does not deliver:

- replay execution
- state rebuild
- event-stream replay orchestration
- storage adapter invocation
- file IO
- DB access

## Deterministic Requirements

Future replay must preserve the deterministic guarantees already established by the accepted runtime and persistence boundaries.

Required expectations:

- timestamps remain logical-only unless a later ADR changes policy
- event ordering remains explicit and deterministic
- schema mismatches are rejected explicitly
- source records are treated as immutable inputs
- replay diagnostics remain stable and machine-readable
- replay plans must be reproducible from the same validated inputs

## Migration and Schema Version Concerns

Replay must remain schema-aware.

Future replay must:

- validate persistence schema versions before rebuild
- reject unsupported migration paths
- distinguish migration failures from runtime-rule failures
- keep schema migration separate from live runtime execution
- avoid silently rewriting persisted envelopes during replay

## Failure Modes

Replay boundary planning currently recognizes these failure categories:

- invalid replay source descriptor
- missing or invalid snapshot reference
- invalid event range ordering
- unsupported schema version
- missing migration path
- invalid storage reference metadata
- deterministic policy mismatch
- source mutation or non-JSON payload input

These remain contract-level diagnostics only in TASK-064.

## Non-Goals

TASK-064 explicitly excludes:

- replay runtime implementation
- file IO
- DB adapter behavior
- external storage adapter behavior
- UI/editor integration
- gameplay or P0 content behavior
- plugin runtime behavior
- external network behavior

## Future Implementation Tasks

Replay implementation remains deferred to later M7 work.

Expected next implementation-oriented tasks after TASK-064:

- `TASK-065 - Storage adapter conformance tests`
- future replay execution and rebuild tasks after explicit acceptance of replay contracts and conformance work
