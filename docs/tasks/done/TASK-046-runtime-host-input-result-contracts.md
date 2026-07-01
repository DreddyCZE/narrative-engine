# Task: TASK-046 - Runtime host input/result contracts

**Milestone:** M5 Runtime Host Boundary / Command Execution Integration
**Status:** DONE
**Priority:** P0

## Goal

Define TypeScript input/result contracts for the runtime host boundary.

## Dependencies

- TASK-045 DONE
- M5 planning document: `docs/planning/M5_RUNTIME_HOST_COMMAND_EXECUTION_INTEGRATION.md`
- Engine State Contract
- Command Contract
- Transaction Contract
- Domain Event Contract
- Content Loader Boundary
- Validated Content Graph value from M4

## Scope

- data-only runtime request/input/result types
- runtime status union
- command request shape
- runtime context shape
- result metadata shape
- summaries for command plan, transaction, and event values
- JSON-safe examples and tests
- export checks
- no runtime execution

## Out of Scope

- no command resolver implementation
- no condition evaluation flow
- no effect application flow
- no transaction commit flow
- no event materialization flow
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
- no production file loader
