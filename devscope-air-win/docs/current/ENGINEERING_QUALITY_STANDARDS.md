# Engineering Quality Standards

Last updated: February 23, 2026

This document defines engineering quality expectations for the current DevScope Air codebase.

## Quality Goals

1. Preserve user-visible behavior unless change is intentional.
2. Keep architecture direction contract-first and adapter-thin.
3. Avoid regressions in streaming UX, project browsing, and git workflows.
4. Keep changes verifiable even when full builds are not allowed.

## Layer-Specific Standards

### Shared Contracts (`src/shared/contracts/*`)

- Treat contract files as source-of-truth API surface.
- Prefer additive changes over breaking shape changes.
- Keep operation names stable and explicit.
- Ensure success/error envelope consistency (`success: true|false` pattern).

### Preload Adapters (`src/preload/*`)

- Keep adapters transport-focused (`ipcRenderer.invoke` wiring).
- Do not add domain logic in preload.
- Keep API shape aligned to `DevScopeApi`.
- Keep unsupported Air capabilities explicitly stubbed rather than silently missing.

### IPC Handlers (`src/main/ipc/handlers/*`)

- Keep handlers thin: validate inputs, delegate to core/services, normalize responses.
- Avoid embedding complex domain behavior in handler modules.
- Use structured logging for failure and workflow boundaries.

### Core + Services (`src/main/core`, `src/main/services`)

- Place domain rules and orchestration here.
- Use deterministic input/output contracts.
- Centralize caching and deduping logic at service boundaries.

### Renderer (`src/renderer/src/*`)

- Keep UI state and async state explicit (`loading`, `error`, `empty` must not conflict).
- Avoid blocking interactions on background operations.
- Preserve theming and accessibility affordances in control updates.
- Ensure metadata (session titles, counts, badges) does not leak into message content.

## Reliability Standards

- Loading states must not flicker into incorrect empty states.
- Stale async requests must not overwrite newer request state.
- Background indexing/search behavior must remain non-blocking and deduped.
- Session metadata updates must be one-time and out-of-band.

## Performance Standards

- Prefer cache + in-flight dedupe over repeated expensive calls.
- Keep startup work deferred/background where possible.
- Avoid repeated indexing/scans from UI interactions when index exists.

## Observability Standards

- Log important transitions at service/handler boundaries.
- Log error paths with enough context to diagnose route/capability.
- Avoid noisy logs inside hot render paths.

## Definition Of Done (Engineering Quality)

A change is quality-complete when:

1. Contract impact is explicit and documented.
2. Async state behavior is correct under race conditions.
3. No known regression in current capability matrix.
4. Validation evidence is captured (see checklist document).
5. Relevant docs in `docs/current/*` are updated.
