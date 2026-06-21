# Content to M2 Primitive Integration

## Status

DRAFT

## Contract ID

`content-m2-primitive-integration`

## Contract Version

`content-m2-primitive-integration@0.1.0`

This is the first M3 draft for integrating declarative content package records with the accepted M2
primitive surface. It defines data-only binding rules, deterministic diagnostics expectations, and
test-only integration boundaries. It does not implement a runtime host, production loader, Save
system, Event Store, persistence layer, or gameplay execution loop.

## Purpose

Content to M2 Primitive Integration defines how content package data may bind to existing M2
primitives without starting a runtime host.

The contract exists to:

- define how content condition records map to the Condition Contract
- define how content effect records map to the Effect Contract
- define how content command or action records map to Command planning inputs
- define how content event mappings relate to Domain Event materialization inputs
- preserve deterministic diagnostics and data-only execution boundaries

## Relationship to Contracts

This contract composes:

- `CONTENT_PACKAGE_CONTRACT.md`
- `CONTENT_LOADER_BOUNDARY.md`
- `CONDITION_CONTRACT.md`
- `EFFECT_CONTRACT.md`
- `COMMAND_CONTRACT.md`
- `TRANSACTION_CONTRACT.md`
- `DOMAIN_EVENT_CONTRACT.md`

Rules:

- Content Package owns declarative content data and stable references.
- Content Loader Boundary defines the future validated-content input boundary.
- Condition, Effect, Command, Transaction, and Domain Event contracts define the M2 primitive
  shapes that content data may target.
- This integration contract defines binding rules only. It does not grant runtime execution
  privileges.

## Binding Model

Bindings are data-only projections from content records into M2 contract shapes.

### Content condition definition -> Condition Contract

- content condition definitions MAY embed or adapt to canonical Condition envelopes
- reusable condition references MUST resolve through stable IDs
- condition bindings MUST remain deterministic and JSON-safe

### Content effect definition -> Effect Contract

- content effect definitions MAY use content-facing shorthand records
- shorthand records MUST adapt explicitly into canonical Effect envelopes before any M2 primitive
  use
- adapted effects MUST define an explicit target domain and path
- effect adaptation MUST NOT imply commit or persistence

### Content command or action definition -> Command planning input

- content command or action definitions MAY map to canonical Command envelopes or to test-only
  command inputs that satisfy `COMMAND_CONTRACT.md`
- binding MUST be explicit about command type, payload shape, preconditions, and target references
- binding MUST NOT inject executable handlers into content data

### Content event mapping or template -> Domain Event materialization input

- content event mappings MAY describe how a committed result should map to one confirmed Domain
  Event candidate
- event mappings MUST provide an explicit source command or transaction binding
- event mappings MUST NOT bypass the committed-transaction confirmation boundary

### Content system or state keys -> Engine State paths

- content system definitions MAY describe domain IDs and path roots used by adapted effects or
  event payload mappings
- state-path ownership MUST stay explicit and deterministic
- content records MUST NOT mutate state by themselves

## Allowed Boundary Behavior

Within this contract boundary, adapters MAY:

- interpret content definitions as data only
- build a test-only Command planning input from a content command or action record
- adapt a content effect shorthand into a canonical Effect envelope
- call existing public M2 primitives in tests or other explicit boundary checks
- verify deterministic outputs, diagnostics, and immutability

This boundary MUST NOT:

- start a gameplay or runtime host
- read content packages from disk as a production loader
- persist state
- emit events into an Event Store or delivery pipeline
- use UI, editor, or plugin runtime surfaces

## Diagnostics

Integration failures SHOULD produce stable diagnostics for at least:

- missing condition binding
- missing effect binding
- invalid M2 primitive shape
- unsupported command kind
- event mapping without source
- disallowed or unknown state path
- unsupported binding version

Recommended codes:

- `CONTENT_BINDING_MISSING_CONDITION`
- `CONTENT_BINDING_MISSING_EFFECT`
- `CONTENT_BINDING_INVALID_CONDITION`
- `CONTENT_BINDING_INVALID_EFFECT`
- `CONTENT_BINDING_UNSUPPORTED_COMMAND_KIND`
- `CONTENT_BINDING_EVENT_SOURCE_REQUIRED`
- `CONTENT_BINDING_STATE_PATH_NOT_ALLOWED`
- `CONTENT_BINDING_UNSUPPORTED_VERSION`

Diagnostics SHOULD map through `CONTENT_VALIDATION_DIAGNOSTICS.md` and preserve stable paths such
as:

- `/sections/commands/0/conditionRefs/0`
- `/sections/commands/0/effectRefs/0`
- `/sections/commands/0/commandType`
- `/sections/effects/0/target/path`
- `/sections/eventMappings/0/commandId`

## Determinism

Content-to-M2 integration MUST be deterministic.

Rules:

- record traversal order MUST be stable
- diagnostics MUST sort deterministically
- identical content input MUST produce identical adapted M2 shapes
- integration MUST NOT depend on filesystem, network, time, locale, or randomness
- integration MUST preserve input immutability

## Non-Goals

- no runtime host
- no production loader
- no Save system
- no Event Store
- no persistence
- no UI/editor
- no gameplay/P0 content
- no plugin runtime

## Example

Illustrative neutral binding set:

- content command `demo.command.inspect`
- content condition `condition.demo.has-key`
- content effect `effect.demo.mark-inspected`
- content event mapping `demo.event.inspected`

In a test-only adapter:

1. `demo.command.inspect` maps to a canonical Command envelope used only for planning checks.
2. `condition.demo.has-key` is interpreted through the Condition Contract.
3. `effect.demo.mark-inspected` adapts into a canonical `effect@0.1.0` envelope with explicit
   target domain and path.
4. `demo.event.inspected` maps to a committed Domain Event candidate only after a committed
   transaction result exists.

## Acceptance Criteria

TASK-035 is complete when:

- the contract exists at `docs/contracts/CONTENT_M2_PRIMITIVE_INTEGRATION.md`
- binding rules for condition, effect, command, transaction, and domain event integration are
  documented
- deterministic diagnostics expectations are documented
- at least one test-only integration path exists using the minimal neutral content fixture and
  public M2 APIs
- no production loader, runtime host, Save, Event Store, persistence, UI, gameplay, or plugin
  runtime implementation is added
- the next recommended task is `TASK-036 - M3 gate review`

## Known Limitations

- no production adapter helper exists in this task
- command planning uses test-only interpretation rather than a finalized content runtime host
- event mappings still require explicit host-owned adaptation choices for canonical event payloads

## Deferred Decisions

- exact ownership of a future content-model adapter package
- whether a future validated content graph should carry pre-adapted M2 envelopes or only raw
  declarative records
- exact version registry for content-to-M2 binding adapters
