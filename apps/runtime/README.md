# Runtime Prototype

This browser prototype renders multiple prototype scenarios through the public engine contracts and now includes a tightly scoped movement slice.

## What It Shows

- a data-driven scenario selector
- scenario metadata and package identity
- a UI-only map/layout panel per scenario
- current location details
- explicit exit buttons derived from the current location read model
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
- binds movement to explicit exit buttons only
- never accepts free-form text or arbitrary command input
- stays fully in-memory
- does not persist, save, load, replay, or call generic mutable execution APIs

## Prototype Scenarios

- `Smoke Scenario`: public smoke package adapted at the app layer for prototype movement, with `Smoke Test Airlock`, `Smoke Test Corridor`, and `Smoke Test Keycard`
- `Observation Deck Demo`: prototype-only app-layer demo package with `Prototype Observation Deck`, `Prototype Sensor Gallery`, and `Prototype Survey Tablet`

These scenarios are prototype data only. They are not final game content and do not add P0 story content to engine contracts.

## Command Palette And Movement

- executable now: `Look`, `Inventory`
- conditionally executable: `Go`
- still disabled: `Talk`, `Take`, `Use`, `Save`, `Load`
- `Go` becomes enabled only when the current location exposes a concrete exit
- movement runs only by clicking a visible exit button that maps to a specific target location
- clicking `Go` without choosing an exit does not execute movement and instead explains how to continue safely

## Scenario Switching

- selecting a scenario rebuilds content, map, location, inventory, transcript preview, and diagnostics from the selected package
- movement works independently inside each selected scenario
- after moving to a no-exit location, `Go` becomes disabled again
- scenario switching still resets the output back to the newly selected scenario preview

## Local Run

1. `corepack pnpm --filter @narrative-engine/runtime-prototype build`
2. Open `apps/runtime/index.html` in a browser.

The HTML file loads the compiled app from `apps/runtime/dist/`, the compiled public engine-contracts bundle from the repo root `dist/`, and the compiled core package from `packages/core/dist/`.