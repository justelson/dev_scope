# Current Capabilities Matrix

Last validated against code on April 28, 2026. Current coverage includes assistant session hydration, session title generation, connection recovery, guided lab setup, no-lab terminal access, queue reordering and preview flags, safe clipboard attachment references, stable streaming command/file-change activity updates, MCP progress/fuzzy-search activity rows, compact path-aware preview links, installed package-runtime detection, Git clone/progress events, and the terminal-only `/tasks` redirect.

## Status Legend

- `Implemented`: active in the current desktop app.
- `Implemented (setting-gated)`: present, but only visible when enabled in settings.
- `Planning-only`: documented direction, not a first-class implementation in this repo yet.
- `Archived`: retained for reference only, not part of the live runtime.

## Desktop Shell

- Window controls: `Implemented`
- Windows File Explorer shell integration for `Open with DevScope Air` file/folder entry points: `Implemented`
- Readiness and developer-tooling detection: `Implemented`

## Projects, Files, and Terminals

- Folder selection and root scanning: `Implemented` (the Projects root behaves as a folder browser over the configured root instead of flattening the full indexed project inventory into the default view; indexed search and stats still use the broader index)
- Persistent file and folder indexing across multiple roots with cached rebuilds and indexed search reuse: `Implemented`
- Project details read model: `Implemented`
- Project details progressive shell rendering with inline loading states for README, files, metadata, and refresh hydration, including shallow-first file tree loading plus indexed search for deep matches: `Implemented`
- Project and folder headers use compact root-relative path display, inline open-in-terminal/project actions, and Git change summaries that can show addition/deletion counts instead of only file counts: `Implemented`
- Installed IDE listing and open-in-IDE flows: `Implemented`
- File tree reads and path info: `Implemented`
- Indexed file search reused by command palette, folder browse, and project file-tree search surfaces: `Implemented`
- File preview reads across text/media/image content, including sibling media navigation for image/video/audio browsing: `Implemented`
- Rendered HTML file preview loads the actual on-disk HTML document through the app file protocol, so relative local JS/CSS/assets referenced by that file resolve in preview mode: `Implemented`
- Fullscreen file preview uses an IDE-style workspace shell with a full-height left navigation rail, tab-like top file bar, right-aligned action chrome, streamlined edit/save menus, Python run-mode controls, line-focus navigation, and integrated folder/file-map navigation: `Implemented`
- File writes, rename, move, paste, delete, and clone-repository-into-current-folder flows with streamed clone progress and completion/error toasts: `Implemented`
- Preview terminal sessions: `Implemented`
- Project script buttons support a Behavior setting for package runtime selection, with main-process installed-runtime detection for Node.js, npm, pnpm, Yarn, and Bun plus auto mode that follows project lockfiles: `Implemented`
- File preview terminal opens as a bottom overlay panel inside the preview workspace instead of consuming sidebar/layout height, uses panel-style in/out motion, and live session titles now sync from terminal output and command submissions even while sessions continue in the background: `Implemented`
- Dedicated terminals management page: `Implemented`
- Python preview runs: `Implemented`

## Git Workflows

- Read flows for status, history, commit stats, sync, remotes, tags, stashes, repo owner, publish context, current-branch PR lookup, and working diff: `Implemented`
- Write flows for stage, unstage, discard, branch/tag actions, stash actions, fetch, pull, push, clone, and repo init/setup: `Implemented`
- AI-generated commit message flow with Groq, Gemini, or dedicated Codex Git models for commit/PR work: `Implemented`
- One-click staged `commit -> push -> create/open PR` flow for GitHub remotes: `Implemented`
- GitHub CLI-backed pull request create/open flow with AI-or-template draft generation, current-branch PR reuse, and commit-push-PR orchestration: `Implemented`

## Assistant

