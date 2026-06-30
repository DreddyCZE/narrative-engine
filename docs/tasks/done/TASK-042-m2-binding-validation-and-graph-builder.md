# Task: TASK-042 - M2 binding validation and graph builder

**Milestone:** M4 Content Loader / Validation Implementation
**Status:** DONE
**Priority:** P0

## Goal

Implement pure M2 primitive binding validation and a value-only validated content graph builder.

## Scope

- pure function validating condition, effect, command/action, and event mapping/template binding
  shape
- pure value-only graph builder using manifest/section validation, ID index, reference validation,
  and M2 binding validation outputs
- deterministic diagnostics
- stable binding and graph paths
- input immutability
- tests using the minimal neutral content fixture

## Dependencies

- TASK-041 DONE
- reference validation
- content ID indexing
- manifest and section validation
- `docs/contracts/CONTENT_M2_PRIMITIVE_INTEGRATION.md`
- `docs/contracts/CONTENT_LOADER_BOUNDARY.md`
- content loader input/result types
- condition, effect, command, transaction, and domain event contracts

## Out of Scope

- no file IO
- no production file loader
- no runtime host
- no command execution
- no effect application
- no transaction commit
- no domain event materialization as runtime flow
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime