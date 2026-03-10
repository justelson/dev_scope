# Update Testing Playbook

Last updated: March 9, 2026

Use this flow to validate updater and release behavior without spamming real releases.

## Goal

Catch UI, packaging, icon, and updater problems in layers:

1. dev runtime
2. local packaged build
3. one reusable test release lane
4. real release on `main`

## Recommended Flow

### 1. Dev Runtime

Use `dev` branch for UI/state checks only.

Validate:

- update center copy and button states
- disabled-state messaging in unpackaged runs
- dev-only blueprint branding appears where expected
- no silent updater actions

Do not treat dev mode as updater proof. Auto-update is expected to be disabled there.

### 2. Local Packaged Smoke

Before any public tag:

- build a local packaged app
- install or run the packaged output locally
- verify:
  - taskbar icon
  - window icon
  - installer icon
  - Start Menu shortcut icon
  - About/update center copy

This catches most branding and packaging mistakes before GitHub is involved.

### 3. Reusable Test Release Lane

Do not test updater logic by creating many real user-facing releases.

Prefer one of these:

- a dedicated test repository used only for updater verification
- a dedicated prerelease channel/tag pattern that is clearly non-production

Point test builds at that lane with:

- `DEVSCOPE_DESKTOP_UPDATE_REPOSITORY`

That lets packaged test builds exercise the full updater path without polluting the main release history.

### 4. Real Release

Only release from `main` after:

- local packaged smoke passed
- test-lane updater check passed when updater behavior changed
- release assets and metadata were verified

## Minimum Checklist

- dev mode: state UX correct
- local packaged app: Windows branding correct
- updater fallback link works
- updater check/download/install logic tested on a packaged build
- real release only after those pass
