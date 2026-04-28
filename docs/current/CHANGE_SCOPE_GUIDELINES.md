# Change Scope Guidelines

Last updated: April 28, 2026

This document defines how changes should be shaped before implementation and how they should be reported afterward.

Use this together with:

- `docs/current/ENGINEERING_QUALITY_STANDARDS.md`
- `docs/current/CHANGE_VALIDATION_CHECKLIST.md`

## Scope First

Prefer changes that are:

- small
- direct
- easy to verify
- easy to revert if needed

Avoid mixing unrelated fixes in the same workstream unless they are required to make the requested change correct.

## Good Scope

Good scope examples:

- one release-flow fix plus the minimal supporting script changes
- one UI bug fix plus the shared utility extraction it genuinely needs
- one data-flow correctness fix plus the contract update it depends on
- one filesystem-backed UI flow plus the shared contract and service update it depends on

Bad scope examples:

- fixing a release link and also redesigning unrelated UI
- changing app state flow and also refactoring unrelated settings pages
- bundling cleanup work with unrelated product features
- pushing prompt-visible local file paths into model context when a scoped reference/resolution path is enough

## Architecture Guardrails

Before expanding a change, check whether the logic belongs in:

- `src/shared` for shared contracts/types/utilities
- `src/main` for native/Electron/process/filesystem orchestration
- `src/preload` for narrow transport adapters only
- `src/renderer/src` for UI and view state only
- `apps/landing/devscope-web` for marketing/release download behavior only

For clone, attachment, Git, and preview flows, keep the owning layer explicit:

- clone and filesystem mutation orchestration belongs in `src/main`
- prompt-safe attachment references belong in shared assistant contracts plus main/preload adapters
- preview rendering and Git action UI belongs in `src/renderer/src`

If a change crosses layers, the reason should be clear.

## UI Change Expectations

For non-trivial UI changes:

- keep visual changes intentional and scoped
- preserve alignment, states, and responsiveness
- call out when visual verification was not performed

Do not imply a UI was fully verified if no visual check happened.

## Validation Expectations

Follow repo permission rules from `AGENTS.md`.

If validation is allowed:

1. start with the lightest useful command
2. run targeted checks before broad checks
3. run full builds only when they are necessary

If validation is not allowed:

- say that clearly in the final response

## Reporting Expectations

After implementing a change:

- describe what changed
- describe what was not verified
- describe any blockers or environmental issues
- describe any follow-up risk that remains

If a local process, file lock, or remote service issue blocked part of the task, say so directly.

## Documentation Expectations

When a change affects recurring workflow, architecture, or release behavior:

- update `docs/current/*` in the same workstream
- prefer a focused doc/playbook over bloating `AGENTS.md`
- keep `AGENTS.md` as short operational rules and use docs for full procedures
