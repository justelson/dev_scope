# Assistant Audit - March 20, 2026

## Scope

This audit focused on the DevScope Air assistant runtime, renderer streaming path, persistence layer, and surrounding assistant UI modules.

Goals:

- remove renderer lag during assistant streaming
- reduce unnecessary work per streamed delta
- modularize oversized assistant files
- bring all source files under the 500 LOC target
- run lightweight validation approved for this session

## Main Findings

### 1. Streaming updates were too expensive end to end

Primary causes found:

- assistant text deltas were emitted too frequently from the main process
- renderer event processing did not collapse delta-heavy bursts enough
- assistant snapshot projection cloned too much state per update
- the page-level assistant UI reacted to streaming changes outside the timeline subtree

Impact:

- long streamed answers caused avoidable IPC traffic
- projector work scaled badly with token frequency
- renderer recomputation amplified the lag during active turns

### 2. Persistence and runtime files had become too large

Several assistant modules had grown past the maintainability target. The persistence layer was the worst case and had both read and write paths mixed into one file.

### 3. LOC guardrails were no longer doing the real job

Before the refactor, multiple assistant files were above 500 lines but tolerated through the assistant exemption list. That hid maintainability debt instead of fixing it.

## Changes Made

### Streaming and UI performance

- buffered assistant text delta emission in the main process
- batched/collapsed assistant event handling in the renderer
- switched the assistant read-model projector to copy-on-write updates
- reused timeline entries incrementally instead of rebuilding more than necessary
- split the conversation pane so active streaming work stays concentrated in the timeline subtree

Key files:

- `src/main/assistant/assistant-text-delta-buffer.ts`
- `src/main/assistant/service-runtime-events.ts`
- `src/main/assistant/service.ts`
- `src/shared/assistant/projector.ts`
- `src/renderer/src/lib/assistant/event-batching.ts`
- `src/renderer/src/lib/assistant/assistant-store-core.ts`
- `src/renderer/src/lib/assistant/assistant-store-hooks.ts`
- `src/renderer/src/pages/assistant/useAssistantTimelineEntries.ts`
- `src/renderer/src/pages/assistant/AssistantConversationTimelinePane.tsx`
- `src/renderer/src/pages/assistant/AssistantConversationComposerPane.tsx`

### LOC and modularization

Assistant/runtime splits:

- `src/main/assistant/service.ts` -> helper extraction into `service-helpers.ts`, `service-history.ts`, `service-records.ts`
- `src/main/assistant/codex-app-server.ts` -> support extraction into `codex-app-server-support.ts`
- `src/main/assistant/codex-runtime-protocol.ts` / `codex-runtime-value-utils.ts` -> protocol/value/session utility split
- `src/main/assistant/persistence.ts` -> split into `persistence.ts`, `persistence-utils.ts`, `persistence-read.ts`, `persistence-write.ts`

Renderer/UI splits:

- assistant store split into `assistant-store-core.ts` and `assistant-store-hooks.ts`
- timeline rows/tool rendering split
- sessions rail split
- assistant page sidebar and timeline scroll state split
- settings assistant panels/rate-limit rendering split

### Type safety cleanup

- fixed the child-process typing mismatch around process termination helpers
- restored the original protocol helper call surface after the runtime utility split

## LOC Result

Validation command:

- `node scripts/maint/check-loc.mjs`

Result on March 20, 2026:

- no `src/` files above 500 LOC
- no assistant exemption files above 500 LOC

## Validation Result

Commands run:

- `npm run typecheck`
- `node scripts/maint/check-loc.mjs`

Result:

- `typecheck`: passed
- `maint:loc`: passed

## Remaining Risk / Follow-up

What is fixed in code:

- the major structural causes of streaming lag
- oversized assistant modules
- the assistant runtime typing issue blocking typecheck

What is still worth verifying manually:

- live Electron interaction with a long streaming turn
- subjective UI smoothness on lower-end hardware
- persistence behavior across restart/reconnect with active assistant history

No full build or full interactive app test was run in this session.
