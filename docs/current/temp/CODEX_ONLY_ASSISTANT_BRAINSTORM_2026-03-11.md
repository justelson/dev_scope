# Codex-Only Assistant Brainstorm Note

Date: March 11, 2026
Status: brainstorming only, not implementation
Purpose: preserve a self-contained plan for bringing a real Codex-backed assistant into DevScope Air without relying on this chat context

## Non-Negotiable Scope

This plan is specifically for a new assistant subsystem in DevScope Air with these hard constraints:

- use `codex app-server` as the only assistant runtime
- do not touch or refactor the existing Groq or Gemini architecture
- do not widen the scope into a general multi-provider assistant system
- do not assume the archived assistant bridge should be revived as-is
- do not assume the current commit-message / PR-draft AI flow should be removed immediately

The current Groq/Gemini code remains in place for the existing narrow AI features.
This effort is additive and isolated.

## Short Conclusion

If we want `t3code`-level assistant behavior in DevScope Air with the least complexity, the right move is:

1. copy the Codex-first architectural shape from `t3code`
2. adapt it to Electron main/preload/renderer boundaries
3. keep the assistant runtime Codex-only
4. keep existing Groq/Gemini code untouched

The important thing to copy is not the exact app shell.
It is the flow:

`codex app-server -> normalized runtime events -> orchestration events -> projected read model -> renderer selectors`

## What Exists Today

Current DevScope Air facts that matter:

- the live app has no active assistant route right now
- `/assistant` is redirected away in the renderer
- the current AI surface is limited to:
  - provider connection tests
  - commit message generation
  - PR draft generation
  - AI debug logs
- those features are currently request/response only
- they are not a sessioned streaming assistant

Relevant files:

- [src/renderer/src/App.tsx](/C:/Users/elson/my_coding_play/devscope/src/renderer/src/App.tsx)
- [src/main/ipc/handlers/settings-ai-handlers.ts](/C:/Users/elson/my_coding_play/devscope/src/main/ipc/handlers/settings-ai-handlers.ts)
- [src/renderer/src/lib/settings.tsx](/C:/Users/elson/my_coding_play/devscope/src/renderer/src/lib/settings.tsx)
- [src/main/ai/groq.ts](/C:/Users/elson/my_coding_play/devscope/src/main/ai/groq.ts)
- [src/main/ai/gemini.ts](/C:/Users/elson/my_coding_play/devscope/src/main/ai/gemini.ts)

## What To Copy From T3code

The `t3code` pieces worth copying are the assistant engine patterns, not the whole product shell.

Primary references:

- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/AGENTS.md](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/AGENTS.md)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/.docs/architecture.md](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/.docs/architecture.md)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/packages/contracts/src/providerRuntime.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/packages/contracts/src/providerRuntime.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/packages/contracts/src/orchestration.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/packages/contracts/src/orchestration.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/codexAppServerManager.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/codexAppServerManager.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/provider/Layers/ProviderService.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/provider/Layers/ProviderService.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/orchestration/Layers/ProviderCommandReactor.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/orchestration/Layers/ProviderCommandReactor.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/orchestration/Layers/ProjectionSnapshotQuery.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/orchestration/Layers/ProjectionSnapshotQuery.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/web/src/store.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/web/src/store.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/web/src/session-logic.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/web/src/session-logic.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/web/src/wsTransport.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/web/src/wsTransport.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/web/src/wsNativeApi.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/web/src/wsNativeApi.ts)

## Architecture To Build In DevScope

Keep DevScope’s normal boundaries:

- `src/main`
  - assistant runtime host
  - persistence
  - orchestration
  - IPC registration
- `src/preload`
  - narrow assistant bridge only
- `src/renderer/src`
  - assistant page, dock, selectors, and render logic
- `src/shared`
  - assistant contracts and shared types

Recommended new areas:

- `src/shared/assistant/contracts/*`
- `src/main/assistant/*`
- `src/preload/adapters/assistant-adapter.ts`
- `src/renderer/src/pages/assistant/*`
- `src/renderer/src/lib/assistant/*`

## Required Runtime Model

The assistant should be Codex-only and still keep the important `t3code` layers:

1. Codex process manager
2. normalized runtime event model
3. orchestration command/event model
4. projection/read-model persistence
5. snapshot query service
6. renderer store and selectors

The renderer must not render raw Codex events directly.

## Mandatory Capabilities For V1

The first real assistant version should support:

