# Assistant Frontend Autonomous Loop

Track: frontend only.

## Scope Rule

Use only frontend allowlists from:

- `docs/ai/ASSISTANT_SCOPE_ALLOWLIST_MATRIX.md`
- `docs/ai/ASSISTANT_PHASE_BOARDS_FE_BE.md`

Do not modify backend files.

## Frontend Phase Sequence

1. Phase 01 frontend tasks.
2. Phase 02 frontend tasks.
3. Phase 03 frontend tasks.
4. Phase 04 frontend tasks.
5. Phase 05 frontend tasks.
6. Phase 06 frontend tasks.
7. Phase 07 frontend tasks.
8. Phase 08 frontend tasks.
9. Phase 09 frontend tasks.
10. Phase 10 frontend tasks.
11. Phase 11 frontend tasks.
12. Phase 12 frontend tasks + final validation.

## Per-Phase Loop

For each phase:

1. Check `docs/plans/assistant-frontend-progress.md`.
2. If phase status is already `complete`, skip this phase.
3. Read frontend section for that phase in `docs/ai/ASSISTANT_PHASE_BOARDS_FE_BE.md`.
4. Implement only listed frontend tasks.
5. Confirm expected outcome criteria for frontend scope.
6. Append one row in `docs/ai/dispatch/assistant_frontend_log.csv`.
7. Update `docs/plans/assistant-frontend-progress.md` with:
   - phase id
   - changed files
   - outcome pass/fail
   - blocker or none
8. If pass and no blocker, move to next phase.
9. If blocked, stop and record blocker clearly.

## No-Test Rule Until Final Phase

1. Do not run tests/build/typecheck in phases 01 to 11.
2. Perform full frontend verification only in Phase 12 final step.

## Completion Condition

Frontend loop is complete only when:

1. Phase 01 through 12 frontend tasks are done.
2. Final validation step is complete in Phase 12.
3. Progress file marks all phases complete.
