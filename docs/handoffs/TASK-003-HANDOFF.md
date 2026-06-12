# Handoff: TASK-003 CI and Architecture Boundary Skeleton

## Task

TASK-003 - CI and architecture boundary skeleton

## Summary

Added a deterministic architecture boundary checker, fixture-based tests, CI wiring, and boundary
documentation. The work stays inside M0 and does not implement engine runtime systems, UI, editor,
game data schema, plugin runtime, or themes.

## Implemented Boundary Rules

- `engine-no-app-game-theme`: `packages/engine-*` cannot import `apps/**`, `games/**`, or
  `themes/**`.
- `runtime-no-engine-deep-import`: `apps/runtime/**` cannot import engine packages through relative
  or internal source paths.
- `editor-not-runtime-dependency`: `packages/**` and `apps/runtime/**` cannot import
  `apps/editor/**`.
- `game-data-no-executable`: canonical `games/**` data cannot be executable JS/TS, with narrow
  exceptions for test/tool/script/config paths.
- `theme-no-runtime-internals`: future `themes/**` cannot import game implementation or engine
  state/rules internals.
- `plugin-no-engine-internals`: `plugins/**` cannot import engine source internals.
- `workspace-public-entry`: each existing workspace package under `packages/*` must have a package
  name and `src/index.ts`.
- `no-cross-package-src-import`: cross-package source imports must use public package exports, not
  another package's `src/**`.
- `package-dependency-boundary`: relevant `package.json` dependency sections cannot point engine
  packages at apps/games/themes/editor code or runtime/package code at the editor app.

## Files Changed

- `.github/workflows/ci.yml`
- `docs/contracts/ARCHITECTURE_BOUNDARIES.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/review/TASK-003-ci-and-architecture-boundary-skeleton.md`
- `package.json`
- `packages/*/package.json`
- `tests/boundaries.test.ts`
- `tests/fixtures/boundaries/**`
- `tools/check-boundaries.mjs`
- `tools/validate.mjs`

## Test Fixtures

- `tests/fixtures/boundaries/valid-public-package-import`
- `tests/fixtures/boundaries/invalid-engine-import-game`
- `tests/fixtures/boundaries/invalid-engine-package-game-dependency`
- `tests/fixtures/boundaries/invalid-engine-package-editor-dependency`
- `tests/fixtures/boundaries/invalid-runtime-engine-deep-import`
- `tests/fixtures/boundaries/invalid-engine-editor-dependency`
- `tests/fixtures/boundaries/invalid-cross-package-deep-import`
- `tests/fixtures/boundaries/invalid-game-executable-data`
- `tests/fixtures/boundaries/valid-game-data-json`
- `tests/fixtures/boundaries/valid-commented-import-text`

## Checks

- `corepack pnpm lint` - passed.
- `corepack pnpm typecheck` - passed.
- `corepack pnpm test` - passed.
- `corepack pnpm build` - passed.
- `corepack pnpm check:boundaries` - passed.
- `corepack pnpm validate` - passed.

Local note: Node `v24.16.0` emitted the expected engine warning because the project is pinned to
Node 22. The pin was not changed.

## Final Review

- Import syntax coverage was reviewed for static `import`, side-effect `import`, `export from`,
  dynamic string-literal `import()`, and `require()`.
- Comment text that looks like an import is tested and ignored.
- Package dependency sections are checked for `dependencies`, `devDependencies`,
  `peerDependencies`, and `optionalDependencies`.
- Error output includes relative file path, rule ID, and the offending import, dependency, or
  extension.
- No new ADR is required.

## Known Limits

- Import parsing is static and covers common string-literal `import`, `export from`, `import()`,
  and `require()` forms only.
- TypeScript path aliases are not resolved because M0 defines none.
- The checker does not prove domain behavior such as View Model leakage, Save contents, Theme state
  mutation, or plugin command pipeline use.
- Game data executable detection is conservative and may need adjustment when a game data contract
  is drafted.

## False Positive Risks

- Future legitimate config files under `games/**` may need narrow allowlist additions.
- Future theme or plugin package layouts may need package-specific public entry rules.

## False Negative Risks

- Non-literal dynamic imports are not detected.
- Runtime behavior can still violate domain boundaries until concrete contracts and implementations
  exist.
- External package aliases could hide a forbidden target if future path aliases are added without
  updating the checker.

## CI Impact

CI now runs `corepack enable`, `pnpm check:boundaries`, and `pnpm validate`. `pnpm validate` also
runs the boundary checker.

## Security Impact

The checks reduce accidental coupling to concrete games, editor code, internal engine state/rules,
and executable game data. They do not replace future security review for plugin or script extension
contracts.

## Recommended Next Task

Planning-only M0 completion gate / Gate D check.
