# Current Codebase Architecture

Last validated against code on April 29, 2026.

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
- installed package runtime detection for Node.js, npm, pnpm, Yarn, and Bun
- assistant sessions, assistant event streaming, explicit session hydration, and Playground lab flows
- session title generation, selected-session deletion fallback, assistant message/thread lifecycle, no-lab terminal-access request routing, and streaming tool-output activity merges
- project discovery, indexed file search, and IDE launch flows
- project details and per-project process views
- file tree, file reads, and file writes
- repository clone into the current folder browser location with progress events
- external terminal launch plus preview-terminal and Python preview flows, including live preview-terminal title sync
- Windows shell launch routing for file previews and folder opens
- Git read/write operations, status entry stats, sync status, current-branch PR lookup, and commit/push/create-or-open PR orchestration
- desktop update state, resilient updater loading, update success notification state, install actions, and GitHub Releases feed resolution

## Assistant Architecture

The assistant is part of the active app, not a removed feature.

- Main service root: `src/main/assistant/*`
- Main-process IPC bridge: `src/main/ipc/handlers/assistant-handlers.ts`
- Shared contract: `src/shared/assistant/contracts/*`
- Renderer route entry: `src/renderer/src/pages/Assistant.tsx`

Current assistant capabilities include session lifecycle, model listing, account/pricing metadata, connect/disconnect, prompt send, interrupt, approval responses, user-input responses, project-path association, Playground root and lab setup, explicit session hydration, session title generation, connection recovery, selected-session deletion fallback, attachment persistence, clipboard attachment resolution, event subscription, no-lab terminal-access request/response routing, and streaming command/file-change activity updates.

Assistant timeline tool-call cards also support path-aware file navigation: edited-file rows and plain file-path lines in tool results can open directly into the shared file-preview renderer. Warning/error activities are retained in the assistant logs surface instead of being duplicated as chat timeline rows, warning-only assistant status messages are filtered from the visible conversation, and live command/file-change output now stays attached to the active tool card while the main process merges repeated activity updates by stable activity ID.

The current event bridge recognizes raw response item completions, MCP tool progress, dynamic/function/search tool calls, fuzzy file-search session updates, turn-diff updates, and command/file-change output deltas. Activity identity should come from provider item IDs whenever possible so renderer tool cards can update in place instead of producing duplicate rows.

The renderer also keeps the assistant thread-details panel and connected-session rails in sync with selected-session deletion fallback, cached hydration, and the current runtime state for long-lived conversations.

Clipboard-origin assistant attachments serialize safe `clipboard://` references into prompts instead of leaking the app's local attachment-storage paths. The main process resolves those references back to local files only for renderer preview/open flows, and prompt serialization explicitly marks clipboard attachments as context files, not as the active project root or cwd.

Assistant conversation status labels are phase-driven from the active thread state; generic pending UI actions should not be treated as thread connection state. The recovery banner is reserved for repeated reconnect attempts or exhausted reconnects, not the normal first connecting pass.

Playground chats can now exist without an attached lab. In that state the runtime still has a detached safety cwd, but the model is explicitly instructed to treat the chat as non-filesystem by default. The current chat header has a per-session terminal-access toggle for chat-only Playground sessions, and assistant defaults provide the initial no-lab terminal-access preference for sessions without an override. The per-session preference is persisted in renderer local storage. When terminal access is enabled, no-lab prompts run from a neutral home-directory cwd and do not route through automatic lab setup. When terminal access is disabled, terminal-shaped prompts route through a tool-enabled setup turn where Codex can request terminal access; DevScope renders that request as a dedicated terminal-access modal with a "don't ask again" option and reruns the original prompt without duplicating the user message after the user answers. Prompts that need local files, folders, repos, or workspace access are otherwise routed through a tool-enabled setup turn so Codex can request lab setup with a reason and suggested lab title; after approval DevScope attaches the lab and reruns the original prompt in normal execution mode, while a decline reruns the prompt as normal no-filesystem chat without retrying the same lab request. If an existing no-lab runtime session was connected under a different cwd, the service disconnects and reconnects it before rerunning with the correct terminal-access mode.

When the selected assistant session is deleted, the runtime now routes through a replacement-input fallback so the rail stays on a live session instead of dropping selection.

## Shared Contract Model

Two contract groups matter most:

- `src/shared/contracts/devscope-api.ts`
  General desktop API surface for projects, files, Git, updates, terminals, and settings.
- `src/shared/assistant/contracts/*`
  Assistant IPC names, runtime/session types, and streamed read-model events.

The intended architecture direction remains contract-first: define shared contract shape first, then wire adapters and clients around it.

## Caching and Performance Shape

- Project discovery, Git clone orchestration, and deep file/folder indexing are centralized in main-process services with cache/dedupe behavior; the persistent file index now backs command-palette file search, folder-browse search, and project file-tree search instead of rebuilding large recursive search structures in the renderer.
- Package runtime detection is main-process owned through IPC, while renderer settings choose either auto lockfile detection or an installed explicit runtime for project script buttons. The behavior settings UI displays the installed Node.js, npm, pnpm, Yarn, and Bun state with official runtime icons and refreshable detection.
- Renderer route state persists key navigation state in local storage and gates optional tabs through settings.
- File preview and project details flows use narrower read operations to avoid unnecessary full reloads; the fullscreen preview sidebar now caches per-directory listings and expands folders one level at a time instead of pulling full subtrees on every toggle, line references can focus the preview editor, sibling media files can be browsed in-place, and the project file tree now opens shallow by default while indexed search supplies filtered deep results without forcing a full recursive tree load on each search.
- Git status stats are loaded through chunked, cancellable renderer requests so large working trees can show staged/unstaged addition and deletion counts without blocking the project details surface.
- Update state is tracked in a dedicated main-process update subsystem instead of being ad hoc renderer state. The updater loader accepts either the named `autoUpdater` export or a default-exported module shape, and renderer update context tracks skipped versions plus per-version install-success toast dismissal in local storage.
- Assistant streaming batches text deltas before projection and broadcast, coalesces renderer event application behind a short delta-flush window plus animation-frame delivery for non-delta events, collapses repeated activity updates by stable activity ID, batches main-to-renderer assistant event IPC, merges command/file-change output deltas into stable tool activities, keeps hot persistence writes off the immediate UI interaction path, applies session and thread selection locally in the renderer before requesting uncached thread hydration as a background refresh, preserves hydrated renderer thread bodies when focused snapshots summarize inactive chats for warm switching, avoids deep-cloning hydrated thread history on every renderer store update, splits renderer subscriptions so the assistant page shell, conversation pane, and right-side panels do not all rerender on live timeline churn, relies on a sliding tail history window plus bounded source-window entry construction and per-row deferred rendering to keep long conversations responsive while still allowing explicit older-history expansion, uses a Pretext-backed text measurement pipeline for assistant row-height estimation and user-message collapse decisions, virtualizes large markdown file previews by parsed block instead of mounting the entire document body at once, conditionally skips raw-HTML markdown parsing unless a message actually contains HTML-like tags, persists per-turn usage in a dedicated `assistant_turns` ledger that the thread-details panel fetches on demand instead of inflating the hot assistant snapshot, rehydrates the selected thread plus hot running and waiting threads on restore, suppresses setup-turn assistant text when a guided Playground answer reruns the original prompt, and in the dev runtime resets incompatible assistant persistence versions instead of carrying stale schema forward.

The current assistant event path also now recognizes turn-diff updates, live command/file-change output deltas, fuzzy file-search result activity, and stable item IDs for long-running tool cards so the renderer can keep those streams pinned to the correct history row.

## Current Boundary Rules

- Keep renderer focused on UI state and presentation.
- Keep preload narrow and explicit.
- Keep main-process handlers thin and push domain behavior into services/core modules.
- Keep shared contracts stable and reusable across future clients.

## Separate Package Boundary

`apps/landing/devscope-web` is a separate landing-site package. It is not part of the desktop runtime and should stay decoupled from Electron-only implementation details.
