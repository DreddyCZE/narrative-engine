# M5 Runtime Host / Command Execution Integration

## 1. M5 Goal

M5 should define a safe runtime host boundary over the validated content graph produced by M4 and
connect that boundary to the accepted M2 command, condition, effect, transaction, and domain-event
primitives.

The goal is to:

- design a runtime host boundary that consumes a validated content graph value
- integrate command execution flow through accepted M2 primitives
- keep the runtime host pure and in-memory for the full milestone
- avoid Save, Event Store, persistence, UI, gameplay, or plugin runtime scope

## 2. Why M5 Exists

M2 delivered deterministic primitive contracts and reference implementations for:

- conditions
- effects
- commands
- transactions
- domain events

M3 delivered the data-model and content-runtime boundary:

- content package contracts
- validation diagnostics and reference rules
- minimal neutral fixture coverage
- content-to-M2 primitive integration rules

M4 delivered the validation boundary above raw content input:

- content loader input/result types
- manifest and section validation
- ID indexing and duplicate detection
- reference validation
- M2 primitive binding validation
- validated content graph value building
- minimal fixture boundary integration test

M5 exists to define the next boundary: a runtime host that can safely use the M4 validated content
graph and the accepted M2 primitives without collapsing into Save, Event Store, UI, gameplay, or
plugin runtime concerns.

## 3. Architecture Boundary

### Layer roles

- `packages/engine-contracts`
  - own public runtime input/output types and shared deterministic result envelopes
  - own data-only helper types that remain serialization-safe and generic
- `packages/engine-kernel`
  - own pure and in-memory runtime host helpers
  - may compose accepted command planning, condition evaluation, effect application, transaction,
    and domain-event materialization boundaries
  - must not become persistence, Save, UI, plugin, or content-loading IO infrastructure
- content loader boundary output
  - provides the validated content graph value that the runtime host consumes
  - remains caller-provided input, not a file-loading side effect
- M2 primitives
  - remain the internal execution components used by the runtime host
  - must not be bypassed by ad hoc runtime logic
- future Save, Event Store, UI, editor, and plugin layers
  - stay outside M5
  - consume runtime results later through explicit boundaries

### Dependency rules

- `engine-kernel` may depend on `engine-contracts` and accepted public kernel boundaries only
- runtime host helpers may consume validated content graph values, not raw content package objects
- loader-boundary code must remain below the runtime host and must not import runtime orchestration
- Save/Event Store/UI/plugin layers must not be introduced as runtime host dependencies in M5

## 4. Runtime Host Boundary

The runtime host MAY:

- accept a validated content graph value
- accept a current Engine State snapshot
- accept a runtime command or action request
- resolve a command definition from the validated graph
- run condition checks through the accepted condition boundary
- build a command plan through the accepted command-planning boundary
- apply effects to a candidate state through the accepted transaction/effect boundaries
- run transaction processing fully in memory
- optionally materialize domain event values as return-only data after successful commit
- return a deterministic runtime result

The runtime host MUST NOT:

- write Save data
- write an Event Store
- read files or perform network access
- call UI or plugin code
- hardcode gameplay or P0 content
- bypass accepted M2 contracts
- mutate caller-owned graph or input state objects in place

## 5. Command Execution Flow

Recommended execution order:

1. Receive runtime command request.
2. Validate runtime input shape.
3. Resolve content command or action from the validated graph.
4. Resolve condition and effect bindings from validated graph records.
5. Evaluate conditions against the committed state snapshot.
6. Plan the command.
7. Apply effects to a candidate state.
8. Commit or reject through the in-memory transaction manager.
9. Materialize domain event values as return-only data.
10. Return a deterministic runtime result.

Deferred from this flow:

- Event Store writes
- Save writes
- persistence-side acknowledgments
- delivery pipelines

## 6. Runtime Result Contract

M5 should introduce a future runtime result shape with at least:

- `status`
  - `committed`
  - `rejected`
  - `blocked`
  - `error`
- previous state summary
- next state snapshot or patch summary
- diagnostics
- command plan summary
- transaction summary
- domain event values
- deterministic metadata

Design rules:

- the result must be JSON-safe and deterministic
- state outputs should prefer explicit summary plus committed snapshot ownership clarity
- diagnostics must remain machine-readable and stable
- event values are return data only and do not imply persistence or delivery

## 7. Implementation Boundaries

M5 MAY include:

- pure and in-memory runtime host helpers
- no file IO
- no persistence
- no UI
- no plugin runtime
- no gameplay hardcoding
- no external network calls

M5 MUST NOT include:

- Save system
- Event Store
- replay engine
- persisted world-state infrastructure
- editor workflow
- game UI
- plugin sandbox/runtime
- P0 or other game-specific content

## 8. Test Strategy

M5 should plan coverage for:

- valid command from the minimal fixture commits in memory
- false condition rejects deterministically
- invalid command ID is blocked deterministically
- effect failure rolls back or rejects according to the accepted transaction contract
- deterministic output for repeated identical inputs
- input state immutability
- validated graph immutability
- no file IO
- no Save or Event Store writes
- no UI or plugin calls

