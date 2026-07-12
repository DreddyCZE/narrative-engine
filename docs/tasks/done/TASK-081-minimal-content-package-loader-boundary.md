# Task: TASK-081 - Minimal content package loader boundary

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** ACTIVE
**Priority:** P0

## Goal

Create a minimal content package loader boundary that validates a provided `ContentPackage` object and converts it into the existing content-loader result and validated graph shape without implementing runtime commands or gameplay behavior.

## Dependencies

- TASK-080 DONE
- content package contract and validation helpers
- existing content-loader result types
- validation diagnostic contract

## Scope

- pure content package loader helper
- deterministic validated content graph builder
- deterministic mapping from content package validation failures to content-loader diagnostics
- public engine-contracts exports for the loader surface
- targeted contract tests for valid, invalid, blocked schema mismatch, deferred dependency summary, and deterministic repeated loads
- metadata updates for TASK-080 DONE and TASK-081 REVIEW when complete

## Out of Scope

- file IO
- dependency package resolution
- runtime command execution
- playable prototype behavior
- P0 content authoring
- dialogue or inventory runtime
- UI or browser shell
- map or editor implementation
- replay runtime
- DB or external storage
- plugin runtime
- external network
