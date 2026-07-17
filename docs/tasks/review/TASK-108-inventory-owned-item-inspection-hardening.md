# Task: TASK-108 - Inventory-owned item inspection hardening

**Milestone:** M7 Production Storage Adapter / Replay Boundary
**Status:** REVIEW
**Priority:** P0

## Goal

Harden the inventory-owned item experience after controlled pickup so an owned item is clearly inspectable and clearly no longer a pickup target.

## Dependencies

- TASK-107 accepted and merged into `origin/main`
- base commit `069c872f556370fedb3fb39641c688295b3a842c`
- runtime prototype in `apps/runtime`
- dedicated runtime item pickup executor boundary
- app-layer item presence projection and inspection model

## Scope

- inventory panel hardening for inventory-owned item presentation
- inventory-owned item inspection copy for ownership and pickup-not-applicable state
- prototype test coverage for inventory-owned inspection before and after pickup
- metadata updates for TASK-107 DONE and TASK-108 REVIEW when complete

## Out of Scope

- engine contract changes
- new runtime executors
- `drop` execution
- `use` execution
- `talk` execution
- parser or arbitrary command input
- save/load UI integration
- replay runtime
- browser, DB, or external storage
- map editor
- plugin runtime
- P0 story content
