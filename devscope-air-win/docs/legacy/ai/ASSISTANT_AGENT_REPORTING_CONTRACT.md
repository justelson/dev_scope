# Assistant Agent Reporting Contract

Every agent must report using this exact structure.

## Required Report Format

### 1. Assignment
- Track: `Phase X Backend` or `Phase X Frontend`
- Objective: one sentence

### 2. Files Changed
- List exact file paths modified.
- State `NONE` for any allowed path not touched.

### 3. Scope Compliance
- Confirm: `I only modified allowed paths for this phase.`
- If false: list every out-of-scope path and reason.

### 4. Work Completed
- Flat list of implemented items mapped to phase tasks.

### 5. Expected Outcome Check
- For each expected outcome in phase doc: `PASS` or `FAIL` with evidence.

### 6. Validation
- Commands run.
- Result summary.
- If command not run: state why.

### 7. Blockers
- `NONE` or explicit blocker with impact.

### 8. Risks
- Residual risks after changes.

### 9. Handoff
- Ready for review: `YES` or `NO`.

## Rejection Rules

Reject report if any is missing:

1. Exact changed files.
2. Scope compliance statement.
3. Expected outcome checks.
4. Validation evidence.

