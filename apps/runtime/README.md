# Read-only Runtime Prototype

This browser prototype renders multiple read-only prototype scenarios through the public engine contracts.

## What It Shows

- a data-driven scenario selector
- scenario metadata and package identity
- a UI-only read-only map/layout panel per scenario
- current location details
- exits, visible items, and NPCs
- current inventory
- transcript preview and latest read-only interaction output
- diagnostics
- a command palette with executable read-only commands plus visible disabled future gameplay commands

## Read-only Boundary

- uses public `@narrative-engine/engine-contracts` exports only
- keeps prototype scenario data and map layouts in `apps/runtime`
- loads each scenario through the public content package loader, read model, and initial player state path
- routes `Look` and `Inventory` through `executeRuntimeReadonlyInteraction(...)`
- shows `Go`, `Talk`, `Take`, `Use`, `Save`, and `Load` as disabled local UI affordances with reasons
- never creates runtime requests for disabled commands
- stays fully in-memory
- does not persist, mutate gameplay, save, load, replay, or call lower-level executors directly

## Prototype Scenarios

- `Smoke Scenario`: public readonly smoke package with `Smoke Test Airlock`, `Smoke Test Corridor`, and `Smoke Test Keycard`
- `Observation Deck Demo`: prototype-only app-layer demo package with `Prototype Observation Deck`, `Prototype Sensor Gallery`, and `Prototype Survey Tablet`

These scenarios are prototype data only. They are not final game content and do not add P0 story content to engine contracts.

## Command Palette

- executable now: `Look`, `Inventory`
- visible but disabled: `Go`, `Talk`, `Take`, `Use`, `Save`, `Load`
- selecting a disabled command updates local prototype output/status only and explains why the command is unavailable

## Scenario Switching

- selecting a scenario rebuilds content, map, location, inventory, transcript preview, and diagnostics from the selected package
- the latest action output resets back to transcript preview for the newly selected scenario
- `Look` and `Inventory` remain read-only in every scenario
- disabled future commands remain local UI-only in every scenario

## Local Run

1. `corepack pnpm --filter @narrative-engine/runtime-prototype build`
2. Open `apps/runtime/index.html` in a browser.

The HTML file loads the compiled app from `apps/runtime/dist/`, the compiled public engine-contracts bundle from the repo root `dist/`, and the compiled core package from `packages/core/dist/`.
