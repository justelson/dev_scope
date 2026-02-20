# Refactor Program: Phase 0 + Phase 1

This document establishes guardrails before any feature-preserving refactor.

## No-Change Contract

- Keep the exact same UI layout, styles, spacing, and interactions.
- Keep all existing route paths unchanged.
- Keep all existing IPC channel names unchanged.
- Keep current behavior of project scanning, script run, terminal launching, and Git flows unchanged.
- Refactor only structure and file boundaries in upcoming phases.

## LOC Standard

- Warning threshold: `>300` lines.
- Hard limit: `>500` lines.
- Target limits:
  - Page/container files: `<=350`.
  - Main-process service files: `<=350`.
  - Reusable components/hooks/utils: `<=220`.
- Enforcement:
  - `npm run maint:loc` => report-only.
  - `npm run maint:loc:strict` => fails if any file is `>500`.

## Baseline Validation Checklist

Run before and after each refactor phase:

1. `npm run build`
2. Launch app and verify:
   - Home loads without crash.
   - Projects page loads and opens project details.
   - Project details scripts section opens run modal and can run command.
   - Git section can stage/commit/push (when repo has changes/remotes).
   - Settings pages open normally.
3. Confirm no route regressions:
   - `/home`
   - `/projects`
   - `/projects/:projectPath`
   - `/settings/*`

## Initial High-Priority Refactor Targets

- `src/renderer/src/pages/ProjectDetails.tsx`
- `src/main/ipc/handlers.ts`
- `src/main/inspectors/git.ts`
- `src/renderer/src/pages/Projects.tsx`
- `src/shared/tool-registry.ts`

