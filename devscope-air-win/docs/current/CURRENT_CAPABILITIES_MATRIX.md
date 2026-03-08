# Current Capabilities Matrix

Last validated: March 8, 2026

This matrix reflects the currently exposed DevScope desktop capabilities from the shared contract and adapters.

## Legend

- `Implemented`: available and wired in main/preload/renderer.
- `Deprecated/Removed`: intentionally not part of the active desktop product surface.
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

### Terminal

- Open external terminal at path via IPC bridge: `Implemented`
- Full in-app terminal manager APIs: `Deprecated/Removed`

### Desktop Updates

- Current version/release channel surface: `Implemented`
- Check/download/install update actions: `Implemented`
- GitHub Releases update feed integration: `Implemented`

### Window Controls

- Minimize/maximize/close/isMaximized: `Implemented` for Electron client

### Archived Assistant / Agent Runtime Surfaces

- In-app assistant pages and IPC surface: `Deprecated/Removed`
- AgentScope/runtime orchestration surface: `Deprecated/Removed`
- Archived source retained for reference under `archive/codex-assistant`: `Implemented`

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
