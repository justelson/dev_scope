# Assistant Architecture and Rollout Plan (DevScope)

Status: planning-only. This document defines how implementation should proceed.

## Goal

Add a first-class coding assistant experience to DevScope with:

- Dedicated assistant page with chat + internal sidebar
- Persistent settings
- Explicit connect/start workflow
- Stable streaming behavior (no duplicate/final-text leaks)

## Non-Goals (Initial Version)

- No full in-app terminal replacement.
- No multi-agent orchestration.
- No plugin marketplace.
- No remote multi-user collaboration.

## Current DevScope Baseline

Existing integration points:

- App routing: `src/renderer/src/App.tsx`
- Main nav sidebar: `src/renderer/src/components/layout/Sidebar.tsx`
- Settings store: `src/renderer/src/lib/settings.tsx`
- Settings overview: `src/renderer/src/pages/Settings.tsx`
- AI settings (commit message): `src/renderer/src/pages/settings/AISettings.tsx`
- Preload bridge: `src/preload/index.ts`
- IPC registration: `src/main/ipc/handlers.ts`
- Existing AI logging: `src/main/ai/ai-debug-log.ts`

## Target Architecture

### Main Process

Add an assistant bridge service that owns lifecycle and transport:

- New module group (proposed):
  - `src/main/assistant/assistant-bridge.ts`
  - `src/main/assistant/assistant-session.ts`
  - `src/main/assistant/assistant-events.ts`
  - `src/main/assistant/assistant-types.ts`

Responsibilities:

- Spawn and manage assistant backend process (stdio bridge pattern).
- Handle connect/disconnect/start/stop requests.
- Normalize stream events into typed payloads for renderer.
- Enforce approval mode and safety guardrails.
- Expose status for UI ("offline", "connecting", "ready", "error").

### IPC Layer

Add IPC channels (proposed naming):

- `devscope:assistant:connect`
- `devscope:assistant:disconnect`
- `devscope:assistant:status`
- `devscope:assistant:send`
- `devscope:assistant:cancelTurn`
- `devscope:assistant:listModels`
- `devscope:assistant:setApprovalMode`
- `devscope:assistant:getApprovalMode`
- `devscope:assistant:getHistory`
- `devscope:assistant:clearHistory`
- `devscope:assistant:onEvent` (renderer subscription bridge)

Register in `src/main/ipc/handlers.ts` via a dedicated handler module to avoid regrowing the file.

### Preload API

Expose typed facade in `src/preload/index.ts`:

```ts
window.devscope.assistant.connect()
window.devscope.assistant.disconnect()
window.devscope.assistant.status()
window.devscope.assistant.send(prompt, options?)
window.devscope.assistant.cancelTurn()
window.devscope.assistant.listModels()
window.devscope.assistant.setApprovalMode(mode)
window.devscope.assistant.getApprovalMode()
window.devscope.assistant.getHistory()
window.devscope.assistant.clearHistory()
window.devscope.assistant.onEvent(callback)
```

### Renderer

Add assistant route + modular page structure:

- Route: `/assistant`
- Proposed files:
  - `src/renderer/src/pages/Assistant.tsx` (route wrapper)
  - `src/renderer/src/pages/assistant/AssistantPage.tsx`
  - `src/renderer/src/pages/assistant/AssistantSidebar.tsx`
  - `src/renderer/src/pages/assistant/AssistantTranscript.tsx`
  - `src/renderer/src/pages/assistant/AssistantComposer.tsx`
  - `src/renderer/src/pages/assistant/AssistantSettingsPanel.tsx`
  - `src/renderer/src/pages/assistant/AssistantEventsPanel.tsx`
  - `src/renderer/src/pages/assistant/useAssistantController.ts`
  - `src/renderer/src/pages/assistant/useAssistantHistory.ts`
  - `src/renderer/src/pages/assistant/useAssistantStream.ts`

### Settings Model Updates

Extend `Settings` in `src/renderer/src/lib/settings.tsx` with assistant-specific fields:

- `assistantEnabled: boolean`
- `assistantProvider: 'codex' | 'custom'` (start with one provider if needed)
- `assistantDefaultModel: string`
- `assistantApprovalMode: 'safe' | 'yolo'`
- `assistantSidebarCollapsed: boolean`
- `assistantSidebarWidth: number`
- `assistantShowThinking: boolean`
- `assistantAutoConnectOnOpen: boolean`

All fields should be persisted through existing settings storage.

## Event and Rendering Contracts

To avoid current common streaming issues, follow strict rules:

1. Provisional content must never overwrite final locked content after completion.
2. Final assistant content must lock only on completion events.
3. Legacy token-level deltas should not be treated as final answer source.
4. Thought/activity blocks must remain associated with the correct assistant attempt.
5. Clear turn-scoped buffers after finalization.

## Navigation and Discoverability

Add `Assistant` item to main sidebar in `src/renderer/src/components/layout/Sidebar.tsx`.

Design expectation:

- Same nav quality as Home/Projects/Settings.
- Persistent active-state highlighting.
- No path prefix collisions.

## Logging and Diagnostics

Integrate with existing logs surface:

- Keep request/response traces in `src/main/ai/ai-debug-log.ts` style.
- Add assistant-specific log entries for:
  - connect/disconnect
  - model list fetch
  - message request/response
  - completion/finalization
  - truncation/retry/fallback behavior

Expose in current logs settings page first, with optional future "Assistant logs" filter.

## Rollout Phases

### Phase 1: Skeleton and Routing

- Add `/assistant` route and placeholder UI.
- Add sidebar navigation item.
- Add settings schema fields (no backend wiring yet).

### Phase 2: Main-Process Bridge and IPC

- Add assistant bridge service.
- Add IPC handlers + preload facade.
- Return mock status/messages initially for integration testing.

### Phase 3: Real Streaming + Turn Lifecycle

- Wire actual assistant event stream.
- Implement provisional/final/thought contracts.
- Implement cancel/regenerate behavior.

### Phase 4: Settings + Start Flow

- Implement connect/start UX.
- Implement model + approval settings.
- Persist assistant layout and behavior preferences.

### Phase 5: Hardening and QA

- Stress test with long responses and partial/truncated streams.
- Verify retry/fallback logic.
- Verify no duplicate final responses.
- Verify persisted state across restarts.

## Acceptance Criteria

1. User can open `/assistant`, connect once, and send prompts without app reload.
2. Assistant sidebar collapse/width and theme state persist after restart.
3. No duplicate final answer rendering on streamed responses.
4. Settings page includes assistant controls and they change runtime behavior.
5. Errors are actionable and include provider/model context.
6. Existing Projects, ProjectDetails, Git, and settings pages remain unaffected.

## Open Decisions to Confirm Before Coding

1. Should initial assistant provider be hard-coded to one backend or provider-selectable?
2. Should yolo mode be available at launch or hidden behind an advanced toggle?
3. Should assistant history live in existing settings storage or separate key namespace?
4. Should the first release include an Events panel or keep it behind a debug toggle?

