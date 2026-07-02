# Task: TASK-051 - Minimal fixture runtime command integration test

**Milestone:** M5 Runtime Host Boundary / Command Execution Integration
**Status:** REVIEW
**Priority:** P0

## Goal

Add minimal fixture runtime command integration coverage over the full in-memory runtime path.

## Dependencies

- TASK-049 DONE
- TASK-050 ACTIVE
- Minimal neutral fixture
- Validated content graph boundary
- Runtime host execution pipeline

## Scope

- minimal fixture runtime command integration test
- full in-memory path from validated graph to runtime result
- committed, blocked, and deterministic repeated-run coverage
- input state immutability
- graph immutability
- no Save/Event Store/file IO/UI/plugin side effects in production

## Out of Scope

- no Save system
- no Event Store writes
- no persistence
- no file IO
- no production file loader
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
- no external network calls
- no replay system
- no long-running runtime host process
