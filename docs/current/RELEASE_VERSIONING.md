# Desktop Release Versioning

DevScope Air desktop releases use SemVer so Electron auto-updates can compare versions correctly.

## Tag and package format

- `package.json` version must stay valid SemVer.
- Git tag format is `v<package-version>`.
- Examples:
  - `1.0.0-alpha.1` -> tag `v1.0.0-alpha.1`
  - `5.2.0-beta.3` -> tag `v5.2.0-beta.3`
  - `10.1.0` -> tag `v10.1.0`

## Channel mapping

- `1.x.x-alpha.n` through `4.x.x-alpha.n`: alpha phase
- `5.x.x-beta.n` through `9.x.x-beta.n`: beta phase
- `10.x.x` and above: stable/main phase

## Human-facing labels

The app formats prerelease versions for UI display:

- `1.0.0-alpha.1` -> `v1.0 Alpha 1`
- `5.1.0-beta.2` -> `v5.1 Beta 2`
- `10.0.0` -> `v10.0.0`

## GitHub Releases

- Tag pushes matching `v*` trigger `.github/workflows/release.yml`.
- Tags containing `-alpha.` or `-beta.` are published as GitHub prereleases.
- Release assets must include the Windows installer plus update metadata (`*.yml`, `*.blockmap`).
