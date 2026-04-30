# Update Testing Playbook

Last updated: April 30, 2026

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
- a local packaged-app feed served from `dist/releases/v<version>/`

Point test builds at that lane with:

- `DEVSCOPE_DESKTOP_UPDATE_REPOSITORY`
- `DEVSCOPE_DESKTOP_UPDATE_FEED_URL`

That lets packaged test builds exercise the full updater path without polluting the main release history.

For local feed testing:

1. Build or keep release artifacts in `dist/releases/v<version>/`.
2. Start the local feed server:
   `npm run update:serve-feed -- --dir dist/releases/v<version>`
3. Launch an older packaged build from PowerShell with:
   `$env:DEVSCOPE_DESKTOP_UPDATE_FEED_URL='http://127.0.0.1:45841/'`
4. Use the app update UI to check, download, and install.

Keep the feed server running until the packaged app finishes downloading.

The feed server validates the directory before it listens, so a missing `latest.yml`, installer `.exe`, or installer `.exe.blockmap` should be fixed in the build output before retrying the updater smoke.

Updater behavior to verify in packaged tests:

- stable builds resolve the newest stable GitHub release feed
- prerelease builds resolve the newest prerelease-capable GitHub release feed
- the resolved release still contains `latest.yml`, the installer `.exe`, and the installer `.blockmap`
- dynamic `electron-updater` import exposes `autoUpdater` in the packaged runtime
- first launch after installing a newer packaged version shows one update-success toast, then stores that version as seen

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
- generated release notes match the tag compare range used in the GitHub release body
- real release only after those pass
