# Runtime Prototype

This browser prototype renders multiple prototype scenarios through the public engine contracts and now includes a tightly scoped movement slice, a dedicated controlled item pickup slice, locked-exit diagnostics, a read-only inspection panel, a UI-only future action readiness model, and an app-layer item presence projection.

## What It Shows

- a data-driven scenario selector
- scenario metadata and package identity
- a UI-only map/layout panel per scenario
- current location details
- explicit exit controls derived from the current location read model
- explicit visible-item controls derived from app-layer item presence projection
- exit availability states for available, locked, and condition-gated movement
- a read-only inspection panel for the current location, visible exits, visible items, inventory-owned items, and visible NPCs
- a future action readiness section that explains which actions may later apply to the inspected entity
- current inventory
- transcript preview and latest action output
- diagnostics
- a command palette with executable `Look`, `Inventory`, and conditional `Go`
- visible disabled `Talk`, generic `Take`, `Use`, `Save`, and `Load`

## Runtime Boundaries

- uses public `@narrative-engine/engine-contracts` exports only
- keeps prototype scenario data and map layouts in `apps/runtime`
- loads each scenario through the public content package loader, read model, and initial player state path
- routes `Look` and `Inventory` through `executeRuntimeReadonlyInteraction(...)`
- routes `Go` through `createRuntimeCommandPlan(...)` plus `executeRuntimeMovementCommand(...)`
- routes explicit item pickup through `createRuntimeCommandPlan(...)` plus `executeRuntimeItemPickupCommand(...)`
- keeps inspection fully local to app-layer state and content/read-model lookups only
- derives item presence from content item location plus runtime inventory state without mutating either source
- derives future action readiness from inspected app-layer state only and never executes planning, readonly interaction, movement, or pickup
- binds movement to explicit exit buttons only
- binds pickup to explicit visible portable item buttons only
- reuses existing item `portable`, exit `locked`, and exit `conditionFlag` metadata without widening the content schema
- never accepts free-form text or arbitrary command input
- stays fully in-memory
- does not persist, save, load, replay, or call generic mutable execution APIs

## Prototype Scenarios

- `Smoke Scenario`: public smoke package adapted at the app layer for prototype movement and pickup, with `Smoke Test Airlock`, `Smoke Test Corridor`, and `Smoke Test Keycard`
- `Observation Deck Demo`: prototype-only app-layer demo package with `Prototype Observation Deck`, a visible portable `Prototype Deck Pass`, a visible non-portable `Prototype Bulkhead Plaque`, an inventory-owned `Prototype Survey Tablet`, an unreachable non-portable `Prototype Locker Seal`, `Prototype Sensor Gallery`, and `Prototype Analyst`
- the observation deck demo also includes a locked service locker exit and a condition-gated maintenance hatch for movement-readiness diagnostics

These scenarios are prototype data only. They are not final game content and do not add P0 story content to engine contracts.

## Command Palette, Movement, Pickup, And Inspection

- executable now: `Look`, `Inventory`
- conditionally executable: `Go`
- still disabled in the generic command palette: `Talk`, `Take`, `Use`, `Save`, `Load`
- `Go` becomes enabled only when the current location exposes a concrete exit
- exit controls show whether each exit is available, locked, or waiting on a progress flag
- movement runs only by clicking a visible exit move button that maps to a specific target location
- visible portable items show an explicit `Take` button that maps to a specific item id
- picking up an item mutates only runtime inventory state plus revision metadata and never mutates content item location
- projection hides a picked-up item from visible room items and shows it in inventory by combining unchanged content item location with updated runtime inventory state
- clicking a locked or condition-gated exit keeps player state and map highlight unchanged and reports the movement diagnostic
- blocked item pickup keeps player state unchanged and reports clearer pickup diagnostics for already-in-inventory, not-visible-here, and visible-but-not-portable cases
- inspection is separate from movement and pickup and never executes runtime commands
- future action readiness is visibly read-only metadata only and does not render executable generic controls for Talk, Take, or Use
- clicking `Go` without choosing an exit does not execute movement and instead explains how to continue safely

## Scenario Switching

- selecting a scenario rebuilds content, map, location, inventory, transcript preview, diagnostics, and inspection state from the selected package
- movement and explicit pickup work independently inside each selected scenario
- after moving to a no-exit location, `Go` becomes disabled again
- scenario switching resets output back to the newly selected scenario preview and clears inspection selection

## Local Run

1. `corepack pnpm --filter @narrative-engine/runtime-prototype build`
2. Open `apps/runtime/index.html` in a browser.

The HTML file loads the compiled app from `apps/runtime/dist/`, the compiled public engine-contracts bundle from the repo root `dist/`, and the compiled core package from `packages/core/dist/`.
