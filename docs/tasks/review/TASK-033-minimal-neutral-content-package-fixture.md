# Task: TASK-033 - Minimal Neutral Content Package Fixture

**Milestone:** M3 Data Model / Content Runtime Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Create a minimal neutral content package fixture aligned with the M3 content contracts.

## Scope

- add a data-only minimal neutral content package fixture
- add fixture documentation
- add static tests for shape and basic reference expectations
- keep the fixture loader-free and runtime-free
- keep the fixture neutral and non-game-specific

## Dependencies

- TASK-032 DONE
- `docs/contracts/CONTENT_PACKAGE_CONTRACT.md`
- `docs/contracts/CONTENT_SCHEMA_VERSION_MANIFEST.md`
- `docs/contracts/CONTENT_VALIDATION_DIAGNOSTICS.md`
- `docs/contracts/CONTENT_REFERENCE_VALIDATION.md`

## Out of Scope

- no loader runtime
- no content graph resolver
- no schema validation engine
- no cross-reference resolver as a production feature
- no content runtime
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
- no Purgatorium-specific content