Tests should stay neutral and fixture-driven where possible.

## 9. M5 Task Breakdown

Recommended task sequence:

1. `TASK-046 - Runtime host input/result contracts`
2. `TASK-047 - Runtime command request resolver`
3. `TASK-048 - Runtime condition/effect binding adapter`
4. `TASK-049 - In-memory command execution pipeline`
5. `TASK-050 - Runtime domain event return values`
6. `TASK-051 - Minimal fixture runtime command integration test`
7. `TASK-052 - M5 gate review`

## TASK-046 Follow-Through

`TASK-046 - Runtime host input/result contracts` delivers only the data boundary for runtime host input and result values.

Allowed output is limited to:

- runtime host status values and status guard
- runtime command request shape
- runtime host input, context, and metadata shapes
- runtime host result metadata shape
- command plan, transaction, and domain event summary values
- JSON-safe examples and export tests

TASK-046 does not add:

- command resolver behavior
- runtime execution
- condition evaluation flow
- effect application flow
- transaction commit flow
- domain event materialization flow
- Save, Event Store, persistence, UI/editor, gameplay/P0 content, plugin runtime, or production file loading
## TASK-047 Follow-Through

`TASK-047 - Runtime command request resolver` delivers only pure data-only command or action lookup over caller-provided `RuntimeHostInput` and validated content graph values.

Allowed output is limited to:

- deterministic command or action lookup by `RuntimeCommandRequest.commandId`
- stable resolve paths
- value-only resolved command summary data
- deterministic diagnostics for missing, invalid, unknown, ambiguous, or graph-invalid command requests
- input and validated graph immutability

TASK-047 does not add:

- runtime host execution
- condition evaluation flow
- effect application flow
- command execution
- transaction commit flow
- domain event materialization flow
- Save, Event Store, persistence, UI/editor, gameplay/P0 content, plugin runtime, production file loading, or file IO

## TASK-048 Follow-Through

`TASK-048 - Runtime condition/effect binding adapter` delivers only pure data-only condition and effect binding resolution over caller-provided `RuntimeHostInput`, `RuntimeResolvedCommand`, and validated content graph values.

Allowed output is limited to:

- deterministic condition definition lookup by `RuntimeResolvedCommand.conditionRefs`
- deterministic effect definition lookup by `RuntimeResolvedCommand.effectRefs`
- stable adapter paths for binding refs and resolved graph records
- value-only adapted condition and effect summary data
- deterministic diagnostics for missing, invalid, unknown, ambiguous, or graph-invalid condition/effect bindings
- input, resolved command, and validated graph immutability

TASK-048 does not add:

- runtime host execution
- condition evaluation flow
- effect application flow
- command execution
- transaction commit flow
- domain event materialization flow
- Save, Event Store, persistence, UI/editor, gameplay/P0 content, plugin runtime, production file loading, or file IO
## 10. Non-Goals

- no Save system
- no Event Store
- no persistence
- no replay
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
- no production file loader
- no external package loading

## 11. Risks and Open Questions

- where exactly the content loader boundary ends and the runtime host begins
- how to keep the runtime host pure and in-memory while still returning useful commit results
- how domain event values should be represented without introducing an Event Store
- how Save/Event Store can attach later without forcing a runtime host rewrite
- how to prevent hardcoded game-specific content drift
- how command failure and rollback semantics should stay aligned with the accepted transaction contract
- how deterministic output is preserved when multiple internal stages compose

## 12. Recommendation

First implementation task after this plan is accepted:

- `TASK-046 - Runtime host input/result contracts`

## TASK-050 Follow-Through

`TASK-050 - Runtime domain event return values` delivers only deterministic return-only runtime domain event values over caller-provided runtime host input, resolved command data, and committed in-memory transaction summaries.

Allowed output is limited to:

- deterministic runtime domain event return value records
- deterministic runtime domain event summary values
- optional non-breaking runtime host result integration
- validation diagnostics for invalid runtime event return-value graph inputs
- return-only payload summaries with explicit `persistence: "none"`

TASK-050 does not add:

- Event Store writes
- Save writes
- persistence
- replay
- subscriptions or delivery pipelines
- file IO
- UI/editor
- gameplay/P0 content
- plugin runtime
- external network calls
- long-running runtime host process

## TASK-051 Follow-Through

`TASK-051 - Minimal fixture runtime command integration test` delivers only deterministic integration coverage for the full in-memory runtime path over the existing minimal neutral fixture.

Allowed output is limited to:

- validated graph to runtime command execution integration coverage
- committed happy-path coverage
- blocked invalid-request and unknown-command coverage
- deterministic repeated-run coverage
- input state and validated graph immutability coverage
- runtime domain event return-value integration coverage

TASK-051 does not add:

- production file loading
- Save/Event Store writes
- persistence
- replay
- UI/editor
- gameplay/P0 content
- plugin runtime
- external network calls
- long-running runtime host process
