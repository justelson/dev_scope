# Release Operations Playbook

Last updated: May 2, 2026

This document explains how DevScope desktop releases should be prepared, verified, recovered, and organized.

Use this together with:

- `docs/current/RELEASE_VERSIONING.md`
- `docs/current/CHANGE_VALIDATION_CHECKLIST.md`

## Release Goals

Every desktop release should leave the repo and GitHub in a state that is:

1. version-consistent
2. updater-compatible
3. easy to verify
4. easy to clean up locally

## Normal Release Flow

1. Update package version in `package.json`.
2. Keep release-facing UI/documentation in sync with that version when needed.
   Human-facing app labels should use the simplified display format, for example `v1.5.0 beta`, while package/tag versions remain full SemVer.
3. Generate release notes from the previous published tag to the upcoming tag:
   - `npm run release:notes`
   - use the same compare range for the GitHub release body
4. Create and push tag `v<package-version>`.
5. Verify GitHub Actions release workflow status or use the local publisher path when intentionally doing a local publish.
6. Verify GitHub release exists, has the correct title, changelog body, and expected assets are attached.

## Required GitHub Release Name

GitHub release names must follow the human-facing title format derived from the package version:

- stable: `DevScope Air v<major>.<minor>.<patch>`
- prerelease: `DevScope Air v<major>.<minor>.<patch> <channel>`

Examples:

- `DevScope Air v1.6.5 beta`
- `DevScope Air v1.5.1`

## Expected Windows Release Assets

For Windows releases, the published GitHub release must include:

- installer `.exe`
- `latest.yml`
- installer `.blockmap`

If any of those are missing, treat the release as incomplete.

## Updater Feed Resolution

The desktop app resolves update feeds directly from GitHub releases:

- stable builds look for the newest non-draft stable release with Windows updater assets
- alpha/beta builds allow prereleases and pick the newest non-draft matching release with Windows updater assets
- the updater then reads `latest.yml` from that exact release tag path on GitHub

This keeps the updater working from public GitHub releases without requiring a paid release-management service.

## Local Build Output Layout

Local release artifacts must be organized by version:

- installers and metadata: `dist/releases/v<package-version>/`
- unpacked app bundles: `dist/unpacked/v<package-version>/win-unpacked/`

Avoid leaving release files loose in `dist/`.

## Local Packaging Commands

Current packaging scripts:

- `npm run build:win`
  - builds Electron app and writes Windows release artifacts to `dist/releases/v<package-version>/`
- `npm run build:unpack`
  - writes unpacked bundle to `dist/unpacked/v<package-version>/`
- `npm run dist:organize`
  - moves older flat `dist` artifacts into the versioned layout when possible
- `npm run release:notes`
  - prints the GitHub release changelog generated from the previous merged release tag to the upcoming package version tag
  - groups commits into fixes, updates/release, UI/workflow, docs, and maintenance sections
- `npm run release:publish:local`
  - local-only GitHub release publisher
  - requires a clean `main` branch checkout, a local tag `v<package-version>`, and release assets already built in `dist/releases/v<package-version>/`
  - pushes `main` and the version tag, creates or updates the GitHub release directly with the generated changelog body, and uploads `.exe`, `.blockmap`, and `latest.yml` without relying on GitHub Actions
  - deletes and replaces conflicting release assets, then verifies the required uploaded assets are present
- `npm run update:serve-feed`
  - local-only packaged-update feed server
  - defaults to `dist/releases/v<package-version>/`
  - accepts `--dir`, `--host`, and `--port`
  - refuses to start unless the feed directory contains `latest.yml`, an installer `.exe`, and an installer `.exe.blockmap`

## Release Verification Checklist

After any release task:

1. Confirm the tag exists on GitHub.
2. Confirm the GitHub release object exists.
3. Confirm release type is correct:
   - prerelease for `-alpha.*` and `-beta.*`
   - normal release for plain stable tags
4. Confirm the release title matches the expected human-facing format for that version.
5. Confirm the release body contains the changelog generated from the previous release tag.
6. Confirm expected Windows assets exist.
7. Confirm `latest.yml` points at the actual uploaded installer filename.
8. If the landing page download button is meant to target the newest release, verify it still resolves correctly.

## Remote Failure Handling

Do not assume a tag push means the release succeeded.

If the release workflow fails:

1. inspect the remote run status
2. identify the exact blocker
3. report that blocker clearly
4. only then choose a recovery path

Common blocker types:

- GitHub billing/account lock
- missing Actions permissions or secrets
- release workflow configuration error
- artifact upload failure

## Manual Recovery Path

Use manual GitHub release creation/upload only when the normal workflow is blocked and the blocker is clearly identified.

Manual recovery still requires:

1. correct tag already pushed
2. local artifacts built successfully
3. release object created on GitHub
4. `.exe`, `.blockmap`, and `latest.yml` uploaded
5. `latest.yml` verified against the actual uploaded installer filename

The local publisher script can be used as the preferred recovery path when GitHub Actions is blocked but GitHub API access still works from the machine:

1. build release artifacts locally
2. ensure the intended release commit is on `main`
3. ensure `v<package-version>` exists locally
4. run `npm run release:publish:local`
5. verify the GitHub release object, title, and all required assets

## Local Update Feed Testing

Use the local feed only for packaged updater validation, not as a release substitute.

1. Build or keep release artifacts under `dist/releases/v<package-version>/`.
2. Start the feed with `npm run update:serve-feed -- --dir dist/releases/v<package-version>`.
3. Launch an older packaged build with `DEVSCOPE_DESKTOP_UPDATE_FEED_URL` pointed at the feed URL.
4. Run the app's check/download/install path.
5. Keep the feed process alive until the packaged app finishes downloading.

## Local Lock / Cleanup Rules

If file organization or cleanup fails because a running local process is holding files open:

- say that explicitly
- identify the locked path
- identify what likely needs to be closed
- do not pretend cleanup completed if it did not

Common locked paths:

- `dist/win-unpacked/...`
- `dist-release-*/win-unpacked/...`
- `resources/app.asar`

## When To Update This Doc

Update this playbook when:

- release scripts change
- output folder conventions change
- GitHub release workflow behavior changes
- GitHub release naming behavior changes
- updater asset requirements change
- manual recovery process changes

## May 2 Verification Note

No release-operation behavior changed after the May 1 docs pass. The current package line remains `1.6.5-beta.1`, with versioned output under `dist/releases/v<package-version>/`, generated release notes, local GitHub release publishing, and local packaged update-feed testing.
