# Assistant Agent Work Orders (Copy/Paste Ready)

Use these exact blocks to assign work to agents.

## Global Instruction Prefix (Attach To Every Assignment)

```text
You are assigned one assistant roadmap track only.
Read and obey:
1) docs/ai/ASSISTANT_EXECUTION_RULEBOOK.md
2) docs/ai/ASSISTANT_PHASE_BOARDS_FE_BE.md
3) docs/ai/ASSISTANT_AGENT_REPORTING_CONTRACT.md

Hard rule: do not modify any file outside the allowlist for your assigned phase/track.
Do not start another phase.
Do not add extra features.
Deliver exactly the expected outcome and report in required format.
```

---

## Phase 01 Backend Work Order

```text
Assignment: Phase 01 Backend
Allowed files:
- src/main/assistant/**
- src/main/ipc/handlers/assistant-handlers.ts
- src/main/ipc/handlers.ts
- src/preload/index.ts

Tasks:
1) Stabilize assistant bridge lifecycle (connect/disconnect/init/stop).
2) Ensure JSON-RPC handling is deterministic.
3) Implement runtime model listing (`model/list`) integration.
4) Expose typed IPC/preload endpoints for assistant lifecycle + models.

Expected outcome:
- Assistant bridge is stable.
- Runtime models are source of truth.
- Lifecycle endpoints are reliable and typed.

Forbidden:
- Any non-assistant feature edits.
- Any changes outside allowed files.
```

## Phase 01 Frontend Work Order

```text
Assignment: Phase 01 Frontend
Allowed files:
- src/renderer/src/pages/Assistant.tsx
- src/renderer/src/pages/settings/AssistantSettings.tsx
- src/renderer/src/lib/settings.tsx

Tasks:
1) Wire connect/disconnect + status UX to assistant runtime APIs.
2) Use runtime model list in settings model selector.
3) Keep settings persistence valid and backward-safe.

Expected outcome:
- User can configure assistant model from runtime-accurate list.
- Assistant page reflects real connection state.

Forbidden:
- Editing non-assistant routes/pages/components.
```

---

## Phase 02 Backend Work Order

```text
Assignment: Phase 02 Backend
Allowed files:
- src/main/assistant/**

Tasks:
1) Fix streaming delta accumulation.
2) Ensure single final message lock behavior.
3) Handle completed/failed/interrupted turns cleanly.

Expected outcome:
- No duplicate or corrupted final responses.
- Turn lifecycle states are consistent.
```

## Phase 02 Frontend Work Order

```text
Assignment: Phase 02 Frontend
Allowed files:
- src/renderer/src/pages/Assistant.tsx
- src/renderer/src/pages/assistant/**

Tasks:
1) Render stream smoothly with no flicker.
2) Render final answer once turn completes.
3) Keep busy/composer controls correct during active turn.

Expected outcome:
- Stable stream-to-final UX, no duplicate final render.
```

---

## Phase 03 Backend Work Order

```text
Assignment: Phase 03 Backend
Allowed files:
- src/main/assistant/**
- src/main/ipc/handlers/assistant-handlers.ts
- src/preload/index.ts

Tasks:
1) Add regenerate/attempt-aware backend contracts.
2) Ensure history payload supports attempt versions.

Expected outcome:
- Backend supports multiple attempts per assistant reply.
```

## Phase 03 Frontend Work Order

```text
Assignment: Phase 03 Frontend
Allowed files:
- src/renderer/src/pages/Assistant.tsx
- src/renderer/src/pages/assistant/**

Tasks:
1) Add copy action per assistant response.
2) Add regenerate action.
3) Add attempt switching UI (prev/next + index).

Expected outcome:
- Users can regenerate and navigate attempts safely.
```

---

## Phase 04 Backend Work Order

```text
Assignment: Phase 04 Backend
Allowed files:
- src/main/assistant/**

Tasks:
1) Normalize reasoning/activity event payloads.
2) Attach reasoning/events to correct turn and attempt.

Expected outcome:
- Thought/activity stream is structurally correct.
```

## Phase 04 Frontend Work Order

```text
Assignment: Phase 04 Frontend
Allowed files:
- src/renderer/src/pages/Assistant.tsx
- src/renderer/src/pages/assistant/**

Tasks:
1) Add collapsible reasoning blocks.
2) Add typed activity rows (command/file/search/tool).
3) Keep reasoning linked to correct attempt.

Expected outcome:
- Reasoning UI is readable, collapsible, and accurate.
```

---

## Phase 05 Backend Work Order

```text
Assignment: Phase 05 Backend
Allowed files:
- src/main/assistant/**
- src/main/ipc/handlers/assistant-handlers.ts
- src/preload/index.ts

Tasks:
1) Enforce SAFE vs YOLO decision policy.
2) Expose approval request events with detail payload.
3) Ensure approval decisions update runtime behavior instantly.

Expected outcome:
- Approval workflow is deterministic and safe.
```

## Phase 05 Frontend Work Order

```text
Assignment: Phase 05 Frontend
Allowed files:
- src/renderer/src/pages/Assistant.tsx
- src/renderer/src/pages/assistant/**
- src/renderer/src/pages/settings/AssistantSettings.tsx

Tasks:
1) Build approval request UI.
2) Add YOLO warning confirmation UX.
3) Reflect current approval mode in session header.

Expected outcome:
- User can review and control approvals confidently.
```

---

## Phase 06-12 Assignment Rule

For Phases 06 through 12:

1. Use the same structure as above.
2. Copy phase allowlist and expected outcomes from:
   - `docs/ai/ASSISTANT_PHASE_BOARDS_FE_BE.md`
3. Include explicit allowed files in each assignment.
4. Include explicit forbidden scope in each assignment.

Do not assign Phase 06+ until Phase 05 is fully signed off.

