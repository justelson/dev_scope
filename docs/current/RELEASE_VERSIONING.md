# Desktop Release Versioning

Last updated: March 18, 2026

DevScope Air desktop releases use SemVer so Electron auto-updates can compare versions correctly.

## Tag and package format

- `package.json` version must stay valid SemVer.
- Git tag format is `v<package-version>`.
- Examples:
  - `1.0.0-alpha.1` -> tag `v1.0.0-alpha.1`
  - `5.2.0-beta.3` -> tag `v5.2.0-beta.3`
  - `10.1.0` -> tag `v10.1.0`

## Channel mapping

- `-alpha.<n>`: alpha channel
- `-beta.<n>`: beta channel
- no prerelease suffix: stable channel

## Sequence meaning

- The prerelease suffix carries the major iteration for preview builds.
- `alpha.<n>` means the nth major alpha step.
- `beta.<n>` means the nth major beta step.
- The base SemVer numbers (`1.x.y`) are the smaller refinement level inside that alpha or beta line.

## Increment rules

- Small change within the current preview step:
  - keep the same prerelease suffix
  - only bump the base SemVer numbers
- Major preview change:
  - increment the prerelease suffix
  - reset the base SemVer numbers back to `1.0.0`
- Do not reset the leading `1`.

## Examples

- Current version: `1.5.0-alpha.5`
- Small change examples:
  - `1.5.1-alpha.5`
  - `1.6.0-alpha.5`
- Major preview change example:
  - `1.0.0-alpha.6`

## Human-facing labels

The app formats prerelease versions for UI display using a simplified label:

- `1.0.0-alpha.1` -> `v1.0.0 alpha`
- `1.5.0-alpha.5` -> `v1.5.0 alpha`
- `5.1.0-beta.2` -> `v5.1.0 beta`
- `10.0.0` -> `v10.0.0`

## GitHub Releases

- Tag pushes matching `v*` trigger `.github/workflows/release.yml`.
- Tags containing `-alpha.` or `-beta.` are published as GitHub prereleases.
- Release title should use the cleaner human label derived from the package version.
- Examples:
  - `1.5.0` -> `DevScope Air v1.5.0`
  - `1.5.0-beta.1` -> `DevScope Air v1.5.0 beta`
- Release assets must include the Windows installer plus update metadata (`*.yml`, `*.blockmap`).
