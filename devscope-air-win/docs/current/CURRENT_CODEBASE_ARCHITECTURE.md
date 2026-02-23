# Current Codebase Architecture

Last validated against code on February 23, 2026.

## Runtime Layers

1. Renderer (React)
   - Main routes and pages in `src/renderer/src/App.tsx`.
   - UI consumes `window.devscope` API.
2. Preload Adapter Layer
   - `src/preload/index.ts` exposes `window.devscope`.
   - `src/preload/devscope-electron-adapter.ts` composes adapter modules.
3. Main Process IPC Layer
   - Handler registry in `src/main/ipc/handlers.ts`.
   - Domain-specific handlers in `src/main/ipc/handlers/*`.
4. Core + Services
   - Core facade in `src/main/core/devscope-core.ts`.
   - Project discovery/indexing service in `src/main/services/project-discovery-service.ts`.
5. Shared Contracts
   - Type surface in `src/shared/contracts/devscope-api.ts`.
   - Assistant channel constants in `src/shared/contracts/assistant-ipc.ts`.

## Renderer Route Surface

From `src/renderer/src/App.tsx`:

- `/assistant` (default root redirect target)
- `/home`
- `/projects`
- `/projects/:projectPath`
- `/folder-browse/:folderPath`
- `/settings` + subroutes for appearance/behavior/data/about/projects/ai/terminal/logs/assistant/account/usage

## API Exposure Model

- Renderer receives one API object: `window.devscope`.
- API type is `DevScopeApi` from `src/shared/contracts/devscope-api.ts`.
- Preload builds this object from composed adapters:
  - system
  - settings/AI utilities
  - projects/git/file operations
  - assistant operations
  - window controls
  - disabled stubs for unsupported Air capabilities

## IPC Composition

`src/main/ipc/handlers.ts` registers:

- System + metrics handlers
- Settings + AI utility handlers
- Assistant handlers via shared assistant IPC constants
- Project discovery/file/project-details handlers
- Git read and write handlers
- Terminal-open handler
- Window control listeners/handlers

## Core Separation State (Current)

Current positive state:

- Project scanning and folder indexing already route through `devscopeCore.projects`.
- Assistant lifecycle/actions route through `devscopeCore.assistant`.

Current gap:

- Some business logic still lives directly in IPC handler modules.
- Further cleanup should continue moving domain logic into `src/main/core` and `src/main/services`.

## Settings Persistence Model

- Renderer settings store in `src/renderer/src/lib/settings.tsx`.
- Persisted in localStorage key: `devscope-settings`.
- Includes appearance, behavior, projects, AI provider keys, and assistant settings.

## Caching / Performance Notes (Current)

- Project scanning has in-memory TTL cache and in-flight deduping in `src/main/services/project-discovery-service.ts`.
- Renderer performs startup background indexing when enabled (`autoIndexOnStartup`) in `src/renderer/src/App.tsx`.
- Search index cache is shared in renderer search logic (projects page) and reused across navigations.

## Architecture Direction

Preferred direction for multi-client growth:

1. Contract-first changes in `src/shared/contracts`.
2. Domain behavior in core/services.
3. Thin transport adapters (Electron preload/IPC, future CLI, IDE).
4. Client UI/UX remains separate from domain logic.
