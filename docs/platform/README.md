# DevScope Platform Docs

This section covers planned ways to build additional clients on top of the current DevScope contracts and core services without coupling those clients to Electron UI code.

Use this folder alongside:

- [`docs/current/README.md`](C:\Users\elson\my_coding_play\devscope\docs\current\README.md) for the live desktop baseline
- [`docs/archive/LEGACY_DOCS_SUMMARY_2026-03-18.md`](C:\Users\elson\my_coding_play\devscope\docs\archive\LEGACY_DOCS_SUMMARY_2026-03-18.md) if historical decisions matter

## Documents

- [`BUILDING_ON_TOP_GUIDE.md`](C:\Users\elson\my_coding_play\devscope\docs\platform\BUILDING_ON_TOP_GUIDE.md)
  Platform boundaries and phased adoption guidance.
- [`CLI_ON_DEVSCOPE.md`](C:\Users\elson\my_coding_play\devscope\docs\platform\CLI_ON_DEVSCOPE.md)
  First-party CLI planning around shared core capabilities.
- [`IDE_EXTENSION_ON_DEVSCOPE.md`](C:\Users\elson\my_coding_play\devscope\docs\platform\IDE_EXTENSION_ON_DEVSCOPE.md)
  IDE extension architecture and risk model.
- [`ALT_UI_CLIENTS_ON_DEVSCOPE.md`](C:\Users\elson\my_coding_play\devscope\docs\platform\ALT_UI_CLIENTS_ON_DEVSCOPE.md)
  Alternate client surface planning.

## Current Anchor Points In Codebase

- General desktop contract: `src/shared/contracts/devscope-api.ts`
- Assistant contract: `src/shared/assistant/contracts/*`
- Main-process core/service area: `src/main`
- Main IPC registry: `src/main/ipc/handlers.ts`
- Electron preload composition: `src/preload/devscope-electron-adapter.ts`
- Renderer route shell: `src/renderer/src/App.tsx`

## Working Rule

Any cross-client work should start from shared contract shape and reusable core behavior, not from copied renderer logic.