- connect/disconnect assistant runtime
- create/select/archive/delete sessions
- create/reset thread inside a session
- send prompt to Codex
- stream one stable assistant message row
- interrupt active turn
- surface approval requests
- submit approval decisions
- surface user-input questions
- submit user-input answers
- render work/activity feed separately from assistant text
- render proposed plan output separately from plain assistant text
- restore thread/session state after renderer reload
- restore persisted assistant truth after app restart

## Explicit Non-Goals For V1

- no Groq-backed assistant runtime
- no Gemini-backed assistant runtime
- no provider picker for assistant
- no generalized provider abstraction for future models
- no migration of commit-message or PR-draft flows into assistant yet
- no removal of existing AI settings page behavior for Groq/Gemini
- no attempt to preserve the archived assistant runtime internals

## Suggested DevScope Implementation Phases

### Phase 1: Shared contracts

Create the minimum assistant contract layer in `src/shared`.

Include:

- runtime event types
- orchestration event types
- read-model types
- approval types
- pending user-input types
- assistant IPC payload types
- snapshot payload types

This phase should be Codex-specific where useful.
Avoid premature generalization.

### Phase 2: Main-process Codex runtime host

Build a DevScope equivalent of `t3code`’s Codex session manager.

Responsibilities:

- spawn `codex app-server`
- send JSON-RPC requests
- receive notifications / responses
- session lifecycle
- thread open/resume
- turn start / interrupt
- approval response
- user-input response
- model selection
- account / auth state reads if needed

### Phase 3: Runtime ingestion and orchestration

Build a layer that:

- classifies raw Codex events
- turns them into normalized runtime events
- turns normalized runtime events into orchestration domain events

Important separation rules:

- assistant text is not tool output
- reasoning/work output is not assistant text
- approval state is not inferred from renderer heuristics
- plan state is not stored as loose markdown in the renderer

### Phase 4: Persistence and projection

Persist the assistant truth in Electron main.

Recommended approach:

- SQLite-backed assistant persistence

Persist at least:

- sessions
- threads
- messages
- activities
- proposed plans
- session state
- latest turn state

Then implement:

- projection updates
- snapshot assembly
- replay/application of domain events

### Phase 5: IPC and preload bridge

Replace `t3code` WebSocket with Electron-native transport.

Use:

- `ipcMain.handle(...)` for commands
- event channels for domain-event pushes / snapshots / status updates
- preload adapter exposing `window.devscope.assistant.*`

The archived IPC contract is a naming reference only:

- [archive/codex-assistant/src/shared/contracts/assistant-ipc.ts](/C:/Users/elson/my_coding_play/devscope/archive/codex-assistant/src/shared/contracts/assistant-ipc.ts)

### Phase 6: Renderer assistant store and selectors

Build renderer assistant state from:

- initial snapshot
- domain-event pushes

Selectors should derive:

- pending approvals
- pending user-input
- active work log
- active plan state
- timeline rows
- session phase
- latest turn state

Key references:

- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/web/src/store.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/web/src/store.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/web/src/session-logic.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/web/src/session-logic.ts)

### Phase 7: Assistant UI

Reintroduce the assistant UI in DevScope Air.

Recommended surfaces:

- `/assistant` route
- assistant page
- sessions sidebar
- timeline
- composer
- approval UI
- pending user-input UI
- optional dock mode if needed later

Archived UI files can be used for layout and interaction ideas only:

- [archive/codex-assistant/src/renderer/src/pages/assistant/AssistantPageContent.tsx](/C:/Users/elson/my_coding_play/devscope/archive/codex-assistant/src/renderer/src/pages/assistant/AssistantPageContent.tsx)
- [archive/codex-assistant/src/renderer/src/pages/assistant/AssistantTimeline.tsx](/C:/Users/elson/my_coding_play/devscope/archive/codex-assistant/src/renderer/src/pages/assistant/AssistantTimeline.tsx)
- [archive/codex-assistant/src/renderer/src/pages/assistant/AssistantComposer.tsx](/C:/Users/elson/my_coding_play/devscope/archive/codex-assistant/src/renderer/src/pages/assistant/AssistantComposer.tsx)
- [archive/codex-assistant/src/renderer/src/pages/assistant/AssistantSessionsSidebar.tsx](/C:/Users/elson/my_coding_play/devscope/archive/codex-assistant/src/renderer/src/pages/assistant/AssistantSessionsSidebar.tsx)

Do not copy their old live-state assumptions.

## Isolation Rules

To keep this effort scoped and safe:

