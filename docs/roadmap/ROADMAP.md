# Roadmap

## M0 - Governance and Contracts

Establish repository structure, governance documents, task flow, ADR policy, workspace commands,
CI skeleton, and initial contract inventory.

Exit criteria:

- Required governance documents exist.
- Exactly one active task is present.
- CI runs lint, typecheck, test, build, and validate.
- Repository independence checks pass.

## M1 - Core Foundation

Define minimal engine contracts, command pipeline interfaces, state container boundaries, event log
shape, and validation entry points.

## M2 - Minimal Narrative Vertical Slice

Implement a headless vertical slice from neutral data fixture to command execution, state update,
event output, and view model generation.

## M3 - World and Simulation

Add neutral world hierarchy, scheduling, explainable rules, and simulation boundaries based on
validated contracts.

## M4 - Editor Foundation

Add editor architecture, data authoring contracts, validation reports, diff workflow, and preview
integration. UI framework selection requires a dedicated ADR.

## M5 - AI-first Workflow

Define context packs, provenance, review states, AI draft handling, and safe agent workflows.

## M6 - Reference Demonstration Package

Create a small original, genre-neutral demonstration package that proves engine reuse. It must not
be based on any existing game, story, setting, UI, assets, maps, characters, or mechanics.

