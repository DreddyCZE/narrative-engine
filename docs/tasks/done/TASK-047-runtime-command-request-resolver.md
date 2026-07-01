# Task: TASK-047 - Runtime command request resolver

**Milestone:** M5 Runtime Host Boundary / Command Execution Integration
**Status:** DONE
**Priority:** P0

## Goal

Implement a pure runtime command request resolver.

## Dependencies

- TASK-046 DONE
- Runtime host input/result contracts
- Validated Content Graph value from M4
- Content M2 Primitive Integration contract
- Command Contract

## Scope

- pure function accepting `RuntimeHostInput`
- resolve command/action definition from `validatedContentGraph`
- validate command request shape minimally
- deterministic diagnostics for missing, invalid, ambiguous, and unknown command requests
- stable resolve paths
- return value-only resolved command summary
- input and graph immutability
- tests using minimal fixture validated graph

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
