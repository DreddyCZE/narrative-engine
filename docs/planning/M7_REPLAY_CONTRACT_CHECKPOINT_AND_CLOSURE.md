# M7 Replay Contract Checkpoint And Closure

## Replay Contract Checkpoint Verdict

`M7_REPLAY_CONTRACT_CHECKPOINT_PASS_CLOSE_M7`

## Next Scope Recommendation

`NEXT_SCOPE_RECOMMENDATION_CONTENT_RUNTIME_BOUNDARY`

## 1. Accepted Replay Contract Work

The replay contract side of M7 is now the result of four accepted tasks:

- `TASK-064 - Replay planning and contract boundary`
- `TASK-075 - Replay boundary checkpoint and next contract decision`
- `TASK-076 - Replay source descriptor conformance tests`
- `TASK-077 - Replay plan validation hardening`

Together these tasks established the replay contract surface, documented its boundary, froze source descriptor behavior, and tightened replay plan validation without implementing replay runtime execution.

## 2. Current Replay Contract Surface

The current public replay contract surface, verified from `packages/engine-contracts/src/index.ts`, is:

- replay statuses:
  - `ReplayStatus`
  - `REPLAY_STATUSES`
  - `isReplayStatus`
- replay source kinds and descriptors:
  - `ReplaySourceKind`
  - `REPLAY_SOURCE_KINDS`
  - `isReplaySourceKind`
  - `ReplaySourceDescriptor`
  - `ReplaySnapshotSource`
  - `ReplayEventStreamSource`
  - `ReplaySnapshotAndEventsSource`
  - `ReplayStorageAdapterSource`
  - `ReplayStorageReference`
  - `ReplayEventRange`
- replay input and result shapes:
  - `ReplayInput`
  - `ReplayResult`
  - `ReplayMetadata`
  - `ReplayDiagnostic`
  - `ReplayDeterminismPolicy`
- replay plan shapes:
  - `ReplayPlan`
  - `ReplayStepDescriptor`
- validation and construction helpers:
  - `inspectReplayInput`
  - `assertReplayInput`
  - `createReplayResult`
  - `createReplayPlan`
  - `inspectReplayPlan`
  - `formatReplayValidationMessage`

This is the current replay public surface. No replay runtime API exists beyond these contract and validation helpers.

## 3. Current Validation Coverage

Replay contract validation now covers:

- replay source kind registry stability
- valid source descriptor acceptance for all supported source kinds
- invalid source descriptor rejection
- storage reference validation
- event range validation
- replay input validation
- determinism policy validation
- replay plan step validation
- empty step array rejection
- duplicate step id rejection
- deterministic diagnostics
- developer-facing validation message formatting

The current replay tests now prove that replay input and replay plan validation behave deterministically at the contract level before any future replay runner exists.

## 4. Explicit Deferred Replay Runtime Work

The following replay work remains explicitly deferred:

- replay runtime execution
- event stream replay implementation
- state rebuild from events
- deterministic replay runner
- replay storage adapter runtime flow
- replay UI or debug viewer
- gameplay or P0 replay integration
- replay-driven debugging tools

These items are deferred intentionally. They are not implicitly delivered by the current replay contract or validation work.

## 5. Relationship To Completed Save/Load Work

The completed save/load workstream and the replay contract workstream now relate as follows:

- save/load can store and restore state
- replay is still contract-only and planning-only
- storage adapters and save/load boundaries can support future replay work
- save/load does not replace replay runtime behavior

Save/load gives the project stable persistence boundaries. Replay still needs a later runtime-focused milestone or task chain if state reconstruction from event history becomes a product need.

## 6. M7 Closure Options

### Option A. Close M7 after this checkpoint

Pros:

- storage adapter boundary is implemented
- save/load workstream is gated and ready for future UI consumption
- replay contract boundary is documented and tested
- replay runtime remains explicitly deferred instead of ambiguous
- the next milestone can move toward content, runtime, and gameplay foundation

Risks:

- replay runtime is not implemented yet
- future replay work will need a new milestone or later task chain

Guardrails:

- closure must state clearly that replay runtime is deferred, not forgotten

### Option B. Add one more replay contract task before closing M7

Pros:

- more validation could be added before closure
- later replay work might begin with slightly less ambiguity

Risks:

- diminishing returns at the current contract layer
- risk of over-designing replay contracts before runtime needs are known

Guardrails:

- only allow this path if a concrete contract gap is identified

### Option C. Start replay runtime now

Pros:

- visible progress toward replay execution

Risks:

- too early relative to current project needs
- likely to drag in state rebuild and event execution before content runtime is ready
- conflicts with the current explicit deferred-runtime decision

Guardrails:

- reject this option for now

## 7. Recommended Decision

Recommended decision:

`M7_REPLAY_CONTRACT_CHECKPOINT_PASS_CLOSE_M7`

Reason:

- storage adapter and save/load work are complete enough for their current boundary
- replay contract work is now documented and tested through TASK-077
- replay runtime can remain deferred to a later milestone without blocking current architectural progress
- the project now needs to move toward the content and runtime boundary required for a meaningful future prototype

This checkpoint therefore makes the following explicit decisions:

- Do not start replay runtime yet.
- Do not start replay UI or debug viewer yet.
- Do not start full gameplay or P0 content yet.
- Next task should define the content and runtime boundary needed for the first future playable prototype.

## 8. Suggested Next Task

Recommended next task:

`TASK-079 - Content runtime boundary checkpoint and first prototype path`

This should remain planning-first and contract-first rather than implementation-heavy work.

Its goal should be to start defining how content data, runtime commands, player state, locations, NPCs, items, and future UI connect without hardcoding P0 content too early.

## 9. Closure Summary

The replay contract side of M7 is ready to close because:

- the replay contract surface is explicit and public
- replay validation coverage is materially stronger than it was at TASK-064
- replay runtime remains clearly deferred
- no current contract gap justifies another replay-only task before closure

The recommended next scope is therefore content/runtime boundary planning rather than more replay contract work or replay runtime implementation.
