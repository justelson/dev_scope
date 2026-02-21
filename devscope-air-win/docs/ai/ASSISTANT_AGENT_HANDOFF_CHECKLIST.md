# Assistant Agent Handoff Checklist

Use this before accepting any phase/track handoff.

## A. Scope Check

1. Changed files are only in active phase allowlist.
2. No cross-phase feature work is present.
3. No unrelated refactor/cleanup changes are bundled.

## B. Contract Check

1. Backend contract changes match phase objective.
2. Frontend behavior changes match phase objective.
3. Settings/schema changes include safe fallback behavior.

## C. Outcome Check

1. All expected outcomes for the phase are demonstrated.
2. All phase exit checklist items are marked pass with evidence.
3. No blocker remains open.

## D. Quality Check

1. No obvious runtime regressions in assistant surface.
2. No obvious regressions in non-assistant pages.
3. Error paths are actionable (not silent failures).

## E. Merge Decision

Accept only if all are true:

1. A-D are fully green.
2. Reporting contract is complete.
3. No out-of-scope file edits exist.

Reject if any are false, with precise remediation request.

