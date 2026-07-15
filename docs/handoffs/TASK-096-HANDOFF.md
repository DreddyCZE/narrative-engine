# TASK-096 Handoff

- Branch: `codex/task-096-readonly-browser-vertical-slice-prototype`
- Base commit: `b97ce2097480e1a0e4474843395a17f2c7b9bbcc`
- Implementation commit hash: `385bd14c14471f021c4d5d9d1b1fc285bffe8e47`

## Changed Files

- `apps/runtime/README.md`
- `apps/runtime/index.html`
- `apps/runtime/package.json`
- `apps/runtime/src/main.ts`
- `apps/runtime/src/readonly-prototype.css`
- `apps/runtime/src/readonly-prototype.test.ts`
- `apps/runtime/src/readonly-prototype.ts`
- `apps/runtime/tsconfig.json`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-095-ui-neutral-readonly-interaction-boundary.md`
- `docs/tasks/review/TASK-096-readonly-browser-vertical-slice-prototype.md`
- `eslint.config.js`
- `pnpm-lock.yaml`
- `tsconfig.eslint.json`
- `tsconfig.json`

## New App / Prototype Files

- `apps/runtime/README.md`
- `apps/runtime/index.html`
- `apps/runtime/package.json`
- `apps/runtime/src/main.ts`
- `apps/runtime/src/readonly-prototype.css`
- `apps/runtime/src/readonly-prototype.ts`
- `apps/runtime/tsconfig.json`

## New Test Files

- `apps/runtime/src/readonly-prototype.test.ts`

## Updated Docs

- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-095-ui-neutral-readonly-interaction-boundary.md`
- `docs/tasks/review/TASK-096-readonly-browser-vertical-slice-prototype.md`
- `docs/handoffs/TASK-096-HANDOFF.md`

## Validation Results

- `corepack pnpm --filter @narrative-engine/runtime-prototype test` - passed, 1 test file / 6 tests.
- `corepack pnpm --filter @narrative-engine/runtime-prototype build` - passed.
- `corepack pnpm test -- tests/runtime-readonly-interaction-boundary.test.ts` - passed, 1 test file / 8 tests.
- `corepack pnpm test -- tests/runtime-readonly-input-request-contract.test.ts` - passed, 1 test file / 7 tests.
- `corepack pnpm test -- tests/runtime-readonly-presentation-snapshot-scenario.test.ts` - passed, 1 test file / 6 tests.
- `corepack pnpm test -- tests/runtime-readonly-presentation-model.test.ts` - passed, 1 test file / 9 tests.
- `corepack pnpm test -- tests/runtime-readonly-transcript-scenario.test.ts` - passed, 1 test file / 7 tests.
- `corepack pnpm test -- tests/runtime-readonly-request-execution-facade.test.ts` - passed, 1 test file / 8 tests.
- `corepack pnpm test -- tests/runtime-readonly-smoke-scenario.test.ts` - passed, 1 test file / 7 tests.
- `corepack pnpm test -- tests/runtime-readonly-command-execution-facade.test.ts` - passed, 1 test file / 8 tests.
- `corepack pnpm test -- tests/runtime-inventory-command-executor-boundary.test.ts` - passed, 1 test file / 8 tests.
- `corepack pnpm test -- tests/runtime-look-command-executor-boundary.test.ts` - passed, 1 test file / 7 tests.
- `corepack pnpm test -- tests/runtime-command-planning-boundary.test.ts` - passed, 1 test file / 7 tests.
- `corepack pnpm test -- tests/runtime-command-request-boundary.test.ts` - passed, 1 test file / 6 tests.
- `corepack pnpm test -- tests/runtime-player-state-contract.test.ts` - passed, 1 test file / 5 tests.
- `corepack pnpm test -- tests/content-read-model-boundary.test.ts` - passed, 1 test file / 5 tests.
- `corepack pnpm test -- tests/content-package-loader-boundary.test.ts` - passed, 1 test file / 6 tests.
- `corepack pnpm test -- tests/content-package-contracts.test.ts` - passed, 1 test file / 6 tests.
- `corepack pnpm test` - passed, 73 test files / 694 tests.
- `corepack pnpm lint` - passed.
- `corepack pnpm typecheck` - passed.
- `corepack pnpm build` - passed.
- `corepack pnpm validate` - passed.
- `git diff --check` - passed with no errors; Git emitted LF normalization warnings only.

## Known Warnings

- Local Node version is `v24.16.0` while the repository engine expects Node 22. This remained non-blocking because all required validations passed.
- Git reports LF normalization warnings for a few edited files; this did not affect validation or behavior.

## Exact Local Run Command

- `corepack pnpm --filter @narrative-engine/runtime-prototype build`
- Then open `apps/runtime/index.html` in a browser.

## Prototype Behavior Summary

- The prototype builds the initial smoke-scenario presentation through public engine-contracts APIs only.
- It keeps all runtime state in memory and preserves identical initial/final player state snapshots for both exposed actions.
- It does not introduce movement, item pickup, dialogue progression, save/load behavior, replay, DB storage, external storage, or P0 story content.

## UI Rendering Summary

- The browser shell renders a scenario/title area, current location panel, exits/items/NPCs panel, inventory panel, transcript/output panel, diagnostics panel, and safe action buttons.
- Initial rendering uses `runReadonlyRuntimePresentationSnapshotScenario()` and shows the smoke scenario location `Smoke Test Airlock` plus the inventory item `Smoke Test Keycard`.
- Diagnostics render as a dedicated panel and remain empty in the clean baseline path.

## Interaction Flow Summary

- Clicking `Look` creates the neutral input `{ commandId: "look" }` and sends it through `executeRuntimeReadonlyInteraction(...)`.
- Clicking `Inventory` creates the neutral input `{ commandId: "inventory" }` and sends it through the same TASK-095 boundary.
- The prototype renders the returned read-only location or inventory output and never constructs `RuntimeCommandRequest` directly in the UI layer.

## Boundary Confirmations

- UI uses the TASK-095 read-only interaction boundary.
- Only `look` and `inventory` are exposed.
- No direct plan creation was added.
- No direct lower-level executor calls were added.
- No generic mutable execution APIs were introduced.

## No-mutation / No-next-state Evidence

- `apps/runtime/src/readonly-prototype.test.ts` asserts `playerStateBefore` and `playerStateAfter` are canonically identical for `look` and `inventory`.
- The same test asserts the prototype interaction payload omits `nextState`, `statePatch`, `events`, `runtimeDomainEventValues`, `transaction`, `saveResult`, and `loadResult`.
- The controller keeps a stable in-memory runtime context and updates only browser-local presentation state.

## Scope Confirmations

- No storage, replay runtime, DB adapter, backend service, external API call, or P0 content package was added.
- `TASK-097` was not created.
