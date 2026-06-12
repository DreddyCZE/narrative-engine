# ADR-0001: Greenfield Independence and Layer Boundaries

## Status

accepted

## Context

The project starts as a universal narrative engine, not as a continuation or extraction of an
existing game. Reusing concrete content, UI, assets, code, setting terminology, maps, characters,
or mechanics would contaminate the engine core and make future game packages harder to separate.

## Decision

The repository is a greenfield project. Engine, Game Data, UX, and Editor are separate layers.
Public communication between layers must happen through versioned contracts. Concrete game content
is only allowed in game packages and must be original or explicitly licensed for this repository.

## Consequences

- Existing game projects may inform high-level architectural lessons only.
- No existing game source code, CSS, assets, story content, UI, maps, quests, or character names may
  be copied.
- Framework choices for runtime and editor require a future ADR.
- Contract changes require ADR review and migration impact assessment.

## Migration Impact

None for M0. Future migrations must preserve published IDs and versioned contracts.

## Alternatives Considered

- Forking an existing game project: rejected because it would mix game-specific assumptions into
  the universal engine.
- Building UI first: rejected because it would force presentation choices before contracts exist.

