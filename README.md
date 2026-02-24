# DevScope

DevScope is a Windows-focused Electron codebase for developer environment discovery, project intelligence, and AI-assisted workflows.

This repository contains multiple app variants rather than a single root workspace package.

## Repository Layout

- `devscope-air-win/`: Active app variant. Projects-first UX (project scanning, Git workflows, assistant surfaces, file browsing).
- `devscope-win/`: Legacy/full variant with integrated terminal + AgentScope orchestration.
- `design-inspiration/`: UI/design references and experiments.

## Prerequisites

- Windows 10/11 (primary target)
- Node.js 18+
- npm 9+
- Optional: Bun 1+ (supported by `devscope-air-win`)

## Quick Start (Recommended: DevScope Air)

```powershell
cd devscope-air-win
npm install
npm run dev
```

Build distributable assets:

```powershell
npm run build
npm run build:win
```

Optional Bun flow:

```powershell
bun install
bun run dev
```

## Quick Start (Legacy Full Variant)

```powershell
cd devscope-win
npm install
npm run dev
```

Build:

```powershell
npm run build
npm run build:win
```

## Useful Scripts

### `devscope-air-win`

- `npm run dev`: Start Electron + renderer in development mode
- `npm run build`: Production build
- `npm run build:win`: Build Windows installer (NSIS)
- `npm run maint:loc`: LOC sanity check
- `npm run maint:loc:strict`: Strict LOC check

### `devscope-win`

- `npm run dev`: Start Electron + renderer in development mode
- `npm run build`: Production build
- `npm run build:win`: Build Windows installer (NSIS)
- `npm run build:unpack`: Build unpacked app directory

## Documentation Entry Points

For the current architecture and capability baseline, start in:

- `devscope-air-win/docs/current/README.md`
- `devscope-air-win/docs/current/CURRENT_CODEBASE_ARCHITECTURE.md`
- `devscope-air-win/docs/current/CURRENT_CAPABILITIES_MATRIX.md`

For platform/client expansion guidance:

- `devscope-air-win/docs/platform/README.md`

## Notes

- There is no root `package.json`; run commands from the specific app directory.
- `devscope-air-win` is the most up-to-date variant for ongoing development.