# Task: TASK-080 - Minimal content package contract for P0 micro prototype

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Define the minimal content package contract needed for the future P0 Micro Prototype so later runtime commands, UI, map or editor work, and actual story content can be built without hardcoding content into engine logic.

## Dependencies

- TASK-079 DONE
- content and runtime boundary checkpoint
- engine contract validation patterns
- storage, save/load, and replay boundary work already accepted

## Scope

- minimal content package contract types
- content package validation helpers
- supported action affordance constants and type guards
- public engine-contracts exports for the new content package surface
- targeted contract tests for valid packages, invalid references, invalid ids, JSON safety, and deterministic diagnostics
- metadata updates for TASK-079 DONE and TASK-080 REVIEW when complete

## Out of Scope

- runtime command execution
- playable prototype implementation
- P0 story content authoring
- UI implementation
- map or editor implementation
- dialogue runtime
- inventory runtime
- replay runtime
- DB or external storage
- plugin runtime
- external network
