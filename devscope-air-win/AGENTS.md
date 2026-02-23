# Agent Session Constraints

These constraints were explicitly set by the user and should be treated as active defaults in this repo.

## Build/Test Permission
- Do **not** run rebuilds, full builds, or test suites unless the user explicitly re-approves in the current session.
- If validation is needed, prefer lightweight checks (for example, targeted syntax/transpile checks) unless build/test permission is granted.

## Agent/Escalation Permission
- Commands requiring agent/escalated privileges may need fresh approval in a new session.
- If a required command is blocked by sandbox/permissions, request approval before proceeding.