- Assistant page in renderer: `Implemented`
- Session create/select/rename/archive/delete: `Implemented`
- Explicit session hydration after selection plus deletion fallback that keeps the assistant rail usable when the selected session is removed: `Implemented`
- Assistant prompt sends queue background session-title generation when the title is still default, so new chats auto-name themselves from the first prompt: `Implemented`
- Assistant delete flows reconcile auto-titled chats after history removal, drop empty detached Playground chats, and detach or remove lab-linked chats even when the link is path-derived: `Implemented`
- Assistant sidebar supports grouped-project or flat-list organization, updated-vs-created ordering, a redesigned per-project mini header with count/recency metadata, remaining-count `Show more` expansion, and drag reordering within the active view: `Implemented`
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
- Playground chats can start without an attached lab; in that no-lab state the assistant is instructed to treat the chat as non-filesystem by default, while prompts that need local files, folders, repos, or workspace access route through a tool-enabled setup turn so Codex can request lab setup with its reason and suggested lab title before any workspace work starts: `Implemented`
- No-lab Playground chats expose per-chat terminal access in the assistant header plus a default in Assistant settings; terminal-shaped prompts can request neutral home-directory terminal access through a dedicated permission modal with a "don't ask again" path, approved/declined answers rerun the original prompt without duplicating the user message, and cwd changes force runtime reconnect before the rerun: `Implemented`
- Assistant connection recovery banner and retry flow for dropped runtime sessions: `Implemented`
- Event subscription and snapshot/status reads: `Implemented`
- Session switching with cached selected-thread hydration: `Implemented`
- Subagent runtime threads stream into their own selectable thread views, and parent-thread subagent control events render as dedicated orchestration cards instead of generic tool calls: `Implemented`
- Assistant persistence auto-recovers corrupt SQLite state by backing it up, rebuilding, and maintaining a JSON fallback snapshot for recovery: `Implemented`
- Assistant markdown file links, inline-code file references, Windows absolute path links, and edited-file entries open in-app preview with compact path chips, including exact-line opens for file references such as `path/to/file.ts:42`, `C:\path\file.ts:42`, or `#L42`: `Implemented`
- Assistant text inputs expose native right-click spelling suggestions and edit actions: `Implemented`
- Assistant composer exposes optional voice input with mic start/stop control: browser speech streams live on supported runtimes, local Vosk MVP records locally with rolling draft updates plus a final pass on stop, and browser-speech network failures can route directly into highlighted transcription settings: `Implemented`
- Assistant composer supports busy-turn queueing and force-send controls, clears queued items as soon as a resend is accepted, pauses failed re-dispatches instead of endlessly re-looping them, exposes per-message force-send/edit/delete actions, supports grip-handle queue reordering, and keeps queued attachments attached to their prompt through reorder/edit/send; dev builds also support `/queue-test` and `/queue-preview` prompt flags with optional `--count=N` and `--force` to create local preview-only queued items, plus `/compact-test` for local context-compaction marker testing, without dispatching to the assistant runtime: `Implemented`
- Assistant composer derives a shared capability state for typing, attachments, send/stop, and control locking, and surfaces contextual composer status/explanations for disconnected, unavailable, busy, and guided-input states: `Implemented`
- Force-pushed assistant turns keep the conversation in a working state when the runtime session is still live, and assistant turn footers show per-turn elapsed time on the last assistant message when timing data is available: `Implemented`
- Assistant timeline tool-call cards keep live command and file-change output deltas in sync, preserve app-server raw response tool calls by stable item/call id, show MCP/dynamic/search call arguments and structured results in terminal-style rows, render completed-without-output as a compact first-class state, render edited-file outputs as compact path-first rows with explicit open/diff actions while suppressing duplicated file-list spill below them, preserve long command lines with horizontal scrolling, respect the assistant default for expanding or minimizing live command/tool output, and auto-collapse completed command/tool runs after the stream settles: `Implemented`
- Assistant event bridging now keeps turn-diff updates, fuzzy file-search result rows, MCP progress, raw response tool completions, live command/file-change output deltas, and stable tool-item IDs pinned to the correct history row: `Implemented`
- Assistant composer image attachments open the file preview renderer directly from the shelf while non-image attachments keep the local attachment preview flow: `Implemented`
- Assistant composer pasted text attachments render as compact paper-card previews and open a dedicated text preview modal: `Implemented`
- Sent clipboard attachments in assistant history now hide generated paste filenames behind generic pasted labels, reuse the composer-style attachment cards inside user bubbles, switch to a sideways attachment rail when many files are attached, open pasted text in a read-only preview modal from chat history, derive auto-titled chats from the typed body or generic attachment labels instead of serialized attachment metadata, and serialize prompt context as safe `clipboard://` references that resolve through assistant IPC for preview/open actions without being treated as the active repo root or cwd: `Implemented`
- Assistant composer inline `@` mention highlighting currently uses a mirrored overlay on top of a native textarea; pending follow-up is to replace that hack with either plain-text mentions or a true inline-styled editor surface: `Implemented with follow-up`
- Assistant defaults/settings page exposes transcription enablement, browser-vs-local engine selection, local Vosk model download/install prep, and highlight-targeted deep linking from assistant error recovery flows: `Implemented`
- App-level assistant defaults for starter prompt template, model, chat/plan mode, supervised/full-access mode, reasoning level, and fast mode: `Implemented`
- Assistant account overview surface with auth mode, plan, and rate-limit reads: `Implemented`

## Settings and Navigation

- Home page: `Implemented`
- Projects page: `Implemented`
- Settings pages, including a paginated dark-theme appearance library with imported Codex, DP Code, Linear, Vercel, Notion, Raycast, Solarized, Sentry, Matrix, Temple, Oscurange, Lobster, Absolutely, VS Code Plus, and Material presets plus behavior controls for package runtime selection with installed-state cards, official runtime icons, assistant service-tier/pricing metadata, and live command/tool-output defaults: `Implemented`
- Terminals page: `Implemented`
- Legacy `/tasks` route redirects to `Terminals`, which is now the sole live terminal-management surface: `Implemented`
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
