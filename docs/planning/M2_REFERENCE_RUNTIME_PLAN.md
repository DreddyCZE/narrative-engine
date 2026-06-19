# M2 Reference Runtime Plan

## Outcome

`READY_FOR_M2A`

M1 Contract Foundation is PASS after TASK-014 remediation. The first M2 implementation task can be
created for shared JSON-safe and canonical serialization utilities. No runtime implementation is
started by this plan.

## Goal

M2 creates a small reference runtime that proves the M1 contracts can execute together in memory:

```text
canonical JSON-safe value
-> Entity Identity validation
-> Engine State snapshot shape validation
-> Condition evaluation over readonly state
-> Effect application on a candidate copy
-> Transaction commit/no-op/rollback over in-memory state
-> Domain Event materialization from committed transactions
-> canonical diagnostics
```

The goal is not a complete engine. The goal is a narrow, contract-backed vertical slice that can be
reviewed, tested, and extended without collapsing Engine, Data, UX, Save, Event Store, and tooling
scope into one subsystem.

## Implementation Principles

- Start from shared deterministic value handling before state or pipeline work.
- Implement one package boundary at a time.
- Keep production runtime independent from docs, tests, fixtures, and authoring data.
- Treat schemas and M1 docs as normative inputs, not runtime dependencies to parse dynamically.
- Preserve Engine/Data/UX separation from the first task.
- Add runtime package boundary checks only when the runtime boundary exists.
- Keep all early execution in memory.
- Prefer small pure functions and explicit result objects over hidden global registries.
- Do not introduce plugin, save, event store, UI, scheduler, telemetry, localization, or gameplay
  behavior in the first M2 slices.

## What Reference Runtime Means

Reference runtime means a minimal production-quality implementation of the M1 contract behavior
needed for one in-memory vertical slice. It is:

- deterministic;
- JSON-safe;
- contract-aligned;
- testable without UI or content packages;
- bounded to known packages;
- explicit about diagnostics and failure results.

It can be used as the behavioral baseline for future runtime work, but it is not allowed to become a
monolithic engine.

## What Reference Runtime Is Not

Reference runtime is not:

- a full gameplay runtime;
- an editor runtime;
- a Save system;
- an Event Store;
- a plugin host;
- a UI renderer;
- a localization or telemetry runtime;
- a scheduler;
- a content authoring pipeline;
- a production registry for every future contract family.

## Production Runtime vs Test-Support

M1 test helpers and fixtures may be used as behavioral references. They must not be copied wholesale
into production packages. When oracle behavior is needed in runtime, a future implementation task
must extract the contract rule into a production-owned module with:

- its own package boundary;
- its own tests;
- clear public exports;
- no dependency on `tests/**`, `docs/**`, or `tests/fixtures/**`;
- diagnostics that follow the Validation Diagnostic Contract.

Test-support may import production runtime to build fixtures and regression tests. Production runtime
must never import test-support.

## Minimal Vertical Slice

The smallest safe vertical slice is split into five stages:

### M2A - Shared Foundations

- JSON-safe value model.
- Forbidden key rejection.
- Canonical serialization.
- Stable JSON Pointer/path helpers.
- Diagnostic model primitives that do not yet claim a complete diagnostic code registry.

### M2B - State Read/Write Primitives

- Entity Identity validation.
- Engine State shape and snapshot validation.
- Readonly path resolution.
- Condition evaluation over committed state.
- Effect application against candidate state copies.

### M2C - Transaction Pipeline

- Command plan ingestion, not a Command Bus.
- Transaction lifecycle.
- Revision checks.
- Rollback and no-op behavior.
- In-memory committed state only.

### M2D - Event Materialization

- Confirmed Domain Event materialization from committed transaction results.
- Event batch validation.
- No Event Store.
- No subscriber delivery.
- No replay.

### M2E - Minimal E2E Proof

- One small in-memory example.
- No gameplay/P0 content.
- No UI.
- No Save.
- No plugins.

## Recommended Package Layout

Use the current repository packages rather than adding generic placeholders:

- `packages/engine-contracts`: contract-facing constants, shared types, and schema-adjacent
  definitions.
- `packages/validation`: diagnostic primitives and validation result helpers.
- `packages/engine-state`: state snapshot validation and state path utilities.
- `packages/engine-rules`: condition and effect runtime primitives.
- `packages/engine-kernel`: command plan, transaction pipeline, and event materialization
  orchestration.
- `packages/test-support`: fixtures, oracle adapters, and regression helpers only.
- `schemas`: JSON Schema source files.
- `tests`: test suites and fixtures.
- `docs`: governance, contracts, and planning only.

Do not add `packages/core` or `packages/runtime` during TASK-015. If a later task needs a new
package, it must justify why the existing packages cannot hold the boundary.

## Dependency Rules

- Production packages must not import `tests/**`, `docs/**`, or `packages/test-support`.
- Runtime packages must not import authoring fixtures or P0 content.
- UI must not be a dependency of engine packages.
- Data/content must not contain executable logic.
- Engine packages must not know a concrete story, scene, character, or P0 package.
- `packages/test-support` may import production packages for tests.
- Schema definitions may be consumed through a clear validation boundary; runtime packages must not
  parse governance docs at runtime.
- `packages/engine-kernel` may depend on lower-level engine packages, but lower-level packages must
  not depend on the kernel.

## Testing Strategy

- Keep existing contract tests and fixtures as regression coverage.
- Add unit tests for canonical utilities in M2A.
- Add focused package tests in each future task.
- Add regression tests against M1 fixtures where they prove contract compatibility.
- Add an E2E contract pipeline test only in the M2E task.
- Keep test oracles in `packages/test-support` and `tests/**`.
- Do not use P0 gameplay content as the first runtime proof.

## CI and Validation Strategy

Keep the existing required checks:

- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm build`
- `corepack pnpm validate`

Future M2 tasks should add:

- coverage for canonical utilities in M2A;
- package boundary checks once runtime imports appear;
- regression tests against M1 fixtures;
- a minimal E2E contract pipeline test in M2E.

Do not add a new CI workflow in TASK-015.

## Security Constraints

M2 must handle these risks deliberately:

| Risk | First owning stage |
| --- | --- |
| Prototype pollution keys | M2A |
| Executable payloads | M2A |
| Unsafe object keys | M2A |
| Cyclic objects | M2A |
| Non-JSON values | M2A |
| Payload bombs | M2A and per-package budgets |
| Stale revision | M2C |
| Duplicate command/transaction/event | M2C and M2D |
| Diagnostic leakage | M2A and validation package |
| Plugin/runtime boundary confusion | Deferred until plugin work |

## Known Risks

- Diagnostic code inventory has a small parity risk between the Validation Diagnostic Contract and
  `CONTRACT_INVENTORY.md`; this does not block M2A if M2A only implements generic diagnostic shape
  and code grammar.
- The roadmap mentions M2 view model generation, but the first safe M2 reference runtime cut should
  not start UX-facing work before the in-memory core pipeline is stable.
- Future event identity determinism needs a canonical slug algorithm before event materialization.
- Save/persistence decisions must not leak into Transaction or Domain Event work.

## Explicit Non-Goals

- No production Condition Resolver in TASK-015.
- No production Effect Executor in TASK-015.
- No production Command Bus in TASK-015.
- No production Transaction Manager in TASK-015.
- No production Event Bus, Event Store, Save, UI, editor, plugin runtime, scheduler, telemetry,
  localization, networking, gameplay content, or public content tooling in TASK-015.
- No M1 contract rewrite unless a future review proves a blocker.
