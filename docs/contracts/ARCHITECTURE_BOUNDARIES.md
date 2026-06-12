# Architecture Boundaries

This document describes the boundary checks introduced by TASK-003. These checks are intentionally
small and executable. They protect the current repository skeleton and create a place to add future
rules as real contracts and packages appear.

## Purpose

Architecture boundaries keep Engine, Game Data, UX, Editor, Plugins, and Themes separated. They
support ADR-0001 and the Architecture Boundary Contract in `CONTRACT_INVENTORY.md`.

The current checks are import and file-placement checks. They do not prove domain correctness.

## Automatically Checked Rules

The command `pnpm check:boundaries` runs `tools/check-boundaries.mjs`.

Current rules:

- `engine-no-app-game-theme`: files under `packages/engine-*` must not import `apps/**`,
  `games/**`, or `themes/**`.
- `runtime-no-engine-deep-import`: files under `apps/runtime/**` must not import engine packages
  through relative paths into `packages/engine-*`; future runtime code must use public workspace
  package exports.
- `editor-not-runtime-dependency`: files under `packages/**` and `apps/runtime/**` must not import
  `apps/editor/**`.
- `game-data-no-executable`: canonical files under `games/**` must not be executable JavaScript or
  TypeScript. The current executable extensions are `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, and
  `.cjs`. The check allows executable files only under clearly non-data subdirectories named
  `tests`, `test`, `__tests__`, `tools`, or `scripts`, and filenames containing `.config.`.
- `theme-no-runtime-internals`: if `themes/**` exists, theme files must not import game
  implementation files or engine state/rules internals.
- `plugin-no-engine-internals`: plugin files must not import engine package internals.
- `workspace-public-entry`: each workspace package under `packages/*` must have a package name and
  `src/index.ts`.
- `no-cross-package-src-import`: source files must not import another workspace package through
  `src/**`; they must use the package public export.
- `package-dependency-boundary`: `dependencies`, `devDependencies`, `peerDependencies`, and
  `optionalDependencies` in relevant `package.json` files must not point engine packages at apps,
  games, themes, or editor code, and must not point runtime/package code at the editor app.

The production repository scan ignores generated directories and the intentional negative fixtures
under `tests/fixtures/boundaries/**`.

## CI Integration

CI runs:

```text
pnpm check:boundaries
pnpm validate
```

`pnpm validate` also runs the boundary check after repository governance validation.
This duplication is intentional in M0: `pnpm check:boundaries` gives a focused CI step, while
`pnpm validate` keeps boundary enforcement inside the single validation gate used by agents.

## Test Fixtures

Boundary fixtures live under `tests/fixtures/boundaries/`. They are separate mini repository
shapes, not canonical project data.

The test suite proves:

- a valid public workspace package import passes,
- an engine import of a concrete game fails,
- runtime deep import of an engine source file fails,
- engine dependency on editor fails,
- engine package dependency on game data fails,
- engine package dependency on editor fails,
- cross-package deep import fails,
- comment text that looks like an import is ignored,
- non-executable JSON game data passes,
- executable canonical game data fails.

## Not Automatically Checked Yet

The TASK-003 checker does not validate:

- whether Command, Transaction, and Effect semantics are correct,
- whether View Model content leaks hidden Engine State,
- whether internal data leaks through an otherwise permitted public API,
- whether Theme changes can affect state at runtime,
- whether Plugin behavior uses the future command pipeline,
- whether Game Data schemas are complete,
- whether Save data excludes all UX layout state,
- whether all future domain logic respects every contract,
- whether code semantics violate architecture without a corresponding import or package dependency.

Those checks need concrete contracts and implementation surfaces before they can be made precise.

## Known Limits

- Import detection is static and covers common `import`, `export from`, dynamic `import()`, and
  `require()` string specifiers.
- Comment text is stripped before import matching for common line and block comments. This is a
  lightweight scanner, not a full TypeScript parser.
- It does not resolve TypeScript path aliases because none are defined in M0.
- It does not inspect non-literal dynamic imports.
- It does not evaluate generated files, bundled files, or package-manager output.
- It treats `games/**` as canonical data unless the file is in a documented non-data path or config
  filename.
- It is designed for current repository structure, not arbitrary monorepos.

## Adding a Rule

When adding a new boundary rule:

1. Document the rule here.
2. Add a narrowly scoped check in `tools/check-boundaries.mjs`.
3. Add at least one positive or negative fixture in `tests/fixtures/boundaries/`.
4. Add a Vitest assertion that proves the rule.
5. Ensure the rule reports file, rule ID, and problem.
6. Avoid broad repository-wide regex scans that create noisy false positives.

If a rule changes layer permissions or public contract behavior, create an ADR before implementing
the rule.

## Import Boundary vs Domain Boundary

An import boundary controls which files and packages can reference each other. It catches coupling
early and cheaply.

A domain boundary controls behavior, state mutation, command processing, save semantics, and
runtime authority. Domain boundaries need real contracts and implementation surfaces. TASK-003 does
not claim to guarantee those future behaviors.
