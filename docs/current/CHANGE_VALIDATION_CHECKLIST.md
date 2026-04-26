# Change Validation Checklist

Last updated: April 26, 2026

Use this checklist for PRs/patches in the current DevScope desktop codebase.

## 1) Scope + Architecture Check

- Confirm touched files match intended scope.
- Confirm no accidental cross-layer coupling was introduced.
- If API surface changed, verify `src/shared/contracts/*` was updated intentionally.

## 2) State Safety Check

- Validate loading/error/empty states do not conflict.
- Validate stale requests cannot reset active request state.
- Validate metadata updates are not rendered as chat content.

## 3) UX Regression Check

- Verify key routes still function:
  - `/home`
  - `/projects`
  - `/projects/:projectPath`
  - `/folder-browse/:folderPath`
  - `/assistant`
  - `/terminals`
  - `/settings/about`
- If enabled in settings, verify:
  - `/explorer`
- Verify buttons/controls are aligned and responsive after UI changes.
- Verify copy/open/refresh actions continue working for path-based flows.
- Verify markdown/file-reference links still resolve Windows absolute paths, `file://` links, relative links, and line anchors into the shared preview flow.
- Verify compatibility redirects still resolve cleanly instead of throwing renderer errors.

## 4) Data + Indexing Check

- Ensure indexing runs in background when expected.
- Ensure search uses index data rather than repeated full scans.
- Ensure repeated user actions do not trigger unnecessary re-indexing.
- Ensure assistant streaming updates with repeated activity IDs collapse instead of causing timeline churn.

## 5) Validation Execution

Given current repo policy in `AGENTS.md`:

- Do not run full builds/tests unless explicitly approved in-session.
- Prefer the lightest useful validation first.

Suggested default order when validation is approved:

1. `bun run typecheck`
2. targeted package/app-specific checks
3. full builds only when necessary

If full validation is explicitly approved:

```bash
bun run typecheck
bun run build
```

## 6) Documentation Check

- Update `docs/current/*` for behavior/architecture changes.
- If replacing older guidance, move it into the archive flow documented under `docs/archive/`.
- Keep the live docs tree limited to current guidance plus supporting reference docs.
