# TASK-012 Handoff - Validation Diagnostic Contract

## Status

DONE. No commit has been created for this task.

## Scope in Progress

- `docs/contracts/VALIDATION_DIAGNOSTIC_CONTRACT.md`
- `schemas/validation-diagnostic.schema.json`
- `tests/validation-diagnostic-contract.test.ts`
- `tests/fixtures/contracts/validation-diagnostic/**`
- `docs/contracts/CONTRACT_INVENTORY.md`
- `docs/status/CURRENT_STATE.md`
- `docs/tasks/done/TASK-012-design-validation-diagnostic-contract.md`

## Core Decisions

- Diagnostics are stable, JSON-safe, redaction-safe structured findings, not logs, exceptions, or
  player-facing text.
- Diagnostic codes use uppercase constant grammar. The canonical registry key is `(owner contract,
  code)` so same-spelled codes from other contracts remain contextual rather than silently remapped.
- `diagnosticId` is optional. When present, it uses the Entity Identity Contract and the canonical
  entity type is `validation-diagnostic`.
- Severity is `info`, `warning`, `error`, or `fatal`.
- Categories are intentionally limited to the core validation buckets in the draft contract.
- Phase is a lowercase registry-defined key. Unknown extension phases may be preserved as namespaced
  keys.
- Location is a structured document/state/schema/event/batch reference using JSON Pointer semantics.
- Source and related references are structured and bounded. They are not authorization claims.
- `message` is a developer-facing fallback, not a localization key.
- `expected` and `actual` are redaction-safe value descriptors.
- The aggregate result model is `valid`, `valid-with-warnings`, `invalid`, or `fatal`.

## Test Oracle Boundary

- The validation-diagnostic test helper is a contract oracle only.
- It is not a production validation framework, logger, telemetry pipeline, localization runtime,
  exception mapper, or UI renderer.
- It does not read the network, filesystem, environment, or system clock.
- It simulates shape validation, semantic checks, fingerprinting, ordering, redaction, and aggregate
  summarization only.

## Fixture Coverage

- Valid fixtures cover error, warning, info, fatal, document locations, state locations, schema
  locations, event locations, batch locations, source references, related references, safe
  expected/actual values, redacted actual values, metadata, explicit owner contract context, simple
  and multi-segment code grammar cases, and aggregate result statuses.
- Invalid fixtures cover malformed schema versions, invalid IDs, invalid code/severity/category/
  phase values, invalid code grammar variants, invalid locations, invalid source references, unknown
  root fields, oversized messages, excessive related references, executable-like fields, unsafe
  nested metadata, and invalid expected/actual shapes.
- Semantic-invalid fixtures cover unknown codes, registry default mismatches, source/location kind
  mismatches, duplicate fingerprints, aggregate status mismatches, sensitive values without
  redaction, budget overflow, and causal cycles.
- Runtime-invalid fixtures cover functions, Date, Map, Set, NaN, Infinity, cyclic objects, and
  forbidden nested keys.

## Known Limits

- Cross-contract code collisions are inventoried rather than renamed.
- The oracle is intentionally scoped to contract validation and does not implement a production
  diagnostics stack.
- Localization mapping, telemetry export, and log transport remain deferred.

## Next Step

The Validation Diagnostic Contract implementation is complete. TASK-012 is done and no active task
remains.
