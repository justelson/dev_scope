# Git / PR Brainstorm Note

Date: March 11, 2026
Status: brainstorming only, not final implementation spec
Purpose: preserve the current Git/PR architecture discussion so a new chat can continue from the same baseline

## Core Product Direction

The PR flow should be simple by default.

The app should not make the user reason about internal workflow states like `automation mode`.
Instead, the app should infer the execution plan from the repo state and show that plan clearly.

The default PR flow should focus on:
- changes to include
- head branch
- target branch
- PR guide source / config
- optional draft editing

Everything else should be automatic or moved behind advanced controls.

## Remove Automation Mode

Current thought:
- `automation mode` is probably unnecessary as a visible user-facing layer

Reason:
- If the user clicks `Create PR` or `Open PR`, the app can determine the needed steps from repo state
- Users should not have to understand `safe` vs `fast`

Preferred replacement:
- show a plain execution summary instead of an abstract mode

Example execution summary:
- Will include unstaged changes
- Will stage 3 files
- Will commit changes
- Will push branch to upstream
- Will open draft PR on GitHub

## Change Sources the PR Flow Should Support

The PR flow should support selecting:
- unstaged changes
- staged changes
- local commits
- all local work

This means the PR flow should be able to stage/commit/push from inside the PR experience instead of forcing the user to prepare Git state manually first.

Desired behavior:
- unstaged only -> stage selected/all unstaged first
- staged only -> commit staged changes
- local commits only -> push selected commit range or full branch
- all local work -> combine unstaged + staged + local commits into one execution plan

## Ownership vs Permission

Important decision:
- do not check only whether the user is the repo owner
- check whether the current GitHub account has push permission to the upstream repo

Correct model:
- owner is not the right rule
- collaborator / maintainer / org member may not own the repo but can still push directly

So the app should ask:
- Which GitHub account is active?
- Can this account push to the upstream repo?
- Can this account open a PR against this repo?
- If not, should the app fork first?

## Direct Push vs Fork Flow

Desired top-level decision tree:

1. Detect active GitHub account
2. Detect upstream repo from remote URL
3. Check upstream push permission for that account
4. If push allowed:
   - normal branch PR flow
5. If push not allowed:
   - fork flow

This should be permission-based, not owner-based.

## Fork Flow

If the current GitHub account cannot push to upstream, the app should support a first-class fork flow.

Ideal fork flow:
1. Detect that upstream is not writable by the active GitHub account
2. Offer `Fork and continue`
3. Create the fork under the user account
4. Configure remotes automatically
5. Create a branch on the fork
6. Commit and push there
7. Open a PR from fork branch to upstream target branch

Remote model:
- `upstream` = original repo
- `origin` or `fork` = user-controlled writable fork

The app should be able to normalize this setup automatically.

## Git vs GitHub Responsibilities

Clarified in discussion:
- Git itself does not manage platform-level collaborator permissions
- GitHub is what manages:
  - repo ownership
  - collaborators
  - org/team permissions
  - forks
  - pull requests

So:
- Git handles commits/branches/history
- GitHub permissions determine whether direct push or fork flow is required

## Multiple Users / Accounts

Git does not have a clean built-in "multiple active users in one repo" UX layer.

Git supports:
- per-repo `user.name`
- per-repo `user.email`
- multiple remotes

But for the product UX we want, the app likely needs its own account-aware GitHub layer.

The app should manage:
- active GitHub account
- permission detection per repo
- fork existence detection
- remote normalization
- branch destination choice
- PR target selection

## Better PR UX Model

Recommended primary action:
- `Create PR`

Then let the app decide the path:
- direct push flow if writable
- fork flow if not writable
- auto-generate draft if blank
- use custom draft if provided
- include unstaged/staged/local commits based on user selection

This is better than exposing too many internal switches.

## Modal / UI Notes

Problems observed:
- nested PR-related modals were inheriting parent constraints
- child modals were being clipped by parent limits
- some nested modals auto-closed unexpectedly

Product/UI rule going forward:
- child modals should behave as proper top-level overlays
- they should not be clipped by the main PR modal shell
- each modal should have an explicit close button
- modal close behavior should be stable and predictable

## Planned PR Simplification Direction

Main PR modal should be minimal and probably contain only:
- change source
- head branch
- target branch
- PR config source
- create/open action

Optional separate UI:
- draft editor modal
- advanced configuration modal
- fork setup/permission explanation modal if needed

## Large-Scale Automation Direction

At scale, the PR flow should be driven by an execution planner.

The planner should decide:
- whether unstaged changes need staging
- whether staged changes need committing
- whether commits need pushing
- whether direct push is allowed
- whether a fork is required
- whether the draft should be generated automatically

Then the app should show the user a plain human-readable plan instead of low-level workflow toggles.

## To Push Integration

The `To Push` tab should not keep its own separate publish logic.

It should use the same permission and execution planner as PR creation.

Current direction:
- do not hardcode `origin` push assumptions in the UI layer
- do not make `To Push` decide fork behavior on its own
- do not duplicate permission logic between `To Push` and `Create PR`

Instead:
- `To Push` should ask the shared planner what the publish path is
- the planner should return:
  - direct push
  - publish branch
  - fork and push
  - blocked
- the UI should render that plan clearly before any remote mutation

## Shared Git Publish Planner

This should likely live below the UI and be reusable by both:
- `To Push`
- `Create PR`

Recommended responsibilities:
- detect active GitHub account
- parse the upstream repository from remotes
- check push permission for the current account
- detect whether a fork already exists
- decide whether to push directly, publish branch, or fork first
- normalize remote strategy safely
- return a human-readable execution summary

This is the main reuse layer that keeps Git behavior consistent across the app.

## Safe Remote Strategy

The planner should not blindly rewrite remotes.

It should:
- inspect the existing remote setup
- preserve valid custom setups where possible
- decide whether `origin` should remain upstream or become the writable fork
- support a deterministic fallback remote like `fork` when needed

The user should be shown what the app is about to do before mutating remotes, especially in fork mode.

## To Push UX Direction

The `To Push` tab should evolve from:
- `Push All Commits`
- `Push Up To Here`

Into a permission-aware publish surface:
- if upstream push is allowed -> normal push flow
- if the branch only needs publishing -> publish branch
- if upstream push is not allowed -> offer fork and push
- if the repo state is blocked -> show the exact blocker

This should make `To Push` safe to use even when the repo is not directly writable by the active account.

## Recommended Next Implementation Spec

If work resumes in a new chat, the next step should be a real implementation spec for:

1. GitHub account and permission detection
2. Direct-push vs fork execution planner
3. PR change-source model including unstaged changes
4. Shared `To Push` and `Create PR` publish planner integration
5. Simplified PR modal state machine
6. Stable modal layering rules

## Short Carry-Forward Summary

If continuing from another chat, use this summary:

- Remove visible `automation mode`
- Support unstaged changes directly in PR flow
- Use collaborator permission detection, not owner detection
- If push allowed, use normal PR flow
- If push not allowed, use automatic fork flow
- Make `To Push` use the same publish planner as `Create PR`
- Build an execution planner that decides stage/commit/push/fork/generate steps
- Keep the main PR UI minimal and move extras behind optional flows
