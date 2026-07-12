# Task: TASK-082 - Runtime content read model boundary

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** ACTIVE
**Priority:** P0

## Goal

Add a read-only runtime content read model boundary over the validated content graph so future runtime code can query validated content through public APIs without touching raw package data or implementing commands.

## Dependencies

- TASK-081 DONE
- content package contract and validation helpers
- content package loader boundary and validated graph output
- validation diagnostic contract

## Scope

- public read-only content read model helpers over `ValidatedContentGraph`
- input inspection and assertion helpers for read model creation
- deterministic lookup APIs for package metadata, locations, exits, items, NPCs, dialogues, initial player state, action affordances, and progress flags
- public engine-contracts exports for the read model surface
- targeted contract tests for valid reads, missing lookups, invalid input diagnostics, determinism, and non-command scope
- metadata updates for TASK-081 DONE and TASK-082 REVIEW when complete

## Out of Scope

- runtime command execution
- movement or gameplay state mutation
- inventory mutation
- dialogue progression
- event emission
- save/load UI
- P0 story content authoring
- UI or browser shell
- map or editor implementation
- replay runtime
- DB or external storage
- plugin runtime
- external network
