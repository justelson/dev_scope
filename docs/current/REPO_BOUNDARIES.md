# Repo Boundaries

Last updated: April 28, 2026

This document is the focused layer-boundary reference for day-to-day engineering work.

Use it together with:

- `docs/current/CURRENT_CODEBASE_ARCHITECTURE.md`
- `docs/current/CHANGE_SCOPE_GUIDELINES.md`

## Runtime Ownership

- `src/main`
  - Electron main-process logic
  - IPC registration
  - native integrations
  - update orchestration
  - filesystem/process coordination
- `src/preload`
  - narrow renderer bridge adapters only
  - keep explicit and small
- `src/renderer/src`
  - UI
  - route/view state
  - interaction flows
  - no native or filesystem logic
- `src/shared`
  - shared contracts
  - cross-process types
  - reusable utilities needed in more than one runtime
- `apps/landing/devscope-web`
  - marketing/landing client only
  - do not couple to Electron-only runtime code

## Boundary Rules

- Do not push native, process, or filesystem behavior into renderer components.
- Keep preload thin. If preload starts carrying domain logic, move that logic back into main/shared.
- Keep IPC handlers thin. Put domain logic in services/core modules.
- Prefer shared contracts over duplicated main/renderer types.
- Preserve the landing app as a separate client surface.
- Keep installed-runtime detection in main-process IPC/services. Renderer settings may display and choose runtimes, but should not perform command/path discovery directly.
- Keep Playground no-lab terminal-access and lab-setup decisions contract-driven through assistant send/user-input options, not ad hoc renderer-only state.
- Keep repository clone orchestration, filesystem writes, and clone progress emission in main-process services/IPC. Renderer folder-browse surfaces should only request the operation and render streamed progress.
- Keep clipboard attachment resolution behind assistant IPC. Renderer prompt serialization may pass safe `clipboard://` references, but should not expose local attachment-storage paths as the model's cwd, project root, or direct prompt path.

## Refactor Guidance

- If a change crosses `main`, `preload`, and `renderer`, define the shared contract shape first.
- If logic is duplicated across `main` and `renderer`, look for a `src/shared` extraction.
- If a file grows materially past the repo guidance threshold, split it by responsibility instead of appending more local logic.

## When To Update This Doc

Update this file when:

- runtime ownership changes
- a new cross-process boundary is introduced
- preload/main/renderer responsibilities materially shift
