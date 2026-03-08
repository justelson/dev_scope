# DevScope Platform Docs

This section documents how to build new clients on top of the current DevScope codebase without coupling every client to Electron UI code.

Use with:

- `docs/current/README.md` for current architecture baseline.
- `docs/legacy/README.md` for historical references.

## Documents

- `docs/platform/BUILDING_ON_TOP_GUIDE.md`
  - Platform architecture, boundaries, and phased adoption plan.
- `docs/platform/CLI_ON_DEVSCOPE.md`
  - First-party CLI strategy using shared contracts and core services.
- `docs/platform/IDE_EXTENSION_ON_DEVSCOPE.md`
  - IDE extension model, integration points, and risk controls.
- `docs/platform/ALT_UI_CLIENTS_ON_DEVSCOPE.md`
  - How to build additional UIs (web, TUI, lightweight desktop) on the same backend contract.

## Current Anchor Points In Codebase

- Shared API contract: `src/shared/contracts/devscope-api.ts`
- Assistant channel contract: `src/shared/contracts/assistant-ipc.ts`
- Main core entry: `src/main/core/devscope-core.ts`
- Main IPC handlers: `src/main/ipc/handlers.ts`
- Electron preload composition: `src/preload/devscope-electron-adapter.ts`
- Renderer consumption surface: `window.devscope` via `src/preload/index.ts`

## Working Rule

When adding new capabilities, update contracts first, then adapters, then each client surface.
