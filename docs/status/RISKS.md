# Risks

## Active Risks

- **Scope creep during M1 contract design**: mitigated by one active task, contract-first scope, and
  explicit out-of-scope sections.
- **Premature pipeline implementation**: M1 must design contracts before implementing State Store,
  Condition Resolver, Effect Executor, Command pipeline, Transaction Manager, Event Log, Scheduler,
  Save, runtime UI, editor UI, plugin runtime, or theme system.
- **Public contract fragmentation**: mitigated by `CONTRACT_INVENTORY.md`,
  `CONTRACT_DEPENDENCY_ORDER.md`, and `CONTRACT_VERSIONING_POLICY.md`.
- **False sense of safety from boundary checks**: `tools/check-boundaries.mjs` catches current import,
  dependency, and executable data boundary violations only; it does not prove domain semantics.
- **Local Node version drift**: local checks may run under Node 24 and emit an engine warning; CI and
  `.nvmrc` remain pinned to Node 22.
- **Over-broad first M1 task**: the first M1 task must stay limited to Entity Identity Contract
  design and fixtures, not runtime registry implementation.
- **Mixing contract design with implementation**: mitigated by TASK-004 out-of-scope rules and Gate
  D confirmation that implementation has not started.

## Monitoring

Risks must be revisited at the end of every milestone and when an ADR changes public contracts.
