# M7 Replay Boundary Checkpoint And Next Contract

## Replay Checkpoint Verdict

`REPLAY_BOUNDARY_CHECKPOINT_PASS_WITH_RUNTIME_DEFERRED`

## Next Scope Recommendation

`NEXT_SCOPE_RECOMMENDATION_REPLAY_SOURCE_DESCRIPTOR_CONFORMANCE`

## 1. Existing Replay Artifacts

The current replay side of M7 is defined by the following existing artifacts:

- `docs/planning/M7_REPLAY_BOUNDARY.md`
- `docs/planning/M7_PRODUCTION_STORAGE_ADAPTER_REPLAY_BOUNDARY.md`
- replay contract exports from `packages/engine-contracts/src/index.ts`
- replay contract type definitions in `packages/engine-contracts/src/replay/replay-types.ts`
- replay contract coverage in `tests/replay-contracts.test.ts`

These artifacts establish replay as a contract and planning boundary only. They define replay statuses, source descriptors, diagnostics, metadata, plan shapes, and validation helpers, but they do not execute replay or rebuild state.

## 2. Current Replay Public Surface

The current replay public surface, verified from `packages/engine-contracts/src/index.ts`, is:

- `ReplayStatus`
- `ReplayInput`
- `ReplayResult`
- `ReplayPlan`
- `ReplayDiagnostic`
- `ReplayMetadata`
- `ReplaySourceDescriptor`
- `ReplayStorageReference`
- `ReplaySnapshotSource`
- `ReplayEventStreamSource`
- `ReplaySnapshotAndEventsSource`
- `ReplayStorageAdapterSource`
- `ReplayDeterminismPolicy`
- `ReplayEventRange`
- `ReplayStepDescriptor`
- `ReplaySourceKind`
- `REPLAY_STATUSES`
- `REPLAY_SOURCE_KINDS`
- `isReplayStatus`
- `isReplaySourceKind`
- `inspectReplayInput`
- `assertReplayInput`
- `createReplayResult`
- `createReplayPlan`
- `inspectReplayPlan`
- `formatReplayValidationMessage`

This is the currently available replay contract surface. No replay runtime API exists beyond these contract and validation helpers.

## 3. Current Replay Boundary

What currently exists:

- replay planning and contracts only
- input, result, and plan descriptors
- source descriptor contracts for snapshot-only, event-stream-only, snapshot-and-events, and storage-adapter sources
- deterministic policy metadata
- diagnostic formatting and validation helpers
- tests proving the replay contract boundary

What does not exist:

- no replay runtime execution
- no event stream replay implementation
- no state rebuild from events
- no deterministic replay runner
- no replay storage adapter runtime flow
- no replay UI
- no gameplay or P0 content integration
- no network or external storage replay

The current replay boundary therefore remains contract-only and planning-only.

## 4. Relationship To Save/Load Workstream

The completed save/load workstream changes the context around replay, but it does not implement replay:

- storage adapter contracts now exist
- file and memory adapters exist
- game state save/load exists
- save/load public service and diagnostics exist
- public save/load scenario exists
- replay runtime behavior is still deferred

This distinction is important:

- save/load can store and restore state
- replay should eventually reconstruct or verify state transitions from event or history sources
- replay runtime execution is not implemented today

The save/load workstream therefore supports the future replay context without replacing replay-specific contract or runtime work.

## 5. Candidate Next Replay Tasks

### Option A. Replay source descriptor conformance tests

Pros:

- stays contract-level
- strengthens source descriptors before runtime
- low risk of scope drift

Risks:

- still abstract and not visible to gameplay or UI

Guardrails:

- no runtime replay execution
- no state rebuild
- no storage IO beyond contract fixtures

### Option B. Replay plan validation hardening

Pros:

- strengthens `ReplayPlan` and `ReplayInput` validation
- clarifies deterministic replay preparation
- useful before any replay runner

Risks:

- could over-design plan shape too early

Guardrails:

- stay with current public contract types
- no runner
- no event execution

### Option C. Replay runtime spike

Pros:

- visible progress toward actual replay

Risks:

- high risk of implementing replay runtime too early
- could pull in event stream execution and state rebuild before contracts are ready

Guardrails:

- should remain deferred unless explicitly accepted later

### Option D. UI replay or debug viewer

Pros:

- useful later for tooling

Risks:

- violates the current no-UI direction
- depends on replay runtime that does not exist yet

Guardrails:

- defer

## 6. Recommended Next Contract Scope

Recommended next task:

`TASK-076 - Replay source descriptor conformance tests`

Reason:

- it stays contract-level
- it strengthens replay input and source shapes before runtime
- it avoids jumping into replay runner or state rebuild too early
- it fits the M7 replay boundary without UI or gameplay drift

This checkpoint therefore makes the following explicit decisions:

- Do not start replay runtime execution yet.
- Do not start state rebuild from events yet.
- Do not start replay UI or debug viewer yet.
- Do not start gameplay or P0 content yet.
- Next task should be contract-level replay source descriptor conformance tests.

## 7. Acceptance Summary

The replay boundary checkpoint passes because:

- the current replay contract surface is explicit and documented
- replay remains clearly separated from save/load behavior
- runtime replay implementation is still explicitly deferred
- the next safe replay task can remain contract-level rather than implementation-heavy

The recommended next step is to continue with replay source descriptor conformance rather than starting replay execution, UI, or gameplay-adjacent work.
