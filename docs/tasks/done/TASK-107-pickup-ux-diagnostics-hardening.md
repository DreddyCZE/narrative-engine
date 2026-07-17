# Task: TASK-107 - Pickup UX diagnostics hardening

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** DONE
**Priority:** P0

## Goal

Harden the controlled pickup UX and diagnostics so blocked pickup paths are explicit and stable before any new gameplay command is introduced.

## Dependencies

- TASK-106 accepted and merged into `origin/main`
- base commit `1c5981a53901d00466dd23aa679384fa87b5b1a7`
- runtime prototype in `apps/runtime`
- dedicated runtime item pickup executor boundary
- app-layer item presence projection

## Scope

- prototype-only visible non-portable observation deck fixture
- clearer blocked pickup output for visible non-portable, elsewhere, and already-in-inventory cases
- prototype tests covering disabled take affordances, blocked pickup preservation, and successful pickup regression
- engine pickup boundary test hardening for non-portable diagnostic details
- metadata updates for TASK-106 DONE and TASK-107 REVIEW when complete

## Out of Scope

- new gameplay executors
- `use` execution
- `talk` execution
- parser or arbitrary command input
- save/load UI integration
- replay runtime
- browser, DB, or external storage
- map editor
- plugin runtime
- P0 story content
