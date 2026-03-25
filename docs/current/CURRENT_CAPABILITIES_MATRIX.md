# Current Capabilities Matrix

Last validated against code on March 20, 2026.

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
- AI-generated commit message flow with Groq, Gemini, or Codex model selection: `Implemented`
- One-click staged `commit -> push -> create/open PR` flow for GitHub remotes: `Implemented`
- GitHub CLI-backed pull request create/open flow with AI-or-template draft generation: `Implemented`

## Assistant

- Assistant page in renderer: `Implemented`
- Session create/select/rename/archive/delete: `Implemented`
- Assistant sidebar project grouping with newest-first chats for new sessions, progressive 5-chat "Show more" expansion, and drag reordering: `Implemented`
- Connect/disconnect and model listing: `Implemented`
- Prompt send and interrupt: `Implemented` (empty composer text falls back to a default send prompt)
- Approval response and user-input response handling: `Implemented`
- Active-plan progress panel, proposed-plan sidebar toggle, and inline proposed-plan history blocks with collapsed preview, show-more/show-less controls, sidebar-open action, and explicit implement action: `Implemented`
- Assistant header project Git change summary with total uncommitted +/- stats: `Implemented`
- Assistant composer branch switcher with upward dropdown, branch search, current/default markers, and in-place checkout: `Implemented`
- Pending AI follow-up question panel with inline option response flow: `Implemented`
- Resolved guided-input responses persist as a tool-style `Consulted user` history row with expandable question/answer detail: `Implemented`
- Session project-path association and new thread flow: `Implemented`
- Event subscription and snapshot/status reads: `Implemented`
- Session switching with cached selected-thread hydration: `Implemented`
- Assistant persistence auto-recovers corrupt SQLite state by backing it up, rebuilding, and maintaining a JSON fallback snapshot for recovery: `Implemented`
- Assistant markdown file links and edited-file entries opening in-app preview: `Implemented`
- Assistant text inputs expose native right-click spelling suggestions and edit actions: `Implemented`
- Assistant composer exposes optional voice input with mic start/stop control: browser speech streams live on supported runtimes, local Vosk MVP records locally with rolling draft updates plus a final pass on stop, and browser-speech network failures can route directly into highlighted transcription settings: `Implemented`
- Assistant defaults/settings page exposes transcription enablement, browser-vs-local engine selection, local Vosk model download/install prep, and highlight-targeted deep linking from assistant error recovery flows: `Implemented`
- App-level assistant defaults for starter prompt template, model, chat/plan mode, supervised/full-access mode, reasoning level, and fast mode: `Implemented`
- Assistant account overview surface with auth mode, plan, and rate-limit reads: `Implemented`

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
