# M2 Deferred Decisions Recheck

Source: `docs/reviews/M1_DEFERRED_DECISIONS_REGISTER.md`

## Summary

No deferred decision blocks the first M2A task for shared JSON-safe and canonical serialization
utilities. Several decisions must be resolved before transaction persistence, event materialization,
Save, plugins, or public content tooling.

## SAFE FOR M2

| ID | Source | Recommendation | Impact | Latest milestone | Trigger |
| --- | --- | --- | --- | --- | --- |
| DDR-001 | Entity Identity | Keep built-in entity type registry deferred for M2A/M2B; validate known contract entity types locally. | Avoids premature registry. | Before first concrete content package. | New built-in type family is introduced. |
| DDR-006 | Schema Versioning | Keep sparse reader support deferred; contiguous ranges are enough for first helpers. | Simpler compatibility logic. | Later registry tooling. | Sparse version support becomes necessary. |
| DDR-007 | Schema Versioning | Keep registry file location deferred; use explicit descriptors in tests. | Avoids CI/tooling churn. | Later automation work. | Registry generation becomes part of CI. |
| DDR-010 | Engine State | Keep exact required core domains deferred; M2E can use neutral test domains. | Avoids gameplay/domain lock-in. | Before first concrete vertical slice with fixed domains. | A concrete vertical slice needs a fixed domain set. |
| DDR-013 | Condition | Keep final condition registry model deferred; implement built-in M1 condition types directly. | Avoids registry runtime. | Before extension condition families. | New condition families require registration. |
| DDR-014 | Condition | Keep regex/advanced matchers deferred. | Avoids ReDoS and matcher scope creep. | Later world/simulation work. | Regex-based gameplay rules are requested. |
| DDR-015 | Condition | Keep explain trace envelope deferred. | Evaluation can return diagnostics without authoring UX traces. | Authoring tools. | Authoring explain UX is scoped. |
| DDR-016 | Effect | Keep context-based operands deferred for first effect applicator. | Avoids hidden caller context. | Later pipeline work. | A new effect family needs caller context. |
| DDR-017 | Effect | Keep copy/merge object effects deferred. | Avoids deep-merge ambiguity. | Later simulation work. | A content domain needs structured merges/copies. |
| DDR-018 | Effect | Keep insert semantics deferred. | Base list operations remain enough. | Later simulation work. | Array insertion semantics are required. |
| DDR-019 | Command | Keep concrete handler registry deferred; use explicit reference handlers only. | Prevents Command Bus scope creep. | Command runtime milestone. | Command dispatch implementation starts. |
| DDR-021 | Command | Keep request-context contract deferred. | M2 can use command envelope metadata. | Runtime orchestration. | A caller wants a dedicated request-context shape. |
| DDR-024 | Transaction | Keep system transaction audit schema deferred. | Avoids observability scope in transaction core. | Audit/observability tooling. | System transactions need a dedicated audit shape. |
| DDR-027 | Domain Event | Keep public-event-per-commit policy deferred. | Empty event batches remain allowed. | Game content policy / M2. | A gameplay domain needs mandatory public events. |
| DDR-028 | Domain Event | Keep Integration Event and Audit Event contracts deferred. | Avoids external transport scope. | Integration tooling/editor. | A transport or audit envelope is needed. |
| DDR-030 | Validation Diagnostic | Keep persisted diagnostic IDs deferred. | M2 can use optional diagnostic IDs. | Tooling/telemetry milestone. | A consumer needs durable diagnostic references. |
| DDR-032 | Validation Diagnostic | Keep more aggressive adapter namespacing deferred. | Owner-contract tuple remains enough. | Public content tooling. | Multi-package diagnostic sharing becomes common. |

## MUST RESOLVE BEFORE FIRST RUNTIME TASK

None. M2A can begin with shared JSON-safe/canonical utilities using existing M1 contracts.

## MUST RESOLVE BEFORE TRANSACTION IMPLEMENTATION

| ID | Source | Recommendation | Impact | Latest milestone | Trigger |
| --- | --- | --- | --- | --- | --- |
| DDR-022 | Transaction | Decide whether M2C requires `transactionId` for every in-memory transaction or only external APIs. | Affects duplicate handling and event binding. | Before TASK-024 if events require stable transaction identity. | External transaction APIs or event materialization need canonical IDs. |
| DDR-023 | Transaction | Define in-memory idempotency shape separately from durable idempotency storage. | Prevents durable-store assumptions in M2C. | Before TASK-024. | Duplicate transaction handling becomes production behavior. |

