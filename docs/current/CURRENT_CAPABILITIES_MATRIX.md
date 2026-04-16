# Current Capabilities Matrix

Last validated against code on March 20, 2026.

## Status Legend

- `Implemented`: active in the current desktop app.
- `Implemented (setting-gated)`: present, but only visible when enabled in settings.
- `Planning-only`: documented direction, not a first-class implementation in this repo yet.
- `Archived`: retained for reference only, not part of the live runtime.

## Desktop Shell and System

- Window controls: `Implemented`
- Windows File Explorer shell integration for `Open with DevScope Air` file/folder entry points: `Implemented`
- System overview and detailed system stats: `Implemented`
- Readiness and developer-tooling detection: `Implemented`
- Shared metrics bootstrap, subscribe, and read flows: `Implemented`
- Active task listing: `Implemented`

## Projects and File Workflows

- Folder selection and root scanning: `Implemented`
- Project indexing across multiple roots: `Implemented`
- Project details read model: `Implemented`
- Project details progressive shell rendering with inline loading states for README, files, metadata, and refresh hydration: `Implemented`
- Installed IDE listing and open-in-IDE flows: `Implemented`
- File tree reads and path info: `Implemented`
- File preview reads across text/media/image content: `Implemented`
- Rendered HTML file preview loads the actual on-disk HTML document through the app file protocol, so relative local JS/CSS/assets referenced by that file resolve in preview mode: `Implemented`
- Fullscreen file preview uses an IDE-style workspace shell with a full-height left navigation rail, tab-like top file bar, right-aligned action chrome, and integrated folder/file-map navigation: `Implemented`
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
- Assistant delete flows reconcile auto-titled chats after history removal, drop empty detached Playground chats, and detach/remove lab-linked chats even when the link is path-derived: `Implemented`
- Assistant sidebar project grouping with newest-first chats for new sessions, remaining-count `Show more` expansion, and drag reordering: `Implemented`
- Assistant sidebar subagent tree with collapsible child threads nested under each chat and per-thread selection: `Implemented`
- Connect/disconnect and model listing: `Implemented`
- Prompt send and interrupt: `Implemented` (empty composer text falls back to a default send prompt)
- Approval response and user-input response handling: `Implemented`
- Active-plan progress panel, proposed-plan sidebar toggle, and inline proposed-plan history blocks with collapsed preview, show-more/show-less controls, sidebar-open action, and explicit implement action: `Implemented`
- Assistant header project Git change summary with total uncommitted +/- stats: `Implemented`
- Assistant composer branch switcher with upward dropdown, branch search, current/default markers, and in-place checkout: `Implemented`
- Pending AI follow-up question panel with inline option response flow: `Implemented`
- Resolved guided-input responses persist as a tool-style `Consulted user` history row with expandable question/answer detail: `Implemented`
- Session project-path association and new thread flow: `Implemented`
- Session project-path routing auto-classifies folders under the configured Playground root into Playground sessions/labs, and the assistant rail auto-switches to the selected session mode when opening or switching into those chats: `Implemented`
- Playground mode now requires a configured Playground root before creating labs or starting new Playground chats, with a dedicated root-selection onboarding overlay and disabled new-chat entry points until the root is set: `Implemented`
- Event subscription and snapshot/status reads: `Implemented`
- Session switching with cached selected-thread hydration: `Implemented`
- Subagent runtime threads stream into their own selectable thread views, and parent-thread subagent control events render as dedicated orchestration cards instead of generic tool calls: `Implemented`
- Assistant persistence auto-recovers corrupt SQLite state by backing it up, rebuilding, and maintaining a JSON fallback snapshot for recovery: `Implemented`
- Assistant markdown file links and edited-file entries opening in-app preview, including exact-line opens for file references such as `path/to/file.ts:42` or `#L42`: `Implemented`
- Assistant text inputs expose native right-click spelling suggestions and edit actions: `Implemented`
- Assistant composer exposes optional voice input with mic start/stop control: browser speech streams live on supported runtimes, local Vosk MVP records locally with rolling draft updates plus a final pass on stop, and browser-speech network failures can route directly into highlighted transcription settings: `Implemented`
- Assistant composer supports busy-turn queueing and force-send controls, with a default setting for whether busy sends queue or interrupt first: `Implemented`
- Assistant composer derives a shared capability state for typing, attachments, send/stop, and control locking, and surfaces contextual composer status/explanations for disconnected, unavailable, busy, and guided-input states: `Implemented`
- Force-pushed assistant turns keep the conversation in a working state when the runtime session is still live, and assistant turn footers show per-turn elapsed time on the last assistant message when timing data is available: `Implemented`
- Assistant composer image attachments open the file preview renderer directly from the shelf while non-image attachments keep the local attachment preview flow: `Implemented`
- Assistant composer pasted text attachments render as compact paper-card previews and open a dedicated text preview modal: `Implemented`
- Clipboard-origin assistant attachments keep local previews while prompts serialize a safe `clipboard://` reference instead of the local storage path, and explicitly mark those attachments as not being the active repo/project root or current working directory: `Implemented`
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
