# CLI On DevScope

Status: planning-only documentation.

## Objective

Ship a first-party CLI that uses the same core capabilities as the desktop app, without re-implementing business logic.

## Product Role

The CLI should be:

- Scriptable
- Deterministic
- Fast for common workflows
- Compatible with the same project/git/assistant semantics as the app

## Recommended Runtime Model

Preferred model for long-term consistency:

- CLI client talks to a shared contract adapter.
- Adapter calls domain core capabilities.
- Avoid duplicating logic from renderer or Electron-specific components.

## Capability Scope For Initial CLI

Start with high-value capabilities already present in core/services:

- Project scanning and indexing
- Git status, stage, commit, push
- Assistant workflow actions tied to project path
- Readiness and diagnostics summaries

Defer lower-value parity work:

- Desktop-only window operations
- Visual-only interaction patterns

## Output Contract Principles

All commands should support:

- Human-readable output as default
- Structured machine-readable output mode
- Clear non-zero failure semantics
- Error messages that map to contract error payloads

## Configuration Strategy

Configuration should be explicit and predictable:

- Allow defaults from shared config when safe.
- Allow CLI overrides for model/approval and output mode.
- Keep CLI-specific settings isolated from pure UI preferences.

## Security And Approval Model

Align mutating operations with existing safety expectations:

- Distinguish read versus write operations.
- Keep destructive operations explicit.
- Preserve assistant approval mode semantics.

## Suggested Delivery Sequence

1. Foundation
   - Contract and adapter verification for core read operations.
2. Git Mutations
   - Stage/commit/push with robust error mapping.
3. Assistant Workflows
   - Project-scoped automation calls.
4. Hardening
   - Exit behavior, stability, and compatibility checks.

## Risk Areas

- Contract drift between CLI adapter and Electron adapter.
- Path normalization differences on Windows.
- Mixed ownership of settings between UI-local and shared config.

## Mitigations

- Enforce contract-first changes.
- Keep path handling centralized in core utilities.
- Treat UI-local settings as non-authoritative for CLI unless promoted to shared config.

## Completion Criteria

CLI foundation is ready when:

1. Core project and git workflows run without touching renderer code.
2. CLI output is stable enough for scripts.
3. Contract behavior matches desktop app semantics for shared capabilities.
