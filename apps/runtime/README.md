# Runtime Prototype

This browser prototype renders multiple prototype scenarios through the public engine contracts and now includes a tightly scoped movement slice, locked-exit diagnostics, and a read-only inspection panel.

## What It Shows

- a data-driven scenario selector
- scenario metadata and package identity
- a UI-only map/layout panel per scenario
- current location details
- explicit exit controls derived from the current location read model
- exit availability states for available, locked, and condition-gated movement
- a read-only inspection panel for the current location, visible exits, visible items, and visible NPCs
- current inventory
- transcript preview and latest action output
- diagnostics
- a command palette with executable `Look`, `Inventory`, and conditional `Go`
- visible disabled `Talk`, `Take`, `Use`, `Save`, and `Load`

## Runtime Boundaries

- uses public `@narrative-engine/engine-contracts` exports only
- keeps prototype scenario data and map layouts in `apps/runtime`
- loads each scenario through the public content package loader, read model, and initial player state path
- routes `Look` and `Inventory` through `executeRuntimeReadonlyInteraction(...)`
- routes `Go` through `createRuntimeCommandPlan(...)` plus `executeRuntimeMovementCommand(...)`
- keeps inspection fully local to app-layer state and content/read-model lookups only
- binds movement to explicit exit buttons only
- reuses existing exit `locked` and `conditionFlag` metadata without widening the content schema
- never accepts free-form text or arbitrary command input
- stays fully in-memory
- does not persist, save, load, replay, or call generic mutable execution APIs

## Prototype Scenarios

- `Smoke Scenario`: public smoke package adapted at the app layer for prototype movement, with `Smoke Test Airlock`, `Smoke Test Corridor`, and `Smoke Test Keycard`
- `Observation Deck Demo`: prototype-only app-layer demo package with `Prototype Observation Deck`, `Prototype Sensor Gallery`, `Prototype Survey Tablet`, and `Prototype Analyst`
- the observation deck demo also includes a locked service locker exit and a condition-gated maintenance hatch for movement-readiness diagnostics

These scenarios are prototype data only. They are not final game content and do not add P0 story content to engine contracts.

## Command Palette, Movement, And Inspection

- executable now: `Look`, `Inventory`
- conditionally executable: `Go`
- still disabled: `Talk`, `Take`, `Use`, `Save`, `Load`
- `Go` becomes enabled only when the current location exposes a concrete exit
- exit controls show whether each exit is available, locked, or waiting on a progress flag
- movement runs only by clicking a visible exit move button that maps to a specific target location
- clicking a locked or condition-gated exit keeps player state and map highlight unchanged and reports the movement diagnostic
- inspection is separate from movement and never executes runtime commands
- inspection can show details for the current location, a visible exit, a visible item, or a visible NPC
- clicking `Go` without choosing an exit does not execute movement and instead explains how to continue safely

## Scenario Switching

- selecting a scenario rebuilds content, map, location, inventory, transcript preview, diagnostics, and inspection state from the selected package
- movement works independently inside each selected scenario
- after moving to a no-exit location, `Go` becomes disabled again
- scenario switching resets output back to the newly selected scenario preview and clears inspection selection

## Local Run

1. `corepack pnpm --filter @narrative-engine/runtime-prototype build`
2. Open `apps/runtime/index.html` in a browser.

The HTML file loads the compiled app from `apps/runtime/dist/`, the compiled public engine-contracts bundle from the repo root `dist/`, and the compiled core package from `packages/core/dist/`.
