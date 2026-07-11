# Content Runtime Boundary And Prototype Path

## Direction Verdict

`NEXT_DIRECTION_CONTENT_RUNTIME_FOUNDATION`

## M7 Closure Note

`M7_CLOSED_WITH_REPLAY_RUNTIME_DEFERRED`

## 1. Current Completed Foundation

The project already has a meaningful technical foundation in place before prototype gameplay work starts.

In plain terms, the following are already available:

- storage adapter contract
- file storage adapter
- memory storage adapter
- schema and serialization contracts
- game state save and load boundary
- save slot manifest boundary
- save/load service facade
- save/load diagnostics policy
- save/load public scenario fixture
- save/load UI readiness gate
- replay planning and replay contracts
- replay source descriptor conformance coverage
- replay plan validation hardening
- M7 replay contract closure checkpoint

This means the project already knows how to validate persistence-related data, save and restore runtime state through public boundaries, and protect replay work from premature runtime implementation.

## 2. What Is Still Missing For A Playable Prototype

A future playable prototype still needs major content and runtime pieces that do not exist yet:

- content package and runtime content model
- location model
- exits and connections model
- item model
- inventory model
- NPC model
- dialogue model
- command and action model
- player state model
- runtime command execution flow for game actions
- content validation
- minimal UI shell
- P0 micro content
- map, grid, or editor integration

These are the gaps between the completed M7 foundation and a future playable slice.

## 3. Required Architectural Separation

The next direction must keep the following boundaries intact:

- content data must remain separate from engine logic
- UX and UI must remain separate from content data
- runtime should consume validated content data through public contracts
- P0 sci-fi content must not be hardcoded into engine
- future themes must remain possible
- map or editor representation must not be required for the first text prototype
- save/load should remain behind its public facade
- replay runtime remains deferred

This separation is the main guardrail against turning a future prototype into tightly coupled one-off code.

## 4. First Playable Prototype Definition

The smallest future playable prototype should be defined as:

`P0 Micro Prototype`

That future prototype should eventually include:

- player starts in `Komora 7`
- Block D corridor
- Block C first NPC encounter
- inaccessible or locked reference to `Section 99-ALFA`
- one simple item
- one simple inventory interaction
- one simple dialogue interaction
- one state flag or story progress marker
- save/load through the existing public save/load facade
- minimal text UI or CLI or browser shell

This document makes two explicit constraints:

- this task does not implement that prototype yet
- this task only defines the path and boundaries toward it

## 5. Candidate Next Workstreams

### Option A. Content schema or content package contract

Pros:

- defines the data format before runtime implementation
- protects data, engine, and UX separation
- supports future themes
- is needed before P0 content can be authored safely

Risks:

- can become too large if it tries to model the whole game at once

Guardrails:

- only model the minimum needed for the P0 Micro Prototype
- no actual P0 content yet
- no UI or editor implementation

### Option B. Runtime command boundary

Pros:

- moves closer to actual gameplay
- defines how player actions change state

Risks:

- risky before the content model is clear
- could hardcode commands around the first sci-fi prototype

Guardrails:

- only start after a minimal content schema is accepted

### Option C. Minimal UI shell

Pros:

- visible progress quickly

Risks:

- UI could force engine or content assumptions too early
- UI could bypass public boundaries
- UI could distract from the missing content contract

Guardrails:

- defer until the content and runtime boundary exists

### Option D. Map or editor integration

Pros:

- aligns with longer-term top-down map and editor goals

Risks:

- too early
- likely to explode scope
- content and location contracts are not ready yet

Guardrails:

- defer this path for now

## 6. Recommended Next Scope

Recommended next task:

`TASK-080 - Minimal content package contract for P0 micro prototype`

Reason:

- content data must be defined before runtime commands and UI
- it keeps content separate from engine and UX
- it creates the foundation for locations, items, NPCs, and dialogue
- it moves toward a playable prototype without hardcoding story content into engine logic

This checkpoint therefore makes the following explicit decisions:

- Do not start UI implementation yet.
- Do not start map editor work yet.
- Do not start full P0 content authoring yet.
- Do not start replay runtime yet.
- Next task should define the minimal content package contract needed for the first prototype.

## 7. Suggested Minimal Content Package Areas

The next task should likely define, but not fully implement, contracts for:

- content package metadata
- locations
- exits
- items
- inventory references
- NPC references
- dialogue references
- initial player state
- simple progress flags
- command and action affordances
- validation diagnostics

These areas are enough to shape the first prototype boundary without forcing full gameplay implementation yet.

## 8. Prototype Path Summary

The safest path toward the first future playable prototype is:

1. define the minimal content package contract
2. define how runtime consumes validated content through public boundaries
3. define the minimal runtime command boundary for player actions
4. add the smallest UI shell only after the content and runtime contracts are explicit
5. author the smallest possible P0 micro content slice on top of those contracts

This sequence minimizes hardcoding risk and keeps the project theme-flexible.

## 9. Final Recommendation

From the current planning perspective:

- M7 is closed with replay runtime deferred
- the next direction is content and runtime foundation work
- the next safe task is a minimal content package contract rather than UI, replay runtime, or map tooling

That keeps the project moving toward a real future prototype without collapsing data, engine, and UX boundaries too early.