- do not edit existing Groq files
- do not edit existing Gemini files
- do not change current commit-message generation flow
- do not change current PR-draft generation flow
- do not change current AI settings behavior except to add separate assistant settings later
- do not reuse the existing disabled agent-scope stubs as the source of truth

Relevant “leave alone for now” files:

- [src/main/ai/groq.ts](/C:/Users/elson/my_coding_play/devscope/src/main/ai/groq.ts)
- [src/main/ai/gemini.ts](/C:/Users/elson/my_coding_play/devscope/src/main/ai/gemini.ts)
- [src/main/ai/pull-request.ts](/C:/Users/elson/my_coding_play/devscope/src/main/ai/pull-request.ts)
- [src/main/ipc/handlers/settings-ai-handlers.ts](/C:/Users/elson/my_coding_play/devscope/src/main/ipc/handlers/settings-ai-handlers.ts)
- [src/renderer/src/pages/settings/AISettings.tsx](/C:/Users/elson/my_coding_play/devscope/src/renderer/src/pages/settings/AISettings.tsx)

## Fresh-Chat Mandatory Reference Checklist

If a new chat starts with empty context, these files must be opened before implementation decisions are made.

### DevScope current app

- [AGENTS.md](/C:/Users/elson/my_coding_play/devscope/AGENTS.md)
- [docs/current/README.md](/C:/Users/elson/my_coding_play/devscope/docs/current/README.md)
- [docs/current/CURRENT_CODEBASE_ARCHITECTURE.md](/C:/Users/elson/my_coding_play/devscope/docs/current/CURRENT_CODEBASE_ARCHITECTURE.md)
- [src/main/index.ts](/C:/Users/elson/my_coding_play/devscope/src/main/index.ts)
- [src/main/ipc/handlers.ts](/C:/Users/elson/my_coding_play/devscope/src/main/ipc/handlers.ts)
- [src/preload/index.ts](/C:/Users/elson/my_coding_play/devscope/src/preload/index.ts)
- [src/preload/devscope-electron-adapter.ts](/C:/Users/elson/my_coding_play/devscope/src/preload/devscope-electron-adapter.ts)
- [src/shared/contracts/devscope-api.ts](/C:/Users/elson/my_coding_play/devscope/src/shared/contracts/devscope-api.ts)
- [src/renderer/src/App.tsx](/C:/Users/elson/my_coding_play/devscope/src/renderer/src/App.tsx)
- [archive/codex-assistant/docs/current/T3CODE_ASSISTANT_INFRA_FORK_PLAN.md](/C:/Users/elson/my_coding_play/devscope/archive/codex-assistant/docs/current/T3CODE_ASSISTANT_INFRA_FORK_PLAN.md)

### T3code assistant engine references

- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/AGENTS.md](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/AGENTS.md)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/.docs/architecture.md](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/.docs/architecture.md)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/packages/contracts/src/providerRuntime.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/packages/contracts/src/providerRuntime.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/packages/contracts/src/orchestration.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/packages/contracts/src/orchestration.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/codexAppServerManager.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/codexAppServerManager.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/provider/Layers/ProviderService.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/provider/Layers/ProviderService.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/orchestration/Layers/ProviderCommandReactor.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/orchestration/Layers/ProviderCommandReactor.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/orchestration/Layers/ProjectionSnapshotQuery.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/server/src/orchestration/Layers/ProjectionSnapshotQuery.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/web/src/store.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/web/src/store.ts)
- [C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/web/src/session-logic.ts](/C:/Users/elson/my_coding_play/opensource.codeinspirations/t3code/apps/web/src/session-logic.ts)

## Fresh-Chat Starter Prompt

Use this exact baseline in a new chat if needed:

> Read `AGENTS.md` in this repo first. Then read `docs/current/README.md`, `docs/current/CURRENT_CODEBASE_ARCHITECTURE.md`, and `docs/current/temp/CODEX_ONLY_ASSISTANT_BRAINSTORM_2026-03-11.md`. This task is only for a new Codex-only assistant subsystem in DevScope Air. Do not touch or refactor the existing Groq/Gemini AI architecture. Before planning or coding, also inspect the listed `t3code` assistant-engine references in that brainstorm note. Treat `codex app-server` as the only assistant runtime and keep the design additive and isolated from current commit/PR AI flows.

## Recommendation For The Next Real Spec

The next planning document should be an implementation spec, not another brainstorm note.

It should define:

- exact folder/file layout to add
- IPC contract names
- SQLite table set
- event types to support in v1
- snapshot structure
- renderer store shape
- phased rollout order
- what archived files can be reused visually only
- what must not be copied from the old assistant bridge

