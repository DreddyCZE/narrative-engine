# Task: TASK-035 - Content Package Integration with M2 Primitives

**Milestone:** M3 Data Model / Content Runtime Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Verify and document the data-only integration boundary between content package definitions and the
existing M2 primitives.

## Scope

- define the content-to-M2 primitive integration contract
- add minimal test-only integration using the existing neutral fixture and public M2 APIs
- cover content condition, effect, command/action, transaction, and domain event mapping shape
- verify deterministic diagnostics and results
- keep all integration loader-free, runtime-host-free, and test-only outside documented contracts

## Dependencies

- TASK-034 DONE
- `docs/contracts/CONTENT_PACKAGE_CONTRACT.md`
- `docs/contracts/CONTENT_SCHEMA_VERSION_MANIFEST.md`
- `docs/contracts/CONTENT_VALIDATION_DIAGNOSTICS.md`
- `docs/contracts/CONTENT_REFERENCE_VALIDATION.md`
- `docs/contracts/CONTENT_LOADER_BOUNDARY.md`
- `tests/fixtures/content/minimal-neutral-content-package/content-package.json`
- `docs/contracts/CONDITION_CONTRACT.md`
- `docs/contracts/EFFECT_CONTRACT.md`
- `docs/contracts/COMMAND_CONTRACT.md`
- `docs/contracts/TRANSACTION_CONTRACT.md`
- `docs/contracts/DOMAIN_EVENT_CONTRACT.md`

## Out of Scope

- no production loader implementation
- no runtime content graph resolver
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
- no production file IO loader
- no runtime host
