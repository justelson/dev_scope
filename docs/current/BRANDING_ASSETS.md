# Branding Assets

Last updated: April 26, 2026

This repo now keeps DevScope branding split by purpose instead of reusing one image everywhere.

## Asset Roles

- `resources/icon.png`
  - Main packaged desktop icon source used by Electron windows.
- `resources/icon.ico`
  - Windows multi-size app icon used by installers and packaged builds.
- `resources/branding/devscope-air-mark.png`
  - Clean brand artwork source for release-facing surfaces.
- `resources/branding/devscope-air-blueprint-source.png`
  - Tracked original blueprint logo source used to generate dev icon outputs.
- `resources/branding/devscope-air-blueprint.png`
  - Generated blueprint artwork used for dev-facing icon surfaces.
- `apps/landing/devscope-web/public/logo.png`
  - Landing/favicon logo synced from the clean mark.
- `src/renderer/src/assets/branding/*`
  - Renderer-importable copies for in-app branding surfaces.
- `src/renderer/src/assets/runtime-icons/*`
  - Renderer-importable package runtime logos for the Behavior settings runtime selector.
  - Current set: Bun, Node.js, npm, pnpm, and Yarn.

## Generation

Run:

```powershell
python scripts/maint/generate_branding_assets.py
```

The generator refreshes:

- release mark assets
- Windows `.ico`
- landing `logo.png`
- renderer branding imports

## Runtime Rule

- Dev runs should prefer the blueprint artwork for the literal app icon path and other dev-only shell-facing icon surfaces.
- Dev runs now use the separate runtime identity `DevScope Air-dev`, a dev-only AppUserModelID, and an isolated local profile path so they can run beside the installed app without sharing the same state bucket.
- Packaged Windows builds should use the cleaner release icon set for taskbar, shortcuts, installer, and shell surfaces.
- In-app DevScope ASCII logo components remain the primary UI branding unless a screen explicitly needs image artwork.
- Package-runtime logos are functional settings assets, not primary DevScope branding. Keep them tied to runtime selection and avoid reusing them as generic decoration.

## Validation

Before tagging a release, verify:

- dev run shows the blueprint artwork on dev-only branding surfaces
- dev run resolves as `DevScope Air-dev` instead of reusing the installed app identity
- packaged build still uses the clean icon in the window/taskbar
- installer icon and shortcut icon resolve from `resources/icon.ico`
- landing logo still matches the packaged release mark
- Behavior settings runtime selector still renders the Bun, Node.js, npm, pnpm, and Yarn logos with installed/uninstalled state readable in dark themes
