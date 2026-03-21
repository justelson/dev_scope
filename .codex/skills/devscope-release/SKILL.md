---
name: devscope-release
description: Release workflow for DevScope Air desktop publishing, versioning, tags, GitHub releases, updater metadata, and landing-page download resolution. Use when a task involves release prep, version bumps, tags, publish flows, GitHub release verification, latest.yml/blockmap assets, or release download behavior.
---

# DevScope Release

Read these files before acting:

1. `docs/current/BRANCH_WORKFLOW.md`
2. `docs/current/RELEASE_VERSIONING.md`
3. `docs/current/RELEASE_OPERATIONS_PLAYBOOK.md`

## Workflow

- Treat `main` as the release branch.
- Keep Git tag format as `v<package-version>`.
- Keep GitHub release title as `DevScope Air <package-version>`.
- Verify the GitHub release object and required assets after release work.
- Treat missing `.exe`, `latest.yml`, or `.blockmap` assets as an incomplete release.
- Keep landing-page download logic dynamic. Do not hardcode versioned GitHub release asset URLs.

## Output Layout

- Keep installers and updater metadata under `dist/releases/v<package-version>/`.
- Keep unpacked app bundles under `dist/unpacked/v<package-version>/`.
- Do not leave release artifacts loose in `dist/` unless recovering temporarily and explicitly.

## Failure Handling

- If a remote release step fails, identify the exact remote blocker before proposing workarounds.
- If a local cleanup or artifact move is blocked by a running process, say so explicitly and identify the locked path.

## Do Not Assume

- Do not assume a tag push means the release completed.
- Do not assume the latest landing download still resolves correctly after release changes.
- Do not assume release assets are correct until verified against GitHub state.
