# Agent Session Constraints

These constraints were explicitly set by the user and should be treated as active defaults in this repo.

## Project Snapshot
- DevScope Air is the primary Windows Electron desktop app in this repository.
- The repository root is the desktop app and release target.
- `apps/landing/devscope-web` is a separate landing site, not the desktop runtime.
- This repo is still evolving. Strong maintainability refactors are encouraged when they reduce duplication or improve reliability.

## Branch Workflow
- `main` should stay stable, intentional, and releasable.
- `dev` is the active branch for rapid iteration, in-progress app work, cleanup, and exploratory changes.
- Tag and publish releases from `main`, not from `dev`.
- Prefer landing/docs/process/infrastructure changes on `main` when they are stable on their own.
- Prefer active renderer/app feature work on `dev` until it is ready to merge back into `main`.
- Do not mix unrelated `dev` app work into `main` release-prep commits.

## Core Priorities
1. Performance first.
2. Reliability first.
3. Keep behavior predictable under load and during failures (session restarts, reconnects, partial streams).

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Maintainability
Long term maintainability is a core priority. If you add new functionality, first check if there are shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.

## Change Scope
- Prefer small, focused changes that solve the requested problem directly.
- Do not mix unrelated fixes into the same implementation unless they are required to make the requested change correct.
- If a change grows beyond the original request, call that out explicitly instead of silently broadening scope.
- For non-trivial UI changes, if visual verification is not performed, say that clearly instead of implying the UI was fully checked.

## Build/Test Permission
- Do **not** run rebuilds, full builds, or test suites unless the user explicitly re-approves in the current session.
- If validation is needed, prefer lightweight checks (for example, targeted syntax/transpile checks) unless build/test permission is granted.

## Validation Defaults
- If the user explicitly re-approves validation, prefer the lightest useful command first.
- Default validation order:
  1. `npm run typecheck`
  2. targeted package/app-specific checks
  3. full builds only when they are necessary for the requested change
- After every edit, run a lightweight syntax/type validation check when permission for validation has been granted in the current session.
- If validation is skipped because permission was not granted, say that explicitly in the final response.

## Agent/Escalation Permission
- Commands requiring agent/escalated privileges may need fresh approval in a new session.
- If a required command is blocked by sandbox/permissions, request approval before proceeding.

## Architecture Boundaries
- `src/main`: Electron main-process logic, IPC registration, native integrations, update orchestration, and filesystem/process coordination.
- `src/preload`: narrow renderer bridge adapters only. Keep this layer small and explicit.
- `src/renderer/src`: UI, view state, and interaction flows. Do not push native or filesystem logic into renderer components.
- `src/shared`: shared contracts, types, and reusable cross-process utilities. Prefer putting shared logic here instead of duplicating it in main and renderer.
- `apps/landing/devscope-web`: marketing/landing experience only. Keep release/download behavior aligned with GitHub releases, but do not couple it to desktop-only runtime code.

## Release Distribution Rules
- Landing-page download buttons must resolve the newest GitHub release asset dynamically. Do **not** hardcode versioned `releases/download/...` URLs in the landing app.
- GitHub release names must follow the established desktop pattern: `DevScope Air <package-version>`.
  - Example: tag `v1.5.0-alpha.3` should publish as release name `DevScope Air 1.5.0-alpha.3`.
  - Do not leave the release name as the raw tag unless that pattern has explicitly changed across existing releases.
- When discussing or displaying prerelease versions, treat `alpha.<n>` / `beta.<n>` as the major preview iteration.
  - The base `x.y.z` SemVer portion is the smaller refinement level attached to that preview step.
  - Example: `1.5.0-alpha.5` should be understood as `Alpha 5 (v1.5.0)`, not as a channel inferred from the leading major number.
- When choosing the next preview version:
  - Small changes keep the same `alpha.<n>` / `beta.<n>` suffix and only bump the base version.
  - Major preview changes increment the prerelease suffix and reset the base version to `1.0.0`.
  - Do not reset the leading `1`.
  - Example progression:
    - `1.5.0-alpha.5` -> small change -> `1.5.1-alpha.5`
    - `1.5.0-alpha.5` -> major preview change -> `1.0.0-alpha.6`
- Release artifacts must be organized by version:
  - Installers and update metadata go under `dist/releases/v<package-version>/`
  - Unpacked app bundles go under `dist/unpacked/v<package-version>/`
- Avoid dropping versioned installers, blockmaps, `latest.yml`, or builder config files directly in the `dist` root unless it is a temporary manual recovery step.
- If a release, cleanup, move, delete, or organization step is blocked by a running local process, file lock, or other machine-side issue, the assistant must say that clearly and identify what needs to be stopped or changed on the user's side.
- For release tasks, verify the final published release state instead of assuming a tag push was enough.
  - Confirm the GitHub release exists.
  - Confirm expected Windows release assets exist: installer `.exe`, `latest.yml`, and `.blockmap`.
  - If the release workflow fails remotely, surface the exact remote blocker before attempting workarounds.

## Assistant UI Notes
- For subtle separators, dividers, and timeline guides in the assistant UI, do **not** use plain border-token lines by default.
- Prefer rebuilt soft guides using gradients or very low-contrast custom strokes, and verify they are actually visible in the current theme instead of assuming opacity values are sufficient.
- When matching an existing subtle line treatment, copy its visual behavior first: centered fade, shortened span, and soft middle emphasis rather than a full hard edge.

## Border Styling Standards
- **CRITICAL**: All borders in the application MUST use the white border pattern, NOT `border-sparkle-border` tokens.
- The standard border pattern used throughout the app (reference: ProjectDetailsHeaderSection.tsx):
  - Default borders: `border-white/10`
  - Hover borders: `hover:border-white/20`
  - Subtle/divider borders: `border-white/5`
  - Very subtle borders (compact mode): `border-white/6` to `border-white/8`
  - Background with borders: `bg-sparkle-card` or `bg-white/[0.03]`
  - Hover backgrounds: `hover:bg-white/[0.03]` or `hover:bg-white/10`
- When working on ANY UI component with borders:
  1. First check ProjectDetailsHeaderSection.tsx for the reference pattern
  2. Use EXACT same border values (border-white/10, hover:border-white/20, etc.)
  3. Apply consistently across ALL states: default, hover, active, collapsed, expanded
  4. Never mix `border-sparkle-border` with `border-white/*` - use white borders exclusively
- Components that MUST follow this pattern:
  - Assistant sidebar (both compact and non-compact modes)
  - All buttons and interactive elements
  - Modal dialogs and dropdowns
  - Session avatars and list items
  - Dividers and separators
  - Resize handles
- When fixing border issues:
  - Search for ALL instances of `border-sparkle-border` in the component
  - Replace with appropriate `border-white/*` values
  - Check both compact and non-compact modes
  - Verify collapsed and expanded states
  - Test hover and active states
