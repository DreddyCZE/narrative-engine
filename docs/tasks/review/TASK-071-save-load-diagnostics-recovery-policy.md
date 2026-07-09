# Task: TASK-071 - Save/load diagnostics and recovery policy

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add a small public diagnostics and recovery policy layer for save/load operations so callers can classify save/load/list outcomes deterministically before UI or editor work begins.

## Dependencies

- TASK-070 DONE
- game state save/load boundary
- save slot manifest boundary
- save/load service facade
- memory storage adapter
- file storage adapter

## Scope

- public engine-level diagnostics and recovery policy for save/load operations
- deterministic classification for `saveGame`, `loadGame`, and `listSaves`
- deterministic classification helpers for lower-level save/load and manifest boundaries
- recovery action recommendations for success, invalid input, missing saves, manifest mismatch, duplicate slot records, and adapter errors
- targeted public-API tests for memory/file adapters and behavioral file boundary assertions only

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
