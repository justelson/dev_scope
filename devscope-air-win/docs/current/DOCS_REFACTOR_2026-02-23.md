# Docs Refactor Log (2026-02-23)

## What Changed

This refactor reorganized documentation into:

- `docs/current/` for active, codebase-aligned docs.
- `docs/legacy/` for historical but useful references.

## Structural Moves

Moved these top-level doc groups into `docs/legacy/`:

- `ai`
- `backend`
- `frontend`
- `git-features`
- `performance`
- `plans`
- `project-details-features`
- `refactor`
- `terminal`
- `testing`
- `ui`

## New Active Docs Added

- `docs/README.md`
- `docs/current/README.md`
- `docs/current/CURRENT_CODEBASE_ARCHITECTURE.md`
- `docs/current/CURRENT_CAPABILITIES_MATRIX.md`
- `docs/current/DOCS_REFACTOR_2026-02-23.md`
- `docs/legacy/README.md`

## Existing Active Docs Kept

- `docs/platform/*` (recent architecture docs for building on top of DevScope)

## Cleanup

Removed empty legacy files with no useful content:

- `docs/legacy/ai/AI_AND_TERMINAL_ENHANCEMENTS.md`
- `docs/legacy/ai/AI_IMPROVEMENTS.md`
- `docs/legacy/git-features/GIT_FOLDER_BROWSER_SUMMARY.md`
- `docs/legacy/git-features/GIT_INLINE_VIEW_VISUAL_GUIDE.md`
- `docs/legacy/project-details-features/SUGGESTED_IMPROVEMENTS.md`

## Result

- Current docs are now small, navigable, and aligned to present architecture.
- Historical implementation reports remain accessible without polluting active guidance.
