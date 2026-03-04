# DevScope Win Deprecation Plan

Status: Proposed  
Decision date: March 4, 2026  
Scope: `C:\Users\elson\my_coding_play\devscope\devscope-win`

## Decision

Deprecate `devscope-win` as the primary product track and move all active development to `devscope-air-win`.

`devscope-win` will enter maintenance-only mode first, then be archived after a defined support window.

## Why This Plan

1. `devscope-air-win` is already the active variant in repo docs and current development flow.
2. Recent feature velocity is concentrated in `devscope-air-win`.
3. Running two app variants as equal products increases release, QA, and documentation overhead.
4. Current roadmap is centered on projects-first UX, mobile companion, and remote access architecture.

## Scope Boundaries

In scope:
1. Product/release deprecation for `devscope-win`.
2. Documentation and migration guidance.
3. CI/release adjustments to stop `devscope-win` distribution after cutoff.
4. Repository archival strategy for `devscope-win`.

Out of scope:
1. Immediate deletion of `devscope-win` source history.
2. Rebuilding full terminal/AgentScope product parity in Air during deprecation.

## Timeline (Proposed)

1. March 4, 2026: Publish deprecation notice and this plan.
2. March 8, 2026: Start maintenance-only mode for `devscope-win` (critical fixes only).
3. April 15, 2026: Stop producing new `devscope-win` release artifacts.
4. May 1, 2026: Archive `devscope-win` in-repo (read-only code path, no active roadmap).

## Work Plan

### Phase 1: Announce + Align

1. Update root and variant READMEs to clearly mark `devscope-win` as deprecated.
2. Add migration note that `devscope-air-win` is the only active path.
3. Share exact support cutoff dates in release notes/changelog.

### Phase 2: Maintenance-Only Window

1. Accept only security/critical bug fixes in `devscope-win`.
2. Block feature work in `devscope-win`.
3. Keep all new roadmap work in `devscope-air-win`.

### Phase 3: Release Cutoff

1. Disable `devscope-win` packaging/release jobs in CI.
2. Keep source available for reference during archive transition.
3. Tag final supported `devscope-win` revision (for rollback and support).

### Phase 4: Archive

1. Mark `devscope-win` as archived in docs and folder header note.
2. Keep code read-only by policy (no active PR target).
3. Maintain historical tags and changelog references.

## Risks and Mitigations

1. Risk: Existing users still depend on full in-app terminal/AgentScope.
   Mitigation: Explicitly document what is retired vs what remains available in Air.
2. Risk: Confusion from two variants in docs and onboarding.
   Mitigation: Make Air the only default in every quick-start path.
3. Risk: Surprise from abrupt cutoff.
   Mitigation: Keep a published maintenance window with fixed dates.

## Exit Criteria

1. All default docs/onboarding point to `devscope-air-win`.
2. `devscope-win` receives no new feature commits after maintenance-only start.
3. Release pipeline no longer publishes `devscope-win` installers after cutoff.
4. Archive status is visible at root and variant-level docs.
