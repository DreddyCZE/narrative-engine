# Read-only Runtime Prototype

This browser prototype renders the current read-only smoke scenario through the public engine contracts.

## What It Shows

- scenario title and package metadata
- current location details
- exits, visible items, and NPCs
- current inventory
- transcript preview and latest read-only interaction output
- diagnostics
- a command palette with executable read-only commands plus visible disabled future gameplay commands

## Read-only Boundary

- uses public `@narrative-engine/engine-contracts` exports only
- builds initial presentation from `runReadonlyRuntimePresentationSnapshotScenario()`
- routes `Look` and `Inventory` through `executeRuntimeReadonlyInteraction(...)`
- shows `Go`, `Talk`, `Take`, `Use`, `Save`, and `Load` as disabled local UI affordances with reasons
- never creates runtime requests for disabled commands
- stays fully in-memory
- does not persist, mutate gameplay, save, load, replay, or call lower-level executors directly

## Command Palette

- executable now: `Look`, `Inventory`
- visible but disabled: `Go`, `Talk`, `Take`, `Use`, `Save`, `Load`
- selecting a disabled command updates local prototype output/status only and explains why the command is unavailable

## Local Run

1. `corepack pnpm --filter @narrative-engine/runtime-prototype build`
2. Open `apps/runtime/index.html` in a browser.

The HTML file loads the compiled app from `apps/runtime/dist/`, the compiled public engine-contracts bundle from the repo root `dist/`, and the compiled core package from `packages/core/dist/`.
