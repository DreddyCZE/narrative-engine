# Pickup Milestone Checkpoint And Next Command Scope

## Checkpoint Verdict

`PICKUP_MILESTONE_CHECKPOINT_PASS_CONTROLLED_PICKUP_STABLE`

## Next Scope Recommendation

`NEXT_SCOPE_RECOMMENDATION_CONTROLLED_TALK_PREVIEW_BOUNDARY`

## 1. Accepted Runtime Command Boundaries

The current accepted runtime command boundaries are:

- read-only `look`
- read-only `inventory`
- controlled explicit-exit `go`
- controlled explicit-visible-portable-item `take`

These boundaries collectively define the currently accepted deterministic runtime command surface. No generic command execution is accepted.

## 2. Accepted UI And Prototype Behaviors

The current accepted browser prototype behavior in `apps/runtime` includes:

- scenario selector
- read-only map/layout panel
- movement diagnostics for available, locked, and condition-gated exits
- read-only inspection panel
- read-only future action readiness
- app-layer item presence projection
- controlled pickup through explicit visible portable item buttons only
- inventory-owned item inspection hardening

This means the current prototype can render room state, inventory state, movement readiness, pickup readiness, and inspection state without widening engine contracts beyond the accepted command boundaries.

## 3. Accepted Mutation Scope

The current accepted runtime player state mutation scope is exactly:

### Movement may mutate

- `currentLocationId`
- `revision`
- `metadata.updatedAtRevision`

### Pickup may mutate

- `inventoryItemIds`
- `revision`
- `metadata.updatedAtRevision`

Everything else must remain unchanged unless a later task explicitly accepts it.

## 4. Still Forbidden Scope

The following scope remains explicitly forbidden after the pickup milestone checkpoint:

- generic command execution
- free-form parser
- arbitrary target input
- `drop`
- `use`
- `talk` execution
- dialogue progression
- effect execution
- save/load UI
- replay runtime
- browser storage
- external storage
- DB adapter
- map editor
- plugin runtime
- P0 story content
- hardcoded production story in engine contracts

These remain hard boundaries, not soft cautions.

## 5. Known Invariants

The current accepted invariants are:

- content item `locationId` is not mutated by pickup
- item movement between room and inventory views is projection-driven
- generic command palette `Take` remains disabled
- explicit item `Take` buttons are allowed only for `visible-here && portable`
- inventory-owned items are inspectable and not pickup targets
- blocked commands preserve player state
- output and diagnostics remain deterministic and JSON-safe
- app-layer scenario and map data remain separate from engine contracts

## 6. Next Command Recommendation

Recommended next command boundary only:

`talk`

Why `talk` before `use`:

- `talk` can be introduced as a controlled explicit-visible-NPC boundary without widening inventory or effect execution
- `talk` can remain read-mostly at first through deterministic preview output
- `use` likely requires effect modeling, condition changes, unlock behavior, and a broader effect system
- `talk` therefore preserves the current incremental boundary strategy better than `use`

This document does not create TASK-110. It only documents the recommended next direction.

## 7. Next Safe Task Outline

Suggested future direction only:

`TASK-110 - Controlled NPC talk preview boundary`

Suggested future scope for that task:

- explicit visible NPC selection
- planned `talk`
- dedicated talk executor boundary
- deterministic dialogue preview
- no dialogue progression yet
- no progress flag mutation yet
- no branching effects
- no relationship state
- no quests
- no P0 content

This is a future outline only. Do not create the task file here.

## 8. Risk Register

### Risk: scope creep from `use`

- Why it matters: `use` naturally pulls in effects, unlock logic, inventory-state consequences, and broader game rules.
- Mitigation: keep `use` deferred until a later task explicitly accepts effect-system scope.

### Risk: parser temptation

- Why it matters: command growth can create pressure to add free-form input prematurely.
- Mitigation: keep commands explicit, typed, and bound to visible UI targets only.

### Risk: inventory mutation drift

- Why it matters: follow-up command work could accidentally widen item ownership mutation beyond accepted pickup behavior.
- Mitigation: restate the exact accepted pickup mutation fields and preserve blocked-command state invariants.

### Risk: content and UX coupling

- Why it matters: prototype convenience work can leak scenario-specific behavior into engine or contracts.
- Mitigation: keep scenario, map, and inspection affordance data in the app layer only.

### Risk: overbuilding dialogue too early

- Why it matters: a full dialogue system would bring progression, branching, relationships, and content authoring concerns too soon.
- Mitigation: recommend a controlled talk preview boundary first, without progression or effects.

### Risk: losing project state documentation

- Why it matters: accepted boundaries and forbidden scope become harder to enforce when checkpoint docs drift.
- Mitigation: keep `CURRENT_STATE.md`, task records, handoffs, and checkpoint docs aligned at each milestone gate.

### Risk: Codex branch and remote confusion

- Why it matters: stale local `main` state and incorrect remotes can block PR flow even when task work is correct.
- Mitigation: keep `origin` pointed at `DreddyCZE/narrative-engine`, verify branch visibility after push, and prefer branching directly from verified `origin/main` when local `main` is stale.
