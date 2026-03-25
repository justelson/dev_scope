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

## Main Process Domain Areas

`src/main/ipc/handlers.ts` registers handlers for:

- system metrics and readiness
- startup settings and AI provider utilities
- assistant sessions and assistant event streaming
- project discovery and IDE launch flows
- project details and running-process/session views
- file tree, file reads, and file writes
- external terminal launch plus preview-terminal and Python preview flows
- Git read/write operations
- desktop update state and install actions

## Assistant Architecture

The assistant is part of the active app, not a removed feature.

- Main service root: `src/main/assistant/*`
- Main-process IPC bridge: `src/main/ipc/handlers/assistant-handlers.ts`
- Shared contract: `src/shared/assistant/contracts/*`
- Renderer route entry: `src/renderer/src/pages/Assistant.tsx`

Current assistant capabilities include session lifecycle, model listing, connect/disconnect, prompt send, interrupt, approval responses, user-input responses, project-path association, and event subscription.

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
- File preview and project details flows use narrower read operations to avoid unnecessary full reloads.
- Update state is tracked in a dedicated main-process update subsystem instead of being ad hoc renderer state.
- Assistant streaming batches text deltas before projection/broadcast, coalesces renderer event application behind a short delta-flush window plus animation-frame delivery for non-delta events, batches main-to-renderer assistant event IPC, keeps hot persistence writes off the immediate UI interaction path, avoids deep-cloning hydrated thread history on every renderer store update, and relies on exact history paging plus row virtualization with an always-live tail to keep long conversations responsive.

## Current Boundary Rules

- Keep renderer focused on UI state and presentation.
- Keep preload narrow and explicit.
- Keep main-process handlers thin and push domain behavior into services/core modules.
- Keep shared contracts stable and reusable across future clients.

## Separate Package Boundary

`apps/landing/devscope-web` is a separate landing-site package. It is not part of the desktop runtime and should stay decoupled from Electron-only implementation details.
