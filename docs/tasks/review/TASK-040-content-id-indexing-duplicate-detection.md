# Task: TASK-040 - Content ID indexing and duplicate detection

**Milestone:** M4 Content Loader / Validation Implementation
**Status:** REVIEW
**Priority:** P0

## Goal

Implement pure ID indexing and duplicate detection over content package sections.

## Scope

- pure function accepting caller-provided content package object or `ContentLoaderInput`
- stable ID extraction from declared sections
- section-qualified ID index
- package-local ID index
- duplicate ID diagnostics
- invalid or missing item ID diagnostics
- deterministic ordering
- input immutability
- tests using the minimal neutral content fixture

## Dependencies

- TASK-039 DONE
- manifest and section validation
- Content Loader input/result types
- Content Reference Validation
- Content Validation Diagnostics

## Out of Scope

- no file IO
- no production loader orchestration
- no reference target validation
- no reference resolver
- no M2 primitive validation
- no runtime content graph builder
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime
