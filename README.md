# DevScope Air

DevScope Air is the primary Windows desktop app in this repository. It combines project discovery, project details, Git workflows, assistant sessions, file preview tooling, system/task visibility, and desktop update flows in a single Electron app.

The repository root is the desktop release target. [`apps/landing/devscope-web`](C:\Users\elson\my_coding_play\devscope\apps\landing\devscope-web\README.md) is the separate landing site, not the desktop runtime.

## Current Product Surface

- Projects: scan local roots, browse folders, inspect project details, and jump into installed IDEs.
- Files: read file trees, preview text/media/image content, and support targeted preview-terminal and Python preview workflows.
- Git: status, history, sync state, branches, remotes, tags, stashes, staging, commit, push/pull, and repo setup flows.
- Assistant: session-based assistant UI with model listing, approvals, user-input responses, project association, and event streaming.
- Desktop ops: system overview, readiness/tooling data, task views, app settings, and release updater flows.

## Repo Layout

- [`src/main`](C:\Users\elson\my_coding_play\devscope\src\main): Electron main process, IPC handlers, assistant service, project/git integrations, update orchestration.
- [`src/preload`](C:\Users\elson\my_coding_play\devscope\src\preload): narrow renderer bridge adapters exposed through `window.devscope`.
- [`src/renderer/src`](C:\Users\elson\my_coding_play\devscope\src\renderer\src): React app shell, pages, layouts, and in-app UI.
- [`src/shared`](C:\Users\elson\my_coding_play\devscope\src\shared): cross-process contracts and reusable shared logic.
- [`docs`](C:\Users\elson\my_coding_play\devscope\docs\README.md): current documentation, platform planning docs, and archived legacy summary.
- [`archive`](C:\Users\elson\my_coding_play\devscope\archive): old code retained for reference, not current runtime.

## Development

Prerequisites:

- Node.js 18+
- npm 9+
- Windows 10/11 as the primary runtime target

Desktop app commands:

```bash
npm install
npm run dev
npm run typecheck
```

Additional packaging commands:

```bash
npm run build
npm run build:win
npm run build:unpack
npm run dist:organize
```

Release outputs are organized under:

- `dist/releases/v<package-version>/`
- `dist/unpacked/v<package-version>/`

## Documentation

Start with:

- [`docs/README.md`](C:\Users\elson\my_coding_play\devscope\docs\README.md)
- [`docs/current/README.md`](C:\Users\elson\my_coding_play\devscope\docs\current\README.md)
- [`docs/current/CURRENT_CODEBASE_ARCHITECTURE.md`](C:\Users\elson\my_coding_play\devscope\docs\current\CURRENT_CODEBASE_ARCHITECTURE.md)
- [`docs/current/CURRENT_CAPABILITIES_MATRIX.md`](C:\Users\elson\my_coding_play\devscope\docs\current\CURRENT_CAPABILITIES_MATRIX.md)

Platform-planning docs for CLI, IDE extension, and alternate clients live in [`docs/platform`](C:\Users\elson\my_coding_play\devscope\docs\platform\README.md).

## Notes

- The in-repo assistant is active in the current desktop app and should be documented as part of the live surface.
- Historical docs are archived into a zip and summary under `docs/archive/` and are no longer source-of-truth.
- Legacy implementations may still exist under `archive/`, but active work targets the desktop app at repository root.
