# Assistant Autonomous Delivery Overview

Status: active execution plan for parallel autonomous agents.

## Goal

Run two agents in parallel:

1. Backend agent: completes backend work across all assistant phases.
2. Frontend agent: completes frontend work across all assistant phases.

Both agents progress phase-by-phase on their own track, log work, self-check phase gates, and continue until completion.

## Mandatory Source Docs

Agents must read these before starting:

1. `docs/ai/ASSISTANT_DOCS_INDEX.md`
2. `docs/ai/ASSISTANT_EXECUTION_RULEBOOK.md`
3. `docs/ai/ASSISTANT_PHASE_BOARDS_FE_BE.md`
4. `docs/ai/ASSISTANT_SCOPE_ALLOWLIST_MATRIX.md`
5. `docs/ai/ASSISTANT_AGENT_REPORTING_CONTRACT.md`
6. `docs/ai/ASSISTANT_AGENT_HANDOFF_CHECKLIST.md`

## Autonomous Progression Rules

1. Each agent works only its own track (`backend` or `frontend`).
2. Each agent completes Phase `N` before starting Phase `N+1`.
3. After each phase, agent logs completion row and phase summary.
4. If scope is blocked, agent records blocker and stops.
5. If no blocker and phase gate passes, agent continues automatically to next phase.
6. If a phase is already marked `complete` in the track progress file, skip it and continue.
7. If required outputs for a phase already exist and are valid, mark `skipped (already complete)` and continue.

## Testing Policy Override

Per user instruction:

1. No tests/build/typecheck runs during phases 01 through 11.
2. No full validation commands until final completion phase.
3. Final verification happens only at Phase 12 close.

## Logging and Approval Flow

1. Backend agent writes to `docs/ai/dispatch/assistant_backend_log.csv`.
2. Frontend agent writes to `docs/ai/dispatch/assistant_frontend_log.csv`.
3. Reviewer writes decisions to `docs/ai/dispatch/assistant_reviewer_decisions.csv`.
4. Agents maintain short phase notes in:
   - `docs/plans/assistant-backend-progress.md`
   - `docs/plans/assistant-frontend-progress.md`

## Expected Program Outcome

1. Assistant backend and frontend are both complete through Phase 12.
2. No out-of-scope edits were made.
3. Final phase includes full validation/testing and regression pass.
