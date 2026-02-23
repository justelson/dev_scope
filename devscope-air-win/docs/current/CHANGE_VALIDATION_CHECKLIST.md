# Change Validation Checklist

Last updated: February 23, 2026

Use this checklist for PRs/patches in the current DevScope Air codebase.

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
  - `/assistant`
  - `/projects`
  - `/projects/:projectPath`
  - `/folder-browse/:folderPath`
- Verify buttons/controls are aligned and responsive after UI changes.
- Verify copy/open/refresh actions continue working for path-based flows.

## 4) Data + Indexing Check

- Ensure indexing runs in background when expected.
- Ensure search uses index data rather than repeated full scans.
- Ensure repeated user actions do not trigger unnecessary re-indexing.

## 5) Validation Execution

Given current repo policy in `AGENTS.md`:

- Do not run full builds/tests unless explicitly approved in-session.
- Run lightweight validation by default (targeted syntax/transpile checks).

Suggested lightweight checks:

```bash
node -e "const ts=require('typescript');const fs=require('fs');const p='path/to/file.tsx';const src=fs.readFileSync(p,'utf8');const out=ts.transpileModule(src,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020},reportDiagnostics:true,fileName:p});if((out.diagnostics||[]).length){process.exit(1)}"
```

If full validation is explicitly approved:

```bash
npm run build
```

## 6) Documentation Check

- Update `docs/current/*` for behavior/architecture changes.
- If replacing older guidance, move old docs to `docs/legacy/*`.
- Keep migration note in `docs/current/DOCS_REFACTOR_2026-02-23.md` when restructuring docs.
