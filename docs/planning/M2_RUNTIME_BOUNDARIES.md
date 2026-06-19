# M2 Runtime Boundaries

## Rule

M2 runtime work must preserve this dependency direction:

```text
docs/schemas/contracts -> production packages -> test-support/tests
```

Production packages may be informed by docs and schemas during development, but they must not import
governance docs, tests, fixtures, or authoring data at runtime.

## Current Package Assessment

| Area | Current role | M2 recommendation |
| --- | --- | --- |
| `packages/engine-contracts` | Contract-facing package shell. | Place shared constants, contract-facing types, JSON-safe value helpers, canonical serialization, and identity/schema helpers here when they are package-neutral. |
| `packages/validation` | Validation package shell. | Own diagnostic envelope helpers, aggregate status, redaction, and validation result adapters. |
| `packages/engine-state` | State package shell. | Own Engine State snapshot validation, path resolution, candidate copy utilities, and state-specific diagnostics. |
| `packages/engine-rules` | Rules package shell. | Own condition evaluation and effect application primitives. Must not own commit or event publication. |
| `packages/engine-kernel` | Kernel package shell. | Own command planning boundary, in-memory transaction orchestration, and event materialization after lower-level packages exist. |
| `packages/test-support` | Test helper package. | Own fixtures, oracle adapters, and test-only builders. It may import production packages, never the reverse. |
| `schemas` | JSON Schema source. | Remain source-of-truth schema artifacts. Runtime use must go through an explicit validation boundary. |
| `tests` | Test suites and fixtures. | May import runtime and test-support. Must not become production dependency. |
| `docs` | Governance and planning. | Must not be imported by runtime packages. |

Do not create `packages/core` or `packages/runtime` in TASK-015. If future work needs a broader
package, that task must explain why the current package map is insufficient.

## Import Rules

- `packages/engine-contracts` must not import `engine-state`, `engine-rules`, `engine-kernel`,
  `test-support`, `tests`, or `docs`.
- `packages/validation` may import `engine-contracts`; it must not import `engine-kernel`,
  `test-support`, `tests`, or `docs`.
- `packages/engine-state` may import `engine-contracts` and `validation`; it must not import
  `engine-rules`, `engine-kernel`, `test-support`, `tests`, or `docs`.
- `packages/engine-rules` may import `engine-contracts`, `validation`, and `engine-state`; it must
  not import `engine-kernel`, `test-support`, `tests`, or `docs`.
- `packages/engine-kernel` may import lower-level production packages; it must not import
  `test-support`, `tests`, `docs`, UI, game data, or authoring fixtures.
- `packages/test-support` may import production packages and schemas for tests.

## Production Runtime

Production runtime may include:

- JSON-safe value validation.
- Canonical serialization helpers.
- Entity Identity and schema compatibility helpers.
- Engine State snapshot validation and path resolution.
- Condition evaluation over readonly state.
- Effect application over candidate state.
- In-memory command plan handling.
- In-memory transaction lifecycle.
- Domain Event materialization from committed transaction results.
- Validation Diagnostic envelopes and aggregates.

Production runtime must stay in memory unless a later persistence task explicitly changes that
boundary.

## Test-Support Only

The following must remain test-support until a future implementation task extracts a production
module:

- M1 oracle validators.
- Fixture loaders.
- Semantic-invalid fixture classifiers.
- Test-only command handlers.
- Simulated concurrent commit hooks.
- Test-only event materialization shortcuts.
- Fixture-specific canonicalization assumptions.

Test oracle behavior can be used as evidence for expected behavior, not as direct production code.

## Schemas

Schemas may be used by validation tooling and tests. Production packages may reference schema IDs,
contract versions, and schema versions through typed constants or validation adapters. Production
runtime must not dynamically import `docs/**` or treat schema files as mutable runtime registries
unless a later task explicitly creates that validation boundary.

## Engine/Data/UX Separation

- Engine packages operate on neutral contract data.
- Data packages or fixtures provide declarative records only.
- UX/UI packages render or collect input only; they do not mutate Engine State directly.
- Engine packages must not import UI, DOM, browser globals, editor fixtures, P0 story data, or
  localization UI.
- UI may call engine APIs in future tasks, but engine must not call UI.

## Runtime vs Authoring Fixtures

Runtime packages must not import:

- `tests/fixtures/**`;
- authoring examples;
- docs planning examples;
- visual editor fixtures;
- P0 content;
- generated screenshots or QA artifacts.

If a runtime test needs example data, the data must live under tests or test-support and be passed
into runtime as plain contract data.

## Plugin Boundary

No plugin runtime may be introduced in early M2. M2 packages may reserve explicit extension points
only when a task requires them, but they must not add:

- plugin manifests;
- plugin loaders;
- dynamic execution;
- permission grants;
- third-party package registration;
- extension discovery.

Plugin namespace and capability decisions remain deferred until plugin work is explicitly scoped.

## Boundary Checks

Keep existing lint, typecheck, test, build, and validate checks. Add package import boundary checks
only when production runtime imports are introduced and the rule can be tested against real package
edges.
