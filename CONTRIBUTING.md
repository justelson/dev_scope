# Contributing

DevScope Air is still evolving quickly. Contributions are welcome, but the changes most likely to land are the ones that are small, focused, and easy to verify.

Before opening a PR, read:

- `AGENTS.md`
- `docs/current/README.md`

## What Is Most Useful

- small bug fixes
- reliability improvements
- performance improvements
- maintainability refactors that reduce duplication without changing product direction
- tightly scoped UI polish that preserves the existing visual language

## What To Avoid

- large mixed-scope PRs
- unrelated fixes bundled together
- speculative feature expansion without prior discussion
- rewrites that do not clearly improve correctness, reliability, or maintainability

## Before Opening A PR

1. Keep the change focused.
2. Explain exactly what changed.
3. Explain why the change should exist.
4. Call out anything you did not verify.
5. Update relevant docs when behavior or workflow changes.

## UI Changes

If the PR changes visible UI behavior, include:

- before/after screenshots for layout or styling changes
- short video or GIF if motion, transitions, or interaction timing matters

## Validation

Run the lightest useful validation for the change and say what you ran.

For this repo, useful validation usually starts with:

- `npm run typecheck`
- targeted checks for the specific area you changed

Do not treat a change as verified if you did not actually run the checks.

## Release And Packaging Changes

If you touch release, packaging, or update flow:

- read `docs/current/RELEASE_VERSIONING.md`
- read `docs/current/RELEASE_OPERATIONS_PLAYBOOK.md`
- verify that release assets and local `dist` output still follow the documented layout

## Non-Trivial Changes

For larger changes, open an issue or start a discussion first. That is especially important for:

- architecture changes
- release workflow changes
- settings/data model changes
- broad UI direction changes
