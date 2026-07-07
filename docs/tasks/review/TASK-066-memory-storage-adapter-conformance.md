# Task: TASK-066 - Memory storage adapter conformance

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Add a production in-memory storage adapter and register it as the second subject in the shared storage adapter conformance harness.

## Dependencies

- TASK-065 DONE
- storage adapter contracts
- storage adapter conformance harness
- file storage adapter boundary
- in-memory persistence boundaries

## Scope

- production memory storage adapter over the public storage adapter contract
- public export surface for the memory storage adapter
- shared conformance harness running against file and memory subjects
- adapter-neutral shared expectations
- memory-specific boundary checks for instance isolation and no host file side effects
- file-specific boundary checks preserved through subject-specific assertions

## Out of Scope

- DB adapter
- external storage adapter
- browser localStorage/sessionStorage adapter
- cloud or network storage
- replay runtime execution
- event stream replay
- state rebuild
- UI/editor save-load flow
- gameplay/P0 content
- plugin runtime
- external network
