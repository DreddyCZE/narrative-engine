# Universal Narrative Engine

Greenfield, genre-neutral foundation for a reusable narrative engine, editor workflow, validation tooling, and game data contracts.

This repository is not a game project. It must not copy story content, assets, UI, terminology, maps, mechanics, or source code from any existing game. Concrete games live as separate data packages above stable engine contracts.

## Current Milestone

M0 - Governance and Contracts.

Before starting work, read:

1. [CURRENT_STATE.md](docs/status/CURRENT_STATE.md)
2. [PROJECT_CHARTER.md](PROJECT_CHARTER.md)
3. [AGENTS.md](AGENTS.md)

## Commands

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm validate
```

## Workspace

- `apps/runtime` - future runtime shell; no UI framework selected in M0.
- `apps/editor` - future editor shell; no UI framework selected in M0.
- `packages/engine-*` - engine libraries and public contracts.
- `packages/validation` - repository and contract validation tooling.
- `games/examples` - neutral example fixtures only.
- `docs` - governance, ADRs, roadmap, tasks, status, reports, handoffs.

