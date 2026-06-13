# Roadmap

## M0 - Governance and Contracts

Status: completed by Gate D review on 2026-06-13.

Establish repository structure, governance documents, task flow, ADR policy, workspace commands,
CI skeleton, and initial contract inventory.

Exit criteria:

- Required governance documents exist.
- Task workflow is consistent: at most one task is active during work, and no task is active at
  milestone closure.
- CI runs lint, typecheck, test, build, and validate.
- Repository independence checks pass.
- Contract inventory, dependency order, versioning policy, and executable boundary checks exist.

## M1 - Core Foundation

Status: next milestone, not active.

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
