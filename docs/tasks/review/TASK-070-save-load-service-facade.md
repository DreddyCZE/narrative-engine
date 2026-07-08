# Task: TASK-070 - Save/load service facade

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add a small public save/load service facade that composes the existing game state save/load and save slot manifest boundaries.

## Dependencies

- TASK-069 DONE
- game state save/load boundary
- save slot manifest boundary
- memory storage adapter
- file storage adapter

## Scope

- public engine-level save/load service facade
- save a game through `saveGameState` and `recordSaveSlot`
- load a game through `loadGameState`
- list saves through `listSaveSlots` or `loadSaveSlotManifest`
- targeted tests for memory/file adapters and structured diagnostics

## Out of Scope

- UI save/load menu
- editor integration
- autosave
- save deletion
- save rename
- save import/export
- gameplay/P0 content
- map editor integration
- replay runtime execution
- event stream replay
- state rebuild from events
- DB adapter
- external/cloud/browser storage
- plugin runtime
- external network
