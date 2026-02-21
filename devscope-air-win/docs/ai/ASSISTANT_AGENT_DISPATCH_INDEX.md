# Assistant Agent Dispatch Index

Use this as the command center to direct multiple agents.

## Read Order For Every Agent

1. `docs/ai/ASSISTANT_EXECUTION_RULEBOOK.md`
2. `docs/ai/ASSISTANT_PHASE_BOARDS_FE_BE.md`
3. `docs/ai/ASSISTANT_AGENT_WORK_ORDERS.md`
4. `docs/ai/ASSISTANT_AGENT_REPORTING_CONTRACT.md`
5. `docs/ai/ASSISTANT_AGENT_HANDOFF_CHECKLIST.md`

## Dispatcher Rules

1. Assign one phase track per agent at a time (`Phase N Backend` or `Phase N Frontend`).
2. Do not assign Phase `N+1` before Phase `N` is signed off.
3. Do not let two agents edit the same file in parallel.
4. Require every agent report in the exact reporting contract format.
5. Reject handoff if any out-of-scope file was modified.

## Approved Assignment Pattern

1. Send agent the exact work order block from `ASSISTANT_AGENT_WORK_ORDERS.md`.
2. Ask for report using `ASSISTANT_AGENT_REPORTING_CONTRACT.md`.
3. Validate using `ASSISTANT_AGENT_HANDOFF_CHECKLIST.md`.
4. Merge only if checklist is fully green.

