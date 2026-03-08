# Assistant Phase Boards (Frontend + Backend)

Status: execution plan with strict scope boundaries.

Read this with:
- `docs/ai/ASSISTANT_EXECUTION_RULEBOOK.md`

## Global Gate

No phase may begin until the previous phase is 100% complete against its expected outcome and acceptance checklist.

---

## Phase 01: Runtime Foundation

### Backend Track
- Allowed folders:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/main/ipc/handlers.ts`
  - `src/preload/index.ts`
- Work:
  - Stabilize bridge lifecycle: connect, disconnect, init, stop.
  - Ensure JSON-RPC request/notification handling is deterministic.
  - Add runtime model listing (`model/list`) and cache policy.
  - Provide typed IPC endpoints for status/history/send/cancel/models.
- Forbidden:
  - Any git/terminal/project-details behavior changes.
  - Any unrelated IPC handler changes.

### Frontend Track
- Allowed folders:
  - `src/renderer/src/pages/Assistant.tsx`
  - `src/renderer/src/pages/settings/AssistantSettings.tsx`
  - `src/renderer/src/lib/settings.tsx`
- Work:
  - Connect/disconnect UX and status indicators.
  - Settings-to-runtime wiring for model + approval mode.
  - Load model options from runtime, not hardcoded lists.
- Forbidden:
  - Design overhauls of non-assistant pages.

### Expected Outcome
- Assistant connects reliably to `codex app-server`.
- Settings model dropdown shows real runtime models.
- Send/cancel lifecycle works with no crash.

### Phase Exit Checklist
1. `assistant:listModels` works end-to-end.
2. No out-of-scope file modifications.
3. Connect/send/cancel success in manual test.

---

## Phase 02: Chat Baseline UX

### Backend Track
- Allowed folders:
  - `src/main/assistant/**`
- Work:
  - Correct delta aggregation.
  - Correct final message locking on completion.
  - Robust turn completion/failed/interrupted handling.
- Forbidden:
  - Approval workflow logic (Phase 05).

### Frontend Track
- Allowed folders:
  - `src/renderer/src/pages/Assistant.tsx`
  - `src/renderer/src/pages/assistant/**`
- Work:
  - Display clean streaming state.
  - Remove flicker between stream and final.
  - Ensure busy UI states are correct and reversible.
- Forbidden:
  - Session/history sidebar redesign beyond baseline.

### Expected Outcome
- Streamed content is stable and transitions to a single final message.
- No duplicate final assistant messages.

### Phase Exit Checklist
1. 20 consecutive turns without flicker/duplication.
2. Cancel action always returns UI to ready state.

---

## Phase 03: Message Actions and Attempts

### Backend Track
- Allowed folders:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/preload/index.ts`
- Work:
  - Add regenerate turn support contract.
  - Add attempt-aware history payload shape.
- Forbidden:
  - Thought/activity event system (Phase 04).

### Frontend Track
- Allowed folders:
  - `src/renderer/src/pages/Assistant.tsx`
  - `src/renderer/src/pages/assistant/**`
- Work:
  - Copy action per assistant message.
  - Regenerate action.
  - Attempt prev/next navigation and indicator.
- Forbidden:
  - Event console work (Phase 06).

### Expected Outcome
- Each assistant message can have multiple attempts and user can switch them.

### Phase Exit Checklist
1. Regeneration preserves previous attempts.
2. Copy action outputs active attempt text only.

---

## Phase 04: Reasoning and Activity Stream

### Backend Track
- Allowed folders:
  - `src/main/assistant/**`
- Work:
  - Normalize reasoning and activity notifications.
  - Attach reasoning records to correct turn/attempt.
- Forbidden:
  - Approval decision logic changes.

### Frontend Track
- Allowed folders:
  - `src/renderer/src/pages/Assistant.tsx`
  - `src/renderer/src/pages/assistant/**`
- Work:
  - Collapsible thought blocks.
  - Typed activities: command/file/search/tool.
  - Reasoning dedupe/sanitization rendering.
- Forbidden:
  - Session storage expansion beyond attempt/thought data.

### Expected Outcome
- Thought stream is readable, collapsible, and correctly bound to response attempt.

### Phase Exit Checklist
1. No thought block attached to wrong message/attempt.
2. Long responses remain responsive and readable.

---

## Phase 05: Safety and Approvals

### Backend Track
- Allowed folders:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/preload/index.ts`
- Work:
  - SAFE vs YOLO enforcement.
  - Server approval request handling with policy routing.
  - Expose approval request events with full detail payload.
- Forbidden:
  - Account/rate-limit endpoints.

### Frontend Track
- Allowed folders:
  - `src/renderer/src/pages/Assistant.tsx`
  - `src/renderer/src/pages/assistant/**`
  - `src/renderer/src/pages/settings/AssistantSettings.tsx`
- Work:
  - Approval request UI surface and actions.
  - YOLO warning confirmation.
  - Session-level approval status display.
- Forbidden:
  - Events console filtering work.

### Expected Outcome
- Approval requests are visible and decisions apply immediately.

### Phase Exit Checklist
1. SAFE declines without accidental approval.
2. YOLO applies session-level approval when selected.

---

## Phase 06: Events Console

### Backend Track
- Allowed folders:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/preload/index.ts`
- Work:
  - Event payload normalization.
  - Event retention and export support.
- Forbidden:
  - Session persistence schema changes.

### Frontend Track
- Allowed folders:
  - `src/renderer/src/pages/assistant/**`
  - `src/renderer/src/pages/settings/AssistantSettings.tsx`
- Work:
  - Event viewer with filters and search.
  - Formatted/raw payload toggle.
  - Copy/export/reset actions.
- Forbidden:
  - Non-assistant settings UI changes.

### Expected Outcome
- Debugging assistant runtime from UI is practical and fast.

### Phase Exit Checklist
1. Filters and search return accurate subsets.
2. Exported JSON matches displayed events.

---

## Phase 07: Sessions and Thread Management

### Backend Track
- Allowed folders:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/preload/index.ts`
- Work:
  - Session create/list/rename/delete/archive contract.
  - Thread reset/new-thread contract.
- Forbidden:
  - Model capability tagging.

### Frontend Track
- Allowed folders:
  - `src/renderer/src/pages/Assistant.tsx`
  - `src/renderer/src/pages/assistant/**`
  - `src/renderer/src/lib/settings.tsx` (only if needed for persistence)
- Work:
  - Session list/sidebar behaviors.
  - New chat/new thread controls.
  - Session rename/delete/archive UX.
- Forbidden:
  - Composer slash command system.

### Expected Outcome
- Conversations are stateful and recoverable across app restarts.

### Phase Exit Checklist
1. Session history survives restart.
2. New thread resets runtime turn lineage correctly.

---

## Phase 08: Composer Power Features

### Backend Track
- Allowed folders:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/preload/index.ts`
- Work:
  - Add APIs for structured context insertion (selected files, diff snippets).
  - Add prompt token estimation endpoint if runtime supports it.
- Forbidden:
  - Export/import conversation formats (Phase 09).

### Frontend Track
- Allowed folders:
  - `src/renderer/src/pages/assistant/**`
  - `src/renderer/src/pages/ProjectDetails.tsx` (only for explicit context injection entry points)
- Work:
  - Slash commands.
  - Prompt templates/snippets.
  - Include selected files/diff actions.
  - Prompt validation hints.
- Forbidden:
  - Message-attempt logic rewrites.

### Expected Outcome
- Users can build structured prompts quickly without manual copy/paste.

### Phase Exit Checklist
1. Context insertion is deterministic and reversible.
2. Composer remains stable under repeated command usage.

---

## Phase 09: Output and Artifact Quality

### Backend Track
- Allowed folders:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/preload/index.ts`
- Work:
  - Conversation export contract (`markdown`, `json`).
  - Payload formatting for export stability.
- Forbidden:
  - Reliability/retry policy changes.

### Frontend Track
- Allowed folders:
  - `src/renderer/src/pages/assistant/**`
  - `src/renderer/src/components/ui/MarkdownRenderer.tsx` (assistant output only)
- Work:
  - Better assistant markdown rendering.
  - Export/download controls.
  - Structured tool output cards.
- Forbidden:
  - Global markdown behavior changes for unrelated tabs unless explicitly approved.

### Expected Outcome
- Assistant outputs are readable, copyable, and exportable.

### Phase Exit Checklist
1. Exported markdown/json matches on-screen conversation.
2. No regression in non-assistant markdown views.

---

## Phase 10: Model and Profile Intelligence

### Backend Track
- Allowed folders:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/preload/index.ts`
- Work:
  - Model metadata mapping (display name, capability tags if available).
  - Per-project default model contract.
  - Assistant profile preset contract.
- Forbidden:
  - Rate-limit/account features.

### Frontend Track
- Allowed folders:
  - `src/renderer/src/pages/settings/AssistantSettings.tsx`
  - `src/renderer/src/pages/assistant/**`
  - `src/renderer/src/lib/settings.tsx`
- Work:
  - Model search and filtering UI.
  - Preset profiles (`safe-dev`, `review`, `yolo-fast`).
  - Per-project overrides.
- Forbidden:
  - Session/history persistence redesign.

### Expected Outcome
- Model selection is fast and project-aware with sensible defaults.

### Phase Exit Checklist
1. Per-project model override applies correctly on new turns.
2. Preset switching updates runtime behavior immediately.

---

## Phase 11: Reliability Hardening

### Backend Track
- Allowed folders:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/preload/index.ts`
- Work:
  - Auto-reconnect strategy.
  - Timeout and retry policy for transient failures.
  - Missing-model fallback path.
  - Crash-safe bridge restart.
- Forbidden:
  - New user-facing feature additions.

### Frontend Track
- Allowed folders:
  - `src/renderer/src/pages/assistant/**`
  - `src/renderer/src/pages/Assistant.tsx`
- Work:
  - Recovery banners and actionable retry controls.
  - Preserve draft on failure/reconnect.
- Forbidden:
  - New major UI modules.

### Expected Outcome
- Assistant can recover from common runtime failures without full app restart.

### Phase Exit Checklist
1. Bridge crash test recovers and resumes usable state.
2. Draft text survives recoverable failures.

---

## Phase 12: Power Workflows and Launch Gate

### Backend Track
- Allowed folders:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/preload/index.ts`
  - `src/main/inspectors/git/**` (only for explicit assistant workflow APIs)
- Work:
  - One-click workflow endpoints (`explain diff`, `review staged`, `draft commit message`).
  - Final telemetry/logging integrity checks.
- Forbidden:
  - Broad git subsystem refactor.

### Frontend Track
- Allowed folders:
  - `src/renderer/src/pages/assistant/**`
  - `src/renderer/src/pages/ProjectDetails.tsx` (workflow trigger entry points only)
  - `src/renderer/src/pages/project-details/**` (only for assistant workflow action wiring)
- Work:
  - Workflow buttons and result presentation.
  - Final UX polish and launch-ready states.
- Forbidden:
  - Feature experiments not listed in roadmap.

### Expected Outcome
- Assistant delivers high-impact project workflows with launch-level stability.

### Phase Exit Checklist
1. End-to-end workflow actions succeed on real repos.
2. No regressions in existing DevScope pages.
3. Launch sign-off summary is documented.

---

## Cross-Phase Strict Boundary Rules

1. If a file path is not in the active phase allowlist, do not modify it.
2. If a requirement depends on a future phase, do not partially implement it now.
3. If backend contract is incomplete, do not build frontend controls for it.
4. If frontend UX is incomplete, do not claim phase completion.
5. If acceptance checklist is not fully green, do not begin next phase.

## Required Handoff Note Per Phase

At phase close, record:

1. Implemented paths.
2. Remaining risks.
3. Deferred items (explicitly moved to later phase).
4. Verification evidence (manual and/or automated).

