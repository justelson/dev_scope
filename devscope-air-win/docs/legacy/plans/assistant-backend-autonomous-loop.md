# Assistant Backend Autonomous Loop

Track: backend only.

## Scope Rule

Use only backend allowlists from:

- `docs/ai/ASSISTANT_SCOPE_ALLOWLIST_MATRIX.md`
- `docs/ai/ASSISTANT_PHASE_BOARDS_FE_BE.md`

Do not modify frontend files.

## Backend Phase Sequence

1. Phase 01 backend tasks.
2. Phase 02 backend tasks.
3. Phase 03 backend tasks.
4. Phase 04 backend tasks.
5. Phase 05 backend tasks.
6. Phase 06 backend tasks.
7. Phase 07 backend tasks.
8. Phase 08 backend tasks.
9. Phase 09 backend tasks.
10. Phase 10 backend tasks.
11. Phase 11 backend tasks.
12. Phase 12 backend tasks + final validation.

## Per-Phase Loop

For each phase:

1. Check `docs/plans/assistant-backend-progress.md`.
2. If phase status is already `complete`, skip this phase.
3. Read backend section for that phase in `docs/ai/ASSISTANT_PHASE_BOARDS_FE_BE.md`.
4. Implement only listed backend tasks.
5. Confirm expected outcome criteria for backend scope.
6. Append one row in `docs/ai/dispatch/assistant_backend_log.csv`.
7. Update `docs/plans/assistant-backend-progress.md` with:
   - phase id
   - changed files
   - outcome pass/fail
   - blocker or none
8. If pass and no blocker, move to next phase.
9. If blocked, stop and record blocker clearly.

## No-Test Rule Until Final Phase

1. Do not run tests/build/typecheck in phases 01 to 11.
2. Perform full backend verification only in Phase 12 final step.

## Completion Condition

Backend loop is complete only when:

1. Phase 01 through 12 backend tasks are done.
2. Final validation step is complete in Phase 12.
3. Progress file marks all phases complete.
