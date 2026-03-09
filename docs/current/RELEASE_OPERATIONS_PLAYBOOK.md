# Release Operations Playbook

Last updated: March 9, 2026

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
3. Create and push tag `v<package-version>`.
4. Verify GitHub Actions release workflow status.
5. Verify GitHub release exists and expected assets are attached.

## Expected Windows Release Assets

For Windows releases, the published GitHub release must include:

- installer `.exe`
- `latest.yml`
- installer `.blockmap`

If any of those are missing, treat the release as incomplete.

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

## Release Verification Checklist

After any release task:

1. Confirm the tag exists on GitHub.
2. Confirm the GitHub release object exists.
3. Confirm release type is correct:
   - prerelease for `-alpha.*` and `-beta.*`
   - normal release for plain stable tags
4. Confirm expected Windows assets exist.
5. Confirm `latest.yml` points at the actual uploaded installer filename.
6. If the landing page download button is meant to target the newest release, verify it still resolves correctly.

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
- updater asset requirements change
- manual recovery process changes
