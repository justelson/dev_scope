# IDE Extension On DevScope

Status: planning-only documentation.

## Objective

Enable IDE workflows on top of DevScope core capabilities without embedding desktop UI assumptions into editor integrations.

## Product Role

The extension should focus on in-editor workflows:

- Context-aware assistant actions
- Git-aware coding tasks
- Project-level insights and quick actions

## Recommended Architecture

Preferred architecture:

- IDE extension as thin client.
- Shared adapter/bridge to DevScope core capabilities.
- Contract parity with desktop app for shared operations.

Avoid:

- Rebuilding project scanning or git business logic inside extension code.
- Copying renderer-specific state or UI behavior.

## Capability Priorities

High-value extension capabilities:

- Project-scoped assistant workflows
- File and diff context handoff
- Git status and staged-changes awareness
- Session-aware assistant interactions

Lower-priority capabilities:

- Full settings parity with desktop app
- Desktop-only actions such as window management

## Context And Session Rules

To keep behavior predictable across app and IDE:

1. Session identity is stable and reusable.
2. Session title is metadata generated once, not repeated in message content.
3. Project path context is explicit on each task boundary.
4. Attachment metadata is normalized at adapter boundary.

## Streaming And UX Rules

For assistant behavior consistency:

- Show provisional stream state while receiving events.
- Commit final content once, at completion.
- Keep model/progress/error state explicit.
- Keep thought or progress traces separate from final answer text.

## Security Model

IDE extension should follow explicit trust boundaries:

- Clear user intent for mutating actions.
- Explicit approval handling where required.
- No implicit shell or filesystem mutations without user-triggered commands.

## Delivery Sequence

1. Read-only integration
   - Status, sessions, context read flows.
2. Assistant task flows
   - Send/cancel/regenerate and project-scoped workflows.
3. Controlled mutations
   - Git-stage/commit style actions with explicit user interaction.
4. Hardening
   - Recovery behavior, reconnect behavior, and error diagnostics.

## Risk Areas

- Editor host lifecycle instability affecting session continuity.
- Contract mismatch between extension transport and desktop transport.
- Inconsistent prompt context construction.

## Mitigations

- Keep extension adapter thin and contract-driven.
- Reuse shared normalization logic where possible.
- Add strict event ordering and finalization rules.

## Completion Criteria

IDE extension foundation is ready when:

1. Editor workflows use shared contract operations with no copied domain logic.
2. Session and streaming behavior match desktop semantics.
3. Core assistant and git workflows are stable under reconnects and editor restarts.
