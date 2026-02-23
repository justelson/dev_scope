# Building On Top Of DevScope

Status: architecture guidance only. No implementation changes in this document.

## Purpose

Define a stable path to build multiple clients on the same backend capabilities:

- CLI
- IDE extension
- Additional UI clients

The goal is one shared contract and one shared domain core, with client-specific adapters.

## Current Baseline

The codebase already has strong foundations for multi-client architecture:

- Contract layer exists in `src/shared/contracts`.
- Preload is adapter-composed in `src/preload/devscope-electron-adapter.ts`.
- Core domain entry exists in `src/main/core/devscope-core.ts`.
- IPC handlers already delegate some work to `devscopeCore`.

Current gap:

- Some domain logic still lives in IPC handlers and Electron-coupled paths.
- Renderer is naturally coupled to `window.devscope` because it is the Electron client.

## Target Platform Shape

Use four layers with strict dependency direction:

1. Domain Core
   - Project discovery, git workflows, assistant orchestration, file operations.
   - No Electron, no UI assumptions.
2. Contract Layer
   - Shared types and operation contracts.
   - Canonical success/error envelope and event contracts.
3. Client Adapters
   - Electron IPC adapter, CLI adapter, IDE adapter, and optional HTTP/stdio bridge adapter.
4. Clients
   - Current renderer UI, future CLI, IDE extension, and other UIs.

Dependency rule:

- Clients depend on contracts plus one adapter.
- Adapters depend on contracts and domain core.
- Domain core does not depend on any client.

## Contract-First Rule

Every new capability should follow this order:

1. Update shared contract in `src/shared/contracts`.
2. Implement domain behavior in core/services.
3. Expose capability via adapter(s).
4. Consume from client.

This keeps CLI/IDE/UI feature parity realistic and reduces rework.

## Recommended Boundary Cleanup

Highest-value cleanup path:

1. Keep moving project discovery and indexing logic into `src/main/services` and `src/main/core`.
2. Keep IPC handlers thin translators only.
3. Keep preload as an Electron adapter over shared contract, not as the source of business logic.
4. Keep UI settings as client-local preferences unless required by cross-client behavior.
5. Move cross-client settings into shared config only when needed by CLI or IDE.

## Cross-Client Capability Groups

Use capability groups as the product boundary:

- Projects and discovery
- File tree and file content
- Git read/write workflows
- Assistant sessions and streaming
- System/readiness information
- Window controls as Electron-only capability

For non-Electron clients, omit or stub Electron-only capabilities explicitly.

## Assistant Streaming Contract Rules

To keep all clients consistent:

1. Stream updates are provisional until completion.
2. Final answer is committed once per assistant turn.
3. Session title generation is metadata, not visible message content.
4. Event ordering and replay rules are explicit and client-agnostic.
5. Attachments are normalized once at contract boundary.

## Client-Specific Responsibilities

- Electron UI client:
  - Rich visuals, local desktop interactions, window controls.
- CLI client:
  - Automation-friendly output and exit semantics.
- IDE extension:
  - Context-aware editor workflows and inline actions.
- Alternate UI:
  - Faster/leaner interaction models over same contract.

## Phased Adoption Plan

Phase 1: Stabilize Core Contract

- Freeze naming and payload shape in shared contracts.
- Define what is cross-client versus Electron-only.

Phase 2: Thin Adapter Enforcement

- Continue reducing logic inside IPC handlers.
- Keep adapters transport-focused and stateless where possible.

Phase 3: Introduce Non-Electron Access Path

- Add a sidecar access model for CLI and IDE extension.
- Reuse same contract semantics.

Phase 4: Build Clients

- Deliver CLI first for fastest validation.
- Deliver IDE extension second for workflow depth.
- Deliver alternate UI third for product differentiation.

## Non-Goals For Initial Platformization

- Full microservices split.
- Remote multi-tenant backend.
- Plugin marketplace and unrestricted third-party extension runtime.

## Decision Log Guidance

Maintain a short decision log for each new cross-client capability:

- Why this belongs in core.
- Which clients require it.
- Whether capability is safe for automation.
- Whether it is read-only or mutating.
- Which adapter surfaces are updated.

## Success Criteria

Platformization is working when:

1. A feature is added once in core and appears in at least two clients with minimal extra logic.
2. Client bugs are mostly presentation issues, not contract mismatches.
3. IPC/preload changes are mostly wiring, not domain behavior.
4. CLI and IDE extension can ship without copying renderer logic.
