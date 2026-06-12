# Agent Operating Rules

These rules apply to Codex, ChatGPT, and any other automation agent working in this repository.

1. Always read `docs/status/CURRENT_STATE.md` before changing files.
2. Work on exactly one task in `docs/tasks/active` at a time.
3. Do not change scope without a task or ADR.
4. Do not add new systems outside the active milestone.
5. Do not add game content to engine core.
6. Do not change public contracts without an ADR and migration impact assessment.
7. Run the prescribed checks before handoff: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm validate`.
8. Create a handoff in `docs/handoffs` after work.
9. Update `docs/status/CURRENT_STATE.md` after work.
10. Do not write ideas directly into implementation; use `docs/ideas`.

If these rules conflict with a task, stop and create or request an ADR.

