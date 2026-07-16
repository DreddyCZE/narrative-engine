# Prototype Milestone Checkpoint And Next Gameplay Scope

## Checkpoint Verdict

`PROTOTYPE_CHECKPOINT_PASS_READONLY_VERTICAL_SLICE_STABLE`

## Next Scope Recommendation

`NEXT_SCOPE_RECOMMENDATION_CONTROLLED_MOVEMENT_VERTICAL_SLICE`

## 1. Accepted Engine And Runtime Boundaries

The current accepted engine/runtime stack for the browser prototype is:

- content package contract
- content package loader boundary
- content read model boundary
- runtime player state contract
- runtime command request validation boundary
- runtime command planning boundary
- read-only look command executor boundary
- read-only inventory command executor boundary
- read-only runtime command execution facade
- read-only runtime request execution facade
- UI-neutral read-only interaction boundary

These boundaries collectively establish a public, deterministic, in-memory path from content package data to read-only UI interactions without introducing mutable gameplay execution.

## 2. Accepted Prototype UI State

The current accepted prototype UI state lives in `apps/runtime` and includes:

- browser prototype shell
- scenario, location, inventory, transcript/output, and diagnostics panels
- command palette with enabled `look` and `inventory`
- visible but disabled `go`, `talk`, `take`, `use`, `save`, and `load`
- UI-only read-only map/layout panel
- data-driven scenario selector
- app-layer scenario registry
- app-layer map registry

The current prototype demonstrates a real browser consumer over the accepted read-only runtime surface while remaining strictly in-memory.

## 3. Architecture Principles Confirmed

The current milestone confirms the following architecture decisions:

- engine logic, content data, and UX rendering are separate concerns
- the UI can switch content packages without modifying engine contracts
- map layout data is UI-layer only and is not part of engine schema
- prototype scenario data is app-layer demo content, not final P0 story content
- disabled gameplay actions may be visible in the UI but remain non-executable

This is the first concrete proof that the project can evolve the UX without collapsing the engine/data separation.

## 4. Current Forbidden Scope

The following scope remains explicitly forbidden after this checkpoint:

- no mutable movement yet
- no item pickup yet
- no dialogue progression yet
- no use/effect execution yet
- no save/load UI integration yet
- no replay runtime
- no DB storage, external storage, or browser storage
- no P0 story package
- no map editor
- no plugin runtime

These are not soft cautions. They remain out of scope until a later task explicitly accepts them.

## 5. Recommended Next Larger Scope

Recommended future task only:

`TASK-101 - Controlled read-only-to-movement planning vertical slice`

This task is not created here and must remain a future recommendation only.

### Recommended Future TASK-101 Shape

- enable `Go` only when a selected exit exists in the current scenario
- continue routing through request validation and command planning boundaries
- add a movement execution boundary only if it remains narrowly scoped and deterministic
- produce either a deterministic state transition proposal or a tightly controlled state update surface
- update current location only through the new accepted movement boundary
- preserve data-driven scenario support and UI-only map layouts
- verify map highlight changes only after accepted movement execution
- keep `look` and `inventory` working through the existing interaction boundary

### Explicit Exclusions For Future TASK-101

- no free-form parser
- no item pickup
- no dialogue progression
- no use/effect execution
- no save/load UI
- no replay runtime
- no DB or browser storage

## 6. Risk Register

### Risk: UI growth bypasses engine boundaries

- Why it matters: UI convenience code could call lower-level planners or executors directly.
- Mitigation: keep UI code restricted to public engine-contract exports and require review for any new runtime entrypoint.

### Risk: prototype scenario data becomes final game data too early

- Why it matters: app-layer demo content could quietly harden into story canon and distort engine design.
- Mitigation: keep prototype scenarios explicitly labeled as demo content and block P0 package introduction until a dedicated content task accepts it.

### Risk: map layout leaks into engine schema prematurely

- Why it matters: UI spatial metadata could pollute content contracts before gameplay requirements are stable.
- Mitigation: keep map coordinates, tile layout, and connections in `apps/runtime` only until a future ADR or task defines an engine-level map contract.

### Risk: movement mutation lands without replay/save implications

- Why it matters: even a small mutable movement feature affects determinism, persistence assumptions, and later replay boundaries.
- Mitigation: scope movement through a dedicated boundary task with explicit state transition rules, deterministic tests, and documented non-goals.

### Risk: command palette drifts into an accidental parser

- Why it matters: a palette intended as a constrained UI could become a generic command input path prematurely.
- Mitigation: keep the palette action list explicit, enumerated, and typed; do not introduce arbitrary text command parsing.

### Risk: storage or replay concerns get mixed into prototype work too early

- Why it matters: prototype UX iteration could start carrying persistence or replay assumptions before those layers are reopened deliberately.
- Mitigation: preserve the current in-memory-only rule and reject any browser storage, DB, replay, or save/load UI scope in prototype tasks until later acceptance.

## 7. Future Review Checklist

- Confirm any next gameplay slice still uses public engine boundaries rather than direct lower-level executor calls.
- Confirm movement, if introduced later, is accepted by a dedicated task and is not hidden inside UI work.
- Confirm scenario data remains app-layer only unless a new content contract task explicitly changes that rule.
- Confirm map layout data remains UI-layer only unless an ADR or accepted contract task changes it.
- Confirm disabled future commands remain visible-but-safe until their execution boundaries are accepted.
- Confirm no replay runtime, DB, browser storage, or plugin runtime slips into prototype tasks.
- Confirm no P0 story content package is introduced before a dedicated content task accepts it.
- Confirm new prototype work remains deterministic and testable across the supported scenarios.
