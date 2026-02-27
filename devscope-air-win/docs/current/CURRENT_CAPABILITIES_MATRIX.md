# Current Capabilities Matrix

Last validated: February 23, 2026

This matrix reflects the currently exposed DevScope Air capabilities from the shared contract and adapters.

## Legend

- `Implemented`: available and wired in main/preload/renderer.
- `Air-Limited`: intentionally stubbed or limited in Air variant.
- `Planned`: design docs exist but not first-class product surface yet.

## Capability Areas

### System + Environment

- System overview/stats/readiness: `Implemented`
- Shared metrics bootstrap/subscribe/read: `Implemented`
- Developer tooling sensing: `Implemented`

### Projects + File Browsing

- Folder selection and project scan: `Implemented`
- Recursive indexing across roots: `Implemented`
- Project details read model: `Implemented`
- File tree and file content preview reads: `Implemented`
- Open in explorer / open file / copy path: `Implemented`

### Git Workflows

- Read flows (status, history, unpushed, owner/user, remotes/tags/stashes): `Implemented`
- Write flows (stage/unstage/discard/commit/push/fetch/pull): `Implemented`
- Repo setup flows (init, initial commit, remote origin, gitignore generators): `Implemented`

### Assistant

- Connect/disconnect/status/send/cancel: `Implemented`
- Streaming events subscription: `Implemented`
- Sessions and thread lifecycle: `Implemented`
- Typed per-turn part stream (`text`/`reasoning`/`tool`/`tool-result`/`approval`/`final`/`error`): `Implemented`
- Explicit approval response control (`respondApproval`) with pending approval tracking: `Implemented`
- Profile/model/project-default controls: `Implemented`
- Token estimate + workflow helpers (explain diff/review staged/draft commit): `Implemented`
- Account/rate-limit/telemetry integrity reads: `Implemented`

### Terminal

- Open external terminal at path via IPC bridge: `Implemented`
- Full in-app terminal manager APIs: `Air-Limited` (not core app surface in Air)

### Window Controls

- Minimize/maximize/close/isMaximized: `Implemented` for Electron client

### AgentScope / Runtime Agent Orchestration

- AgentScope runtime operations: `Air-Limited` (disabled adapter surface)

## Client Surface Coverage

### Electron Renderer (current primary client)

- Full supported surface via `window.devscope`: `Implemented`

### CLI on shared core

- Architecture docs and approach defined: `Planned`
- First-class implementation in this repo: `Not yet`

### IDE extension on shared core

- Architecture docs and approach defined: `Planned`
- First-class implementation in this repo: `Not yet`

### Alternate UI clients

- Architecture docs and approach defined: `Planned`
- First-class implementation in this repo: `Not yet`

## Source of Truth

For exact operation signatures, use:

- `src/shared/contracts/devscope-api.ts`
- `src/shared/contracts/assistant-ipc.ts`
