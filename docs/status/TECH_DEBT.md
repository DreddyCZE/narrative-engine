# Technical Debt

## Accepted Debt

- Package implementations are skeleton-only after M0.
- Validation covers repository governance, independence checks, contract document presence, and
  current architecture boundaries. It does not validate full game data schemas.
- Contract fixtures are required by policy but only boundary fixtures exist so far; individual
  contract fixtures must be created with their contract design tasks.
- Boundary checks are intentionally lightweight and do not prove domain behavior.
- No contract schemas have been drafted yet; M1 starts with Entity Identity.

## Debt Rules

Technical debt must be linked to a task, ADR, or explicit milestone deferral.
