# Alternate UI Clients On DevScope

Status: planning-only documentation.

## Objective

Support new user interfaces that reuse DevScope capabilities while staying consistent with core behavior.

Examples:

- Lightweight desktop shell
- Web-facing internal dashboard
- Terminal UI focused on rapid workflows

## Design Principle

UI choice must not redefine business logic.

- Business rules stay in core/services.
- UI clients consume contract-defined operations and events.
- Adapter translates transport details, not domain rules.

## Minimum Client Contract Expectations

Any alternate UI should support:

- Shared success/error result semantics
- Project path scoping for project-dependent operations
- Assistant streaming lifecycle semantics
- Capability discovery and graceful unsupported behavior

## Required UX Baselines

Across all UIs, keep these behaviors consistent:

1. Loading states are explicit and non-blocking.
2. Long-running operations show progress or activity.
3. Errors are contextual and actionable.
4. Session metadata is separated from transcript text.
5. File and folder paths are always copyable and clearly shown.

## Data And Cache Guidance

For cross-client consistency:

- Treat core results as source of truth.
- Cache for responsiveness, but invalidate on meaningful events.
- Avoid duplicate indexing triggers by centralizing index ownership.
- Prefer background indexing with foreground search against index data.

## Capability Partitioning

Separate capabilities into:

- Cross-client core capabilities
- Client-specific optional capabilities

Examples of optional client-specific capabilities:

- Electron window controls
- IDE host UI affordances
- Specialized dashboard visual analytics

## Rollout Pattern For New UI

1. Define target workflows and required capabilities.
2. Verify capabilities already exist in shared contract.
3. Add missing contract operations before client implementation.
4. Build thin client adapter and UI composition layer.
5. Validate behavior parity with desktop for shared workflows.

## Risk Areas

- UX drift caused by local client workarounds.
- Inconsistent loading/error semantics across clients.
- Capability fragmentation where one client bypasses contract.

## Mitigations

- Contract-first development gates.
- Shared behavior checklist before release.
- Explicit marking of unsupported capabilities per client.

## Completion Criteria

An alternate UI is production-ready when:

1. It depends on shared contract operations for core workflows.
2. It does not duplicate domain logic from other clients.
3. It maintains consistent session, streaming, and error behavior.
