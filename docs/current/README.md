# Current Docs

This folder is the active documentation set for the current DevScope Air codebase.

The source-of-truth runtime is the Windows Electron app at the repository root. The landing site in `apps/landing/devscope-web` is a separate package and should be documented as a separate client.

Snapshot alignment: April 29, 2026 current-state pass.

## Core References

- [`CURRENT_CODEBASE_ARCHITECTURE.md`](C:\Users\elson\my_coding_play\devscope\docs\current\CURRENT_CODEBASE_ARCHITECTURE.md)
  Runtime layers, route surface, IPC/main boundaries, and active module ownership.
- [`REPO_BOUNDARIES.md`](C:\Users\elson\my_coding_play\devscope\docs\current\REPO_BOUNDARIES.md)
  Focused runtime ownership and layering rules for refactors and cross-process changes.
- [`CURRENT_CAPABILITIES_MATRIX.md`](C:\Users\elson\my_coding_play\devscope\docs\current\CURRENT_CAPABILITIES_MATRIX.md)
  What the app exposes today, including assistant hydration/recovery, Playground lab setup, file preview, Git, project, and update flows.
- [`ENGINEERING_QUALITY_STANDARDS.md`](C:\Users\elson\my_coding_play\devscope\docs\current\ENGINEERING_QUALITY_STANDARDS.md)
  Quality expectations by layer.
- [`CHANGE_SCOPE_GUIDELINES.md`](C:\Users\elson\my_coding_play\devscope\docs\current\CHANGE_SCOPE_GUIDELINES.md)
  Scope and layering rules for changes.
- [`CHANGE_VALIDATION_CHECKLIST.md`](C:\Users\elson\my_coding_play\devscope\docs\current\CHANGE_VALIDATION_CHECKLIST.md)
  Lightweight validation guidance.
- [`WORKTREE_TO_PR_WORKFLOW.md`](C:\Users\elson\my_coding_play\devscope\docs\current\WORKTREE_TO_PR_WORKFLOW.md)
  End-to-end playbook for LOC sweeps, modularization, validation, commit batching, and PR filing.
- [`BRANCH_WORKFLOW.md`](C:\Users\elson\my_coding_play\devscope\docs\current\BRANCH_WORKFLOW.md)
  Default branch intent for `main` versus `dev`.
- [`RELEASE_VERSIONING.md`](C:\Users\elson\my_coding_play\devscope\docs\current\RELEASE_VERSIONING.md)
  Release naming/versioning rules.
- [`RELEASE_OPERATIONS_PLAYBOOK.md`](C:\Users\elson\my_coding_play\devscope\docs\current\RELEASE_OPERATIONS_PLAYBOOK.md)
  Packaging and release operations.
- [`UI_BORDER_AND_DIVIDER_STANDARDS.md`](C:\Users\elson\my_coding_play\devscope\docs\current\UI_BORDER_AND_DIVIDER_STANDARDS.md)
  Canonical border, divider, and subtle-line treatment for the current UI.
- [`CONNECTED_DROPDOWN_BUTTON_PATTERN.md`](C:\Users\elson\my_coding_play\devscope\docs\current\CONNECTED_DROPDOWN_BUTTON_PATTERN.md)
  Canonical attached split-button/dropdown pattern for compact state controls.
- [`UPDATE_TESTING_PLAYBOOK.md`](C:\Users\elson\my_coding_play\devscope\docs\current\UPDATE_TESTING_PLAYBOOK.md)
  Updater validation workflow.
- [`BRANDING_ASSETS.md`](C:\Users\elson\my_coding_play\devscope\docs\current\BRANDING_ASSETS.md)
  Branding asset roles and generation flow.

## Current App State

- Assistant session hydration, deletion fallback, connection recovery, streaming tool cards, stable raw-response activity IDs, MCP progress, fuzzy file-search activity, turn-diff updates, live command/file-change output deltas, and safe clipboard attachment references are part of the live runtime.
- Playground chats can start detached from a lab, then use per-chat terminal access or escalate into terminal-access/lab-setup guided turns only when the prompt actually needs command or workspace access.
- File preview now includes the IDE-style full-screen shell, HTML preview loading through the app file protocol, compact file-link chips, line-focused markdown/file-reference navigation, sibling media navigation, streamlined header/edit actions, Python run-mode controls, and an overlay terminal panel.
- Folder/project browsing emphasizes compact headers, root-relative paths, indexed deep search, folder-level repository cloning with streamed progress, and project Git summaries that show actual addition/deletion counts where available.
- Git surfaces include status/diff/history stats, pull/push refresh flows, current-branch PR lookup, and one-click commit/push/create-or-open PR actions backed by shared contracts.
- Desktop update and release flows now cover the `1.6.5-beta.1` package line, resilient `electron-updater` loading, update-success toast state, generated release-note bodies, and local GitHub release publishing from versioned assets.
- Settings include installed package-runtime detection for project scripts, official runtime icons, imported dark theme presets, assistant pricing/service-tier display, live tool-output defaults, no-lab Playground terminal defaults, and the current assistant defaults/behavior surfaces.

## Task-Specific Skills

- [`../.codex/skills/devscope-release/SKILL.md`](C:\Users\elson\my_coding_play\devscope\.codex\skills\devscope-release\SKILL.md)
  Trigger for release/version/tag/publish/download tasks.
- [`../.codex/skills/devscope-ui-standards/SKILL.md`](C:\Users\elson\my_coding_play\devscope\.codex\skills\devscope-ui-standards\SKILL.md)
  Trigger for assistant/app-chrome border, divider, and subtle-surface styling tasks.

## What Does Not Live Here

- Historical docs and superseded plans have been moved into [`docs/archive`](C:\Users\elson\my_coding_play\devscope\docs\archive\LEGACY_DOCS_SUMMARY_2026-03-18.md).
- Multi-client platform planning lives in [`docs/platform`](C:\Users\elson\my_coding_play\devscope\docs\platform\README.md).
- Design capture/reference material remains at the top of `docs/`.

## Maintenance Rule

When behavior changes in code, update the relevant `docs/current/*` document in the same workstream.