## MUST RESOLVE BEFORE EVENT MATERIALIZATION

| ID | Source | Recommendation | Impact | Latest milestone | Trigger |
| --- | --- | --- | --- | --- | --- |
| DDR-025 | Domain Event | Select deterministic event identity slug algorithm before implementing materialization. | Prevents incompatible event IDs across implementations. | Before TASK-025. | A canonical materializer is implemented. |
| DDR-022 | Transaction | Confirm transaction identity requirements before materializing events. | Event batches require transaction binding. | Before TASK-025. | Event materialization starts. |

## MUST RESOLVE BEFORE SAVE/PERSISTENCE

| ID | Source | Recommendation | Impact | Latest milestone | Trigger |
| --- | --- | --- | --- | --- | --- |
| DDR-004 | Entity Identity | Define package-level alias graph validation before persisted references rely on aliases. | Prevents corrupted saved references. | Save/persistence. | Build or load validation needs alias graph checks. |
| DDR-009 | Schema Versioning | Define legacy import profiles before importing missing-version data. | Prevents unsafe legacy reads. | Save/import/migration. | Real legacy content must be imported. |
| DDR-011 | Engine State | Draft Save envelope separately. | Prevents state metadata from becoming an implicit save format. | Save/persistence. | Save contract drafting begins. |
| DDR-020 | Command | Define durable deduplication retention. | Prevents inconsistent idempotency history. | Save/persistence. | Durable deduplication storage is needed. |
| DDR-022 | Transaction | Decide external transaction identity requirements. | Required for replay/audit/persistence consistency. | Save/persistence. | External transaction APIs are specified. |
| DDR-023 | Transaction | Define final idempotency store shape. | Prevents duplicate behavior drift. | Save/persistence. | Deduplication persistence is introduced. |
| DDR-025 | Domain Event | Persist deterministic event identity policy. | Prevents replay/store divergence. | Event materialization/store. | Canonical event IDs are stored. |
| DDR-026 | Domain Event | Define global event store position in Event Store work, not M2D. | Avoids store scope inside materializer. | Event store milestone. | Event Store design begins. |
| DDR-029 | Domain Event | Define timestamp/storage metadata outside Domain Event payload. | Prevents metadata/domain fact confusion. | Save/persistence. | Storage metadata design starts. |

## MUST RESOLVE BEFORE PLUGINS

| ID | Source | Recommendation | Impact | Latest milestone | Trigger |
| --- | --- | --- | --- | --- | --- |
| DDR-003 | Entity Identity | Define plugin namespace and type registration with plugin manifest/capabilities. | Prevents extension collisions. | Before plugins. | Plugin manifest work starts. |
| DDR-012 | Engine State | Define permission/capability contract before plugin mutation. | Prevents cross-domain overreach. | Before plugins. | Permissioned mutation is introduced. |

## MUST RESOLVE BEFORE PUBLIC CONTENT TOOLING

| ID | Source | Recommendation | Impact | Latest milestone | Trigger |
| --- | --- | --- | --- | --- | --- |
| DDR-002 | Entity Identity | Define game manifest namespace ownership before public packages. | Prevents namespace collisions. | Game manifest/content packaging. | Manifest schema needs ownership rules. |
| DDR-005 | Entity Identity | Define full reference contract before cross-package authoring tools. | Prevents ambiguous/dangling references. | Public content tooling. | Cross-package reference handling is implemented. |
| DDR-008 | Schema Versioning | Define schema hash/signature policy before public supply chain. | Improves integrity and provenance. | Public content tooling. | Integrity policy is introduced. |
| DDR-031 | Validation Diagnostic | Decide whether runtime-only diagnostics may omit `message`. | Prevents divergent diagnostic envelopes. | Runtime observability/public tooling. | Runtime-only diagnostic channel is designed. |
| DDR-033 | Validation Diagnostic | Define telemetry timestamp envelope separately. | Keeps diagnostics separate from telemetry. | Telemetry/observability. | Telemetry export is introduced. |

## Decision

Outcome remains `READY_FOR_M2A`. The first task can start if it is limited to shared JSON-safe and
canonical serialization utilities and does not claim to resolve registry, transaction, event store,
save, plugin, or public content tooling decisions.
