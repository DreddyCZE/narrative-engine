# Project Charter

## Vision

Build a universal, genre-neutral narrative engine that can run many story-driven games from validated data packages. The engine must support contract-first evolution, deterministic behavior, explainable state changes, and tooling that helps human authors and AI agents collaborate through Git.

## Layer Boundaries

The project is split into four primary layers:

- **Engine**: deterministic state, commands, rules, events, contracts, validation, and headless execution.
- **Game Data**: story content, entities, localization, rules configuration, assets references, and fixtures for a specific game package.
- **UX**: presentation, accessibility, themes, input handling, and view rendering.
- **Editor**: authoring workflow, previews, validation, diffs, reports, and handoffs.

No layer may reach into another layer's internals. Cross-layer communication must use versioned public contracts.

## Source of Truth

Git is the only source of truth for canonical project state, decisions, tasks, contracts, and implementation. Generated or AI-proposed material is not canonical until committed through the documented workflow.

## Development Model

- Development is **contract-first**: public schema and API changes require ADR review before implementation.
- Build **vertical slices before breadth**: prove a small end-to-end path before expanding systems.
- Scope may not silently expand. New systems require an active task, and architectural changes require an ADR.
- Existing game projects must not be copied into this repository.
- Ideas go to `docs/ideas`; they do not go directly into implementation.

## Non-Goals for the First Version

- Runtime UI implementation.
- Editor UI implementation.
- Concrete game, theme, story, map, quest, inventory, minigame, or NPC simulation.
- Production save system.
- Plugin marketplace.
- Backend service, cloud accounts, multiplayer, or telemetry.
- Automatic publication of AI-generated content.
- Framework selection for runtime or editor before a dedicated ADR.

