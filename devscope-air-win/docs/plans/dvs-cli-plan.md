# DevScope CLI Plan (`dvs`)

Status: planning only, not implemented yet.

## Goal

Add a first-party CLI named `dvs` that reuses DevScope core logic (scan/git/ai) from the existing codebase.

## Non-Goals (for MVP)

- No TUI yet.
- No daemon/background service.
- No full parity with every Electron feature in v1.

## CLI Shape

Pattern:

```bash
dvs <area> <action> [args] [flags]
```

## MVP Commands

1. `dvs scan <path>`
2. `dvs git status <repo>`
3. `dvs git stage <repo> <files...>`
4. `dvs git commit <repo> -m "<message>"`
5. `dvs git push <repo>`
6. `dvs ai commit-msg <repo>`
7. `dvs doctor`

## UX Rules

- Human-friendly output by default.
- `--json` output for automation (where practical).
- Clear non-zero exit codes on failure.
- Error messages should be action-oriented and short.

## Architecture Plan

## Reuse Existing Core

- Prefer direct reuse from:
  - `src/main/inspectors/*`
  - `src/main/ai/*`
- Avoid going through Electron IPC for CLI.

## New CLI Entry

- Add `src/cli/index.ts` as the CLI entrypoint.
- Add command modules under `src/cli/commands/*`.
- Add shared formatter helpers under `src/cli/format/*`.

## Dependency Direction

- CLI -> shared/core modules.
- Electron main stays separate from CLI command parsing.

## Packaging Plan

- Add bin mapping in `package.json`:
  - `"dvs": "out/cli/index.js"` (or equivalent final output path)
- Keep run modes:
  - dev: `bun run` / `node` execution
  - prod: built JS executable entry

## Phased Implementation

## Phase 1: Scaffold

- Create CLI entrypoint.
- Add argument parser.
- Add `dvs doctor`.

## Phase 2: Git Surface

- Add `status`, `stage`, `commit`, `push`.
- Reuse current git write/read safety behavior (including lock handling).

## Phase 3: Scan Surface

- Add `dvs scan <path>`.
- Support both readable and `--json` output.

## Phase 4: AI Commit Message

- Add `dvs ai commit-msg <repo>`.
- Reuse provider/model settings and quality rules.

## Phase 5: Hardening

- Exit code normalization.
- Help text polishing.
- Error/path edge-case handling on Windows.

## Acceptance Criteria

- Commands run on Windows repo paths with spaces.
- Git lock conflict flow is handled cleanly.
- `--json` mode is stable for scripting.
- Output is concise and useful in terminal history.

## Open Questions (to resolve before build)

1. Should `dvs` always read GUI settings, or allow separate CLI config?
2. Should AI commands require explicit provider flag, or use defaults first?
3. Should commit message generation include staged-only diff by default?
4. Should `dvs scan` recurse by default, and what depth limit should apply?

## Example Session (Target)

```bash
dvs doctor
dvs scan "C:\Users\elson\my_coding_play\devscope"
dvs git status "C:\Users\elson\my_coding_play\devscope\devscope-air-win"
dvs ai commit-msg "C:\Users\elson\my_coding_play\devscope\devscope-air-win"
dvs git commit "C:\Users\elson\my_coding_play\devscope\devscope-air-win" -m "feat: ..."
dvs git push "C:\Users\elson\my_coding_play\devscope\devscope-air-win"
```

