# Task: TASK-048 - Runtime condition/effect binding adapter

**Milestone:** M5 Runtime Host Boundary / Command Execution Integration
**Status:** REVIEW
**Priority:** P0

## Goal

Implement a pure runtime condition/effect binding adapter.

## Dependencies

- TASK-047 DONE
- Runtime command request resolver
- Runtime host input/result contracts
- Validated Content Graph value from M4
- Content M2 Primitive Integration contract
- Condition Contract
- Effect Contract

## Scope

- pure function accepting `RuntimeHostInput` and `RuntimeResolvedCommand`
- resolve condition definitions referenced by a resolved runtime command
- resolve effect definitions referenced by a resolved runtime command
- normalize condition/effect bindings into a value-only adapter result
- deterministic diagnostics for missing, invalid, unknown, and ambiguous condition/effect refs
- deterministic diagnostics for invalid condition/effect graph section shapes
- stable adapter paths
- input, graph, and resolved command immutability
- tests using a minimal fixture validated graph

## Out of Scope

- no condition evaluation
- no effect application
- no command execution
- no transaction commit
- no domain event materialization
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
- no production file loader
- no file IO
