# Assistant Execution Rulebook

Status: authoritative execution rules for assistant implementation work.

## Purpose

This document prevents scope drift and context rot while implementing the assistant roadmap.
All contributor work must follow these rules.

## Hard Rules (Non-Negotiable)

1. Do not modify files outside the active phase allowlist.
2. Do not start Phase `N+1` until Phase `N` is 100% complete and signed off.
3. Do not mix backend and frontend objectives from different phases in one PR.
4. Do not introduce new dependencies unless the active phase explicitly requires it.
5. Do not perform opportunistic refactors outside phase scope.
6. Do not change unrelated UI/UX behavior.
7. Do not change existing public contracts unless the phase contract section says so.
8. Do not silently alter settings schema keys already in use without migration handling.
9. Do not change folder structure outside listed phase folders.
10. If blocked, stop and document blocker before touching unrelated code.

## Allowed Change Types By Default

- Bug fix directly tied to active phase objective.
- Type updates required by active phase contracts.
- Small utility functions only if referenced by active phase files.
- Logging tied to active phase observability needs.

## Forbidden Change Types By Default

- Large file moves unrelated to current phase.
- Renaming existing core routes/components without phase approval.
- Modifying `Projects`, `FolderBrowse`, `ProjectDetails` behavior unless phase says so.
- Cleanup-only commits mixed with feature commits.
- Unrequested stylistic rewrites.

## Work Sequence Rules

1. Read active phase doc.
2. Confirm all work is within phase folder allowlist.
3. Implement backend items for that phase.
4. Implement frontend items for that phase.
5. Verify phase acceptance criteria.
6. Record outcomes and unresolved risks.
7. Only then start the next phase.

## Completion Gate (Definition of Done For Any Phase)

A phase is only complete when all are true:

1. All required deliverables in phase doc are implemented.
2. All expected outcomes in phase doc are observable in app behavior.
3. No active blocker is open for that phase.
4. No out-of-scope file changes are present.
5. Handoff notes are written (what shipped, what remains, known risks).

## Escalation Rule

If any required change touches a path outside phase allowlist:

1. Stop implementation.
2. Document exact external path and reason.
3. Request explicit instruction to expand scope.
4. Resume only after scope expansion is approved.

## Folder Reference Conventions

Use explicit path references in all phase tasks:

- Backend: `src/main/**`, `src/preload/**`
- Frontend: `src/renderer/src/**`
- Shared contracts: `src/shared/**` only when phase explicitly allows it.

## Anti-Context-Rot Rules

1. Do not implement placeholder shortcuts for future phases.
2. Do not pre-wire future phase UI controls before backend contracts exist.
3. Do not add TODO-only scaffolding for features not in current phase.
4. Do not "partially start" next phase while current phase has unresolved criteria.
5. Keep phase notes updated with exact completed vs pending items.

