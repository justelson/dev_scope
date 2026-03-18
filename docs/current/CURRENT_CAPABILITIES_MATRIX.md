# Current Capabilities Matrix

Last validated against code on March 18, 2026.

## Status Legend

- `Implemented`: active in the current desktop app.
- `Implemented (setting-gated)`: present, but only visible when enabled in settings.
- `Planning-only`: documented direction, not a first-class implementation in this repo yet.
- `Archived`: retained for reference only, not part of the live runtime.

## Desktop Shell and System

- Window controls: `Implemented`
- System overview and detailed system stats: `Implemented`
- Readiness and developer-tooling detection: `Implemented`
- Shared metrics bootstrap, subscribe, and read flows: `Implemented`
- Active task listing: `Implemented`

## Projects and File Workflows

- Folder selection and root scanning: `Implemented`
- Project indexing across multiple roots: `Implemented`
- Project details read model: `Implemented`
- Installed IDE listing and open-in-IDE flows: `Implemented`
- File tree reads and path info: `Implemented`
- File preview reads across text/media/image content: `Implemented`
- File writes, rename, move, paste, and delete flows: `Implemented`
- Preview terminal sessions: `Implemented`
- Python preview runs: `Implemented`

## Git Workflows

- Read flows for status, history, sync, remotes, tags, stashes, repo owner, publish context, and working diff: `Implemented`
- Write flows for stage, unstage, discard, branch/tag actions, stash actions, fetch, pull, push, and repo init/setup: `Implemented`
- AI-generated commit message flow: `Implemented`
- AI-generated pull request draft flow: `Implemented`

## Assistant

- Assistant page in renderer: `Implemented`
- Session create/select/rename/archive/delete: `Implemented`
- Connect/disconnect and model listing: `Implemented`
- Prompt send and interrupt: `Implemented`
- Approval response and user-input response handling: `Implemented`
- Session project-path association and new thread flow: `Implemented`
- Event subscription and snapshot/status reads: `Implemented`

## Settings and Navigation

- Home page: `Implemented`
- Projects page: `Implemented`
- Settings pages: `Implemented`
- Tasks page: `Implemented (setting-gated)`
- Explorer page: `Implemented (setting-gated)`
- Quick-open/command palette support: `Implemented`

## Updates and Release Flows

- Current version and update state surface: `Implemented`
- Check, download, and install update actions: `Implemented`
- GitHub Releases-based packaged update flow: `Implemented`
- Versioned release output organization under `dist/releases` and `dist/unpacked`: `Implemented`

## Separate Repo Packages and Archived Material

- Landing site in `apps/landing/devscope-web`: `Implemented` as a separate package
- `archive/codex-assistant/*`: `Archived`
- Zipped legacy docs under `docs/archive`: `Archived`

## Planned Platform Extensions

- CLI on top of shared contract/core: `Planning-only`
- IDE extension on top of shared contract/core: `Planning-only`
- Alternate UI clients on top of shared contract/core: `Planning-only`

## Source of Truth

For exact operation signatures and current surface area, use:

- `src/shared/contracts/devscope-api.ts`
- `src/shared/assistant/contracts/*`
- `src/main/ipc/handlers.ts`
- `src/renderer/src/App.tsx`
