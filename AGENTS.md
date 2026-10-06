# DevScope Agent Instructions

DevScope Air is the active Windows Electron desktop app in this repository. It is a projects-first developer workspace with project discovery, file browsing, Git workflows, assistant sessions, terminal management, settings, and release/update flows.

Treat this repo as a real desktop runtime, not a landing site or prototype. Protect assistant/runtime reliability, app-shell performance, and the Electron boundary split before cosmetic changes.

## Project Snapshot

- DevScope Air is the primary Windows Electron desktop app in this repository.
- The repository root is the desktop app and release target.
- `apps/landing/devscope-web` is a separate landing site, not the desktop runtime.
- This repo is still evolving. Strong maintainability refactors are encouraged when they reduce duplication or improve reliability.

## Operating Contract

- Trace source of truth before changing behavior: main/preload/shared/renderer boundary -> store/hook -> component -> rendered state.
- Keep assistant/session work grounded in the Codex app-server integration and persisted assistant state, not only renderer presentation.
- For project/file browsing, Git, assistant runtime, settings, updater, or terminal behavior, verify the real runtime path before calling the work done.
- Prefer compact, durable desktop UI over marketing-style layout or decorative helper copy.

## Required Context Routing

Read the minimum relevant file set before acting on non-trivial work.

- Start with `docs/current/README.md` for active repo guidance.
- For branch choice, release-prep placement, or deciding between `main` and `dev`, read `docs/current/BRANCH_WORKFLOW.md`.
- For architecture, layering, refactors, or moving logic between runtimes, read:
  - `docs/current/CURRENT_CODEBASE_ARCHITECTURE.md`
  - `docs/current/REPO_BOUNDARIES.md`
- For release, version, tag, publish, updater metadata, GitHub release, or landing download tasks, read:
  - `.codex/skills/devscope-release/SKILL.md`
  - every doc referenced by that skill
- For assistant UI or app-chrome styling tasks involving borders, dividers, separators, sidebars, modals, dropdowns, headers, resize handles, compact states, or timeline guides, read:
  - `.codex/skills/devscope-ui-standards/SKILL.md`
  - every doc referenced by that skill

## Core Priorities

1. Performance first.
2. Reliability first.
3. Keep behavior predictable under load and during failures (session restarts, reconnects, partial streams).

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Maintainability

Long-term maintainability is a core priority.

- First check whether shared logic can be extracted instead of duplicated.
- Duplicate logic across multiple files is a code smell.
- Do not solve problems by appending isolated local logic when a shared abstraction is the better fit.
- Keep new or heavily edited source files under roughly 500 lines when practical.
- If a change would push a file materially beyond that, split it into smaller focused modules instead of leaving it oversized.

## Change Scope

- Prefer small, focused changes that solve the requested problem directly.
- Do not mix unrelated fixes into the same implementation unless required for correctness.
- If a change grows beyond the original request, call that out explicitly.
- For non-trivial UI changes, if visual verification is not performed, say that clearly.

## Build/Test Permission

- Do not run rebuilds, full builds, or test suites unless the user explicitly re-approves in the current session.
- If validation is needed, prefer lightweight checks unless build/test permission is granted.

## Validation Defaults

Default post-edit validation for this repo is `bun run typecheck` before reporting completion, unless the user explicitly says to skip validation for that edit.

If broader validation is needed, prefer the lightest useful command first:

1. `bun run typecheck`
2. targeted package/app-specific checks
3. full builds only when necessary for the requested change

After edits, run the lightweight syntax/type validation check before informing the user that the work is done, unless they explicitly asked to skip it.

If validation is skipped because permission was not granted, say that explicitly in the final response.

## Agent/Escalation Permission

- Commands requiring agent/escalated privileges may need fresh approval in a new session.
- If a required command is blocked by sandbox or permissions, request approval before proceeding.

## Architecture Guardrail

Respect the runtime split:

- `src/main`: Electron main-process logic, IPC registration, native integrations, update orchestration, and filesystem/process coordination
- `src/preload`: narrow renderer bridge adapters only
- `src/renderer/src`: UI, route/view state, and interaction flows
- `src/shared`: shared contracts, types, and reusable cross-process utilities
- `apps/landing/devscope-web`: landing client only

Read `docs/current/REPO_BOUNDARIES.md` before making boundary-sensitive changes.
