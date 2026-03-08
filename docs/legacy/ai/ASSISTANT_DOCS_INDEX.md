# Assistant Docs Index

Use this index as the single entry point for assistant delivery.

## Read Order (Mandatory)

1. `docs/ai/ASSISTANT_EXECUTION_RULEBOOK.md`
2. `docs/ai/ASSISTANT_PHASE_BOARDS_FE_BE.md`
3. `docs/ai/ASSISTANT_SCOPE_ALLOWLIST_MATRIX.md`
4. `docs/ai/ASSISTANT_AGENT_WORK_ORDERS.md`
5. `docs/ai/ASSISTANT_AGENT_REPORTING_CONTRACT.md`
6. `docs/ai/ASSISTANT_AGENT_HANDOFF_CHECKLIST.md`
7. `docs/ai/ASSISTANT_AGENT_DISPATCH_INDEX.md`

Do not start implementation until all listed documents are read.

## Overall Expected Outcome (Program Level)

At the end of all phases, the assistant must:

1. Run reliably on `codex app-server` with runtime-accurate model handling.
2. Provide stable streaming/final response behavior with no duplication/flicker.
3. Support safe/YOLO approval workflows with explicit user control.
4. Provide practical debugging through event logs and trace visibility.
5. Maintain persistent sessions/history and recover from common failures.
6. Deliver high-impact workflows (diff explanation, staged review, commit draft).
7. Avoid regressions in non-assistant areas of DevScope.

## Scope Enforcement Reminder

- Modify only active phase allowlist paths.
- Do not pull future-phase work into current phase.
- Do not touch unrelated files unless explicitly instructed.
