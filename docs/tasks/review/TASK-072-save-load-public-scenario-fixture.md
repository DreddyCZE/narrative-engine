# Task: TASK-072 - Save/load public scenario fixture

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add a small public save/load scenario fixture that demonstrates the full engine-level save/load flow for future UI or editor usage without implementing UI.

## Dependencies

- TASK-071 DONE
- game state save/load boundary
- save slot manifest boundary
- save/load service facade
- save/load diagnostics and recovery policy
- memory storage adapter
- file storage adapter

## Scope

- test-only public scenario fixture using existing engine-kernel public exports
- deterministic happy-path save/list/load scenario
- deterministic empty-list, missing-save, and manifest-mismatch recovery scenarios
- targeted scenario test coverage for memory and file storage adapters
- behavioral file-adapter boundary assertions only

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
