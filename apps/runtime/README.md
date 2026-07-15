# Read-only Runtime Prototype

This browser prototype renders the current read-only smoke scenario through the public engine contracts.

## What It Shows

- scenario title and package metadata
- current location details
- exits, visible items, and NPCs
- current inventory
- transcript preview and latest read-only interaction output
- diagnostics
- safe `Look` and `Inventory` actions only

## Read-only Boundary

- uses public `@narrative-engine/engine-contracts` exports only
- builds initial presentation from `runReadonlyRuntimePresentationSnapshotScenario()`
- routes button input through `executeRuntimeReadonlyInteraction(...)`
- supports only `{ commandId: "look" }` and `{ commandId: "inventory" }`
- stays fully in-memory
- does not persist, mutate gameplay, save, load, replay, or call lower-level executors directly

## Local Run

1. `corepack pnpm --filter @narrative-engine/runtime-prototype build`
2. Open `apps/runtime/index.html` in a browser.

The HTML file loads the compiled app from `apps/runtime/dist/`, the compiled public engine-contracts bundle from the repo root `dist/`, and the compiled core package from `packages/core/dist/`.
