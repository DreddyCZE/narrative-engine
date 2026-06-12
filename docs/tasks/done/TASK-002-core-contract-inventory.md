# TASK-002: Core Contract Inventory

## Milestone

M0 - Governance and Contracts

## Status

DONE

## Objective

Create the initial inventory of public contracts required before M1 implementation.

## Scope

- Identify Game Data Schema, Engine State API, Command API, Event API, View Model API, Save Schema,
  Plugin API, Theme API, and Localization API.
- Define owners, expected versioning, and open ADR needs.
- Add inventory under `docs/contracts`.

## Out of Scope

Implementing the contracts or runtime behavior.

## Acceptance Criteria

- `docs/contracts/CONTRACT_INVENTORY.md` defines the canonical contract list.
- `docs/contracts/CONTRACT_DEPENDENCY_ORDER.md` defines recommended draft order and M1 minimum.
- `docs/contracts/CONTRACT_VERSIONING_POLICY.md` defines versioning and migration rules.
- ADR need is assessed without changing accepted architecture principles.
- Required checks pass.

## Review Result

Done. Final review confirmed that required contracts and fields are present, dependency graph is
acyclic, versioning policy covers required version types, and no new ADR is required.
