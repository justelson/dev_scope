# Current Codebase Architecture

Last validated against code on March 18, 2026.

## Runtime Layers

1. Renderer (`src/renderer/src`)
   React UI, route composition, page state, and interaction flows.
2. Preload (`src/preload`)
   Narrow Electron bridge that exposes `window.devscope`.
3. Main-process IPC (`src/main/ipc`)
   Handler registration plus domain-specific request translation.
4. Main-process services (`src/main/*`)
   Assistant service, project discovery, Git integrations, update manager, and system/task inspection.
5. Shared contracts (`src/shared`)
   Cross-process contract types and assistant/event contract definitions.

## Active Route Surface

From `src/renderer/src/App.tsx`, the desktop app currently exposes:

- `/home`
- `/projects`
- `/projects/:projectPath`
- `/folder-browse/:folderPath`
- `/assistant`
- `/settings` and its subroutes
- `/tasks` when task view is enabled in settings
- `/explorer` when explorer is enabled in settings

Legacy helper routes still redirect into the live assistant/settings surface instead of serving separate deprecated pages.

The renderer also includes a dedicated `/quick-open` preview route for file-association and shell file launches. That route bypasses the main app shell and now renders inside its own frameless preview window with renderer-owned chrome instead of native Electron frame chrome.

Windows shell folder launches route into `/explorer/:folderPath` with a transient session-level allowance so explicit File Explorer context-menu opens still work even if the optional Explorer sidebar tab is currently disabled in settings.

## Main Process Domain Areas

`src/main/ipc/handlers.ts` registers handlers for:

- system metrics and readiness
- startup settings and AI provider utilities
- assistant sessions and assistant event streaming
- project discovery and IDE launch flows
- project details and running-process/session views
- file tree, file reads, and file writes
- external terminal launch plus preview-terminal and Python preview flows
- Windows shell launch routing for file previews and folder opens
- Git read/write operations
- desktop update state and install actions

## Assistant Architecture

The assistant is part of the active app, not a removed feature.

- Main service root: `src/main/assistant/*`
- Main-process IPC bridge: `src/main/ipc/handlers/assistant-handlers.ts`
- Shared contract: `src/shared/assistant/contracts/*`
- Renderer route entry: `src/renderer/src/pages/Assistant.tsx`

Current assistant capabilities include session lifecycle, model listing, connect/disconnect, prompt send, interrupt, approval responses, user-input responses, project-path association, and event subscription.

Assistant timeline tool-call cards also support path-aware file navigation: edited-file rows and plain file-path lines in tool results can open directly into the shared file-preview renderer.

Assistant conversation status labels are phase-driven from the active thread state; generic pending UI actions should not be treated as thread connection state.

## Shared Contract Model

Two contract groups matter most:

- `src/shared/contracts/devscope-api.ts`
  General desktop API surface for projects, files, Git, updates, system, and settings.
- `src/shared/assistant/contracts/*`
  Assistant IPC names, runtime/session types, and streamed read-model events.

The intended architecture direction remains contract-first: define shared contract shape first, then wire adapters and clients around it.

## Caching and Performance Shape

- Project discovery and indexing are centralized in main-process services with cache/dedupe behavior.
- Renderer route state persists key navigation state in local storage and gates optional tabs through settings.
- File preview and project details flows use narrower read operations to avoid unnecessary full reloads; the fullscreen preview sidebar now caches per-directory listings and expands folders one level at a time instead of pulling full subtrees on every toggle.
- Update state is tracked in a dedicated main-process update subsystem instead of being ad hoc renderer state.
- Assistant streaming batches text deltas before projection/broadcast, coalesces renderer event application behind a short delta-flush window plus animation-frame delivery for non-delta events, batches main-to-renderer assistant event IPC, keeps hot persistence writes off the immediate UI interaction path, avoids deep-cloning hydrated thread history on every renderer store update, splits renderer subscriptions so the assistant page shell, conversation pane, and right-side panels do not all rerender on live timeline churn, relies on a sliding tail history window plus row virtualization/per-row deferred rendering to keep long conversations responsive while still allowing explicit older-history expansion, now uses a Pretext-backed text measurement pipeline for assistant row-height estimation and user-message collapse decisions, virtualizes large markdown file previews by parsed block instead of mounting the entire document body at once, conditionally skips raw-HTML markdown parsing unless a message actually contains HTML-like tags, persists per-turn usage in a dedicated `assistant_turns` ledger that the thread-details panel fetches on demand instead of inflating the hot assistant snapshot, rehydrates the selected thread plus hot running/waiting threads on restore, and in the dev runtime resets incompatible assistant persistence versions instead of carrying stale schema forward.

## Current Boundary Rules

- Keep renderer focused on UI state and presentation.
- Keep preload narrow and explicit.
- Keep main-process handlers thin and push domain behavior into services/core modules.
- Keep shared contracts stable and reusable across future clients.

## Separate Package Boundary

`apps/landing/devscope-web` is a separate landing-site package. It is not part of the desktop runtime and should stay decoupled from Electron-only implementation details.
