# Current Codebase Architecture

Last validated against code on April 22, 2026.

## Runtime Layers

1. Renderer (`src/renderer/src`)
   React UI, route composition, page state, and interaction flows.
2. Preload (`src/preload`)
   Narrow Electron bridge that exposes `window.devscope`.
3. Main-process IPC (`src/main/ipc`)
   Handler registration plus domain-specific request translation.
4. Main-process services (`src/main/*`)
   Assistant service, project discovery, persistent file indexing/search, Git integrations, update manager, and process coordination.
5. Shared contracts (`src/shared`)
   Cross-process contract types and assistant/event contract definitions.

## Active Route Surface

From `src/renderer/src/App.tsx`, the desktop app currently exposes:

- `/home`
- `/projects`
- `/projects/:projectPath`
- `/folder-browse/:folderPath`
- `/assistant`
- `/terminals`
- `/settings` and its subroutes
- `/explorer` when explorer is enabled in settings

Legacy helper routes still redirect into the live assistant/settings surface instead of serving separate deprecated pages. The older `/tasks` route now redirects into `/terminals`.

The renderer also includes a dedicated `/quick-open` preview route for file-association and shell file launches. That route bypasses the main app shell and renders inside its own frameless preview window with renderer-owned chrome instead of native Electron frame chrome.

Windows shell folder launches route into `/explorer/:folderPath` with a transient session-level allowance so explicit File Explorer context-menu opens still work even if the optional Explorer sidebar tab is currently disabled in settings.

## Main Process Domain Areas

`src/main/ipc/handlers.ts` registers handlers for:

- startup settings and AI provider utilities
- assistant sessions, assistant event streaming, explicit session hydration, and Playground lab flows
- session title generation, selected-session deletion fallback, and assistant message/thread lifecycle
- project discovery, indexed file search, and IDE launch flows
- project details and per-project process views
- file tree, file reads, and file writes
- external terminal launch plus preview-terminal and Python preview flows, including live preview-terminal title sync
- Windows shell launch routing for file previews and folder opens
- Git read/write operations
- desktop update state and install actions

## Assistant Architecture

The assistant is part of the active app, not a removed feature.

- Main service root: `src/main/assistant/*`
- Main-process IPC bridge: `src/main/ipc/handlers/assistant-handlers.ts`
- Shared contract: `src/shared/assistant/contracts/*`
- Renderer route entry: `src/renderer/src/pages/Assistant.tsx`

Current assistant capabilities include session lifecycle, model listing, connect/disconnect, prompt send, interrupt, approval responses, user-input responses, project-path association, Playground root and lab setup, explicit session hydration, session title generation, connection recovery, selected-session deletion fallback, attachment persistence, and event subscription.

Assistant timeline tool-call cards also support path-aware file navigation: edited-file rows and plain file-path lines in tool results can open directly into the shared file-preview renderer.

Assistant conversation status labels are phase-driven from the active thread state; generic pending UI actions should not be treated as thread connection state.

Playground chats can now exist without an attached lab. In that state the runtime still has a detached safety cwd, but the model is explicitly instructed to treat the chat as non-filesystem by default and to use guided user-input escalation when it truly needs a real lab/workspace before continuing.

When the selected assistant session is deleted, the runtime now routes through a replacement-input fallback so the rail stays on a live session instead of dropping selection.

## Shared Contract Model

Two contract groups matter most:

- `src/shared/contracts/devscope-api.ts`
  General desktop API surface for projects, files, Git, updates, terminals, and settings.
- `src/shared/assistant/contracts/*`
  Assistant IPC names, runtime/session types, and streamed read-model events.

The intended architecture direction remains contract-first: define shared contract shape first, then wire adapters and clients around it.

## Caching and Performance Shape

- Project discovery and deep file/folder indexing are centralized in main-process services with cache/dedupe behavior; the persistent file index now backs command-palette file search, folder-browse search, and project file-tree search instead of rebuilding large recursive search structures in the renderer.
- Renderer route state persists key navigation state in local storage and gates optional tabs through settings.
- File preview and project details flows use narrower read operations to avoid unnecessary full reloads; the fullscreen preview sidebar now caches per-directory listings and expands folders one level at a time instead of pulling full subtrees on every toggle, and the project file tree now opens shallow by default while indexed search supplies filtered deep results without forcing a full recursive tree load on each search.
- Update state is tracked in a dedicated main-process update subsystem instead of being ad hoc renderer state.
- Assistant streaming batches text deltas before projection and broadcast, coalesces renderer event application behind a short delta-flush window plus animation-frame delivery for non-delta events, batches main-to-renderer assistant event IPC, keeps hot persistence writes off the immediate UI interaction path, applies session and thread selection locally in the renderer before requesting uncached thread hydration as a background refresh, avoids deep-cloning hydrated thread history on every renderer store update, splits renderer subscriptions so the assistant page shell, conversation pane, and right-side panels do not all rerender on live timeline churn, relies on a sliding tail history window plus row virtualization and per-row deferred rendering to keep long conversations responsive while still allowing explicit older-history expansion, uses a Pretext-backed text measurement pipeline for assistant row-height estimation and user-message collapse decisions, virtualizes large markdown file previews by parsed block instead of mounting the entire document body at once, conditionally skips raw-HTML markdown parsing unless a message actually contains HTML-like tags, persists per-turn usage in a dedicated `assistant_turns` ledger that the thread-details panel fetches on demand instead of inflating the hot assistant snapshot, rehydrates the selected thread plus hot running and waiting threads on restore, and in the dev runtime resets incompatible assistant persistence versions instead of carrying stale schema forward.

## Current Boundary Rules

- Keep renderer focused on UI state and presentation.
- Keep preload narrow and explicit.
- Keep main-process handlers thin and push domain behavior into services/core modules.
- Keep shared contracts stable and reusable across future clients.

## Separate Package Boundary

`apps/landing/devscope-web` is a separate landing-site package. It is not part of the desktop runtime and should stay decoupled from Electron-only implementation details.
