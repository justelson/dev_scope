# Repo Boundaries

Last updated: March 19, 2026

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

## Refactor Guidance

- If a change crosses `main`, `preload`, and `renderer`, define the shared contract shape first.
- If logic is duplicated across `main` and `renderer`, look for a `src/shared` extraction.
- If a file grows materially past the repo guidance threshold, split it by responsibility instead of appending more local logic.

## When To Update This Doc

Update this file when:

- runtime ownership changes
- a new cross-process boundary is introduced
- preload/main/renderer responsibilities materially shift
