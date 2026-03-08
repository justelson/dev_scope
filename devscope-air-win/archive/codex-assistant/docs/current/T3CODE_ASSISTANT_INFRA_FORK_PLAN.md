# T3code Assistant Infra Study And DevScope Fork Plan

## Goal

This document explains how `t3code` handles the assistant end to end, why its streaming model is more stable than the current DevScope assistant stack, and what we should fork into DevScope if we want true `t3code` behavior instead of continued patching.

This is a study document, not an implementation commit plan. The intent is to give a full map of the system before we transplant it.

## Short Conclusion

If DevScope wants `t3code`-level assistant stability, we should not keep extending the current DevScope bridge/event stack.

We should fork the `t3code` assistant engine as the source of truth:

- provider event classification
- runtime ingestion
- orchestration command and event model
- projection pipeline
- read-model snapshot query
- client selectors for work log, approvals, plans, and streaming rows

Then we should rebuild the DevScope assistant UI on top of that projected state while keeping DevScope's shell, settings, page layout, dock mode, project/session UX, and Electron integration.

## T3code Repo Areas To Study

Top-level repo:

- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\web`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\desktop`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\packages\contracts`

Most important files:

- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\packages\contracts\src\providerRuntime.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\packages\contracts\src\orchestration.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\provider\Layers\CodexAdapter.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\provider\Layers\ProviderService.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\orchestration\Layers\ProviderRuntimeIngestion.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\orchestration\Layers\ProviderCommandReactor.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\orchestration\Layers\OrchestrationEngine.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\orchestration\decider.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\orchestration\projector.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\orchestration\Layers\ProjectionPipeline.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\orchestration\Layers\ProjectionSnapshotQuery.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\wsServer.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\web\src\store.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\web\src\wsTransport.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\web\src\wsNativeApi.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\web\src\appSettings.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\web\src\session-logic.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\web\src\components\ChatView.tsx`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\web\src\components\ChatMarkdown.tsx`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\web\src\components\Sidebar.tsx`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\web\src\routes\__root.tsx`

## Core Design Principle

`t3code` has a hard projection boundary.

Raw provider/runtime events are not rendered directly.

The UI renders only from a projected read model:

- `messages`
- `activities`
- `proposedPlans`
- `session`
- `checkpoints`
- `latestTurn`

That is the main reason `t3code` avoids the duplicate cards, command-noise cards, and broken streaming behavior that DevScope keeps hitting.

## End-To-End Flow

The real flow is:

1. Codex-native events are normalized into typed runtime events.
2. Runtime events are ingested into orchestration commands.
3. Commands become persisted orchestration domain events.
4. Domain events are projected into read-model tables.
5. The client syncs snapshots of the read model.
6. The UI derives working state, pending approvals, pending user input, plan state, and message timeline from that read model.

In short:

`provider events -> runtime events -> orchestration events -> projections -> read model -> UI selectors`

Not:

`provider events -> renderer cards`

## Layer 1: Runtime Contracts

Key file:

- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\packages\contracts\src\providerRuntime.ts`

This layer defines the typed runtime event vocabulary before orchestration sees anything.

Important concept:

- different stream kinds exist for different content channels

Examples:

- assistant text
- reasoning text
- reasoning summary text
- command output
- file change output

This matters because `t3code` can tell very early whether an incoming delta is:

- something the user should read as assistant output
- something the user should see as summarized work
- something that belongs only in terminal/runtime surfaces

DevScope currently lacks a strong enough equivalent to this distinction.

## Layer 2: Codex Adapter

Key file:

- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\provider\Layers\CodexAdapter.ts`

This file is the anti-corruption layer for Codex.

What it does:

- reads Codex-native notifications
- classifies them into canonical runtime events
- tags content with the correct stream kind
- maps tool approvals and user-input requests into structured request events

Critical behaviors:

- `item/agentMessage/delta` becomes assistant text
- command execution output does not become assistant text
- reasoning deltas are normalized separately
- approvals become structured request events
- user-input requests become structured `user-input.requested` events

This is where `t3code` first prevents command stream noise from pretending to be assistant output.

## Layer 3: Provider Service

Key file:

- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\provider\Layers\ProviderService.ts`

This is the runtime event bus for provider-level activity.

Responsibilities:

- publish normalized runtime events
- expose streaming subscriptions
- keep provider-facing logic out of the UI

This is an internal service layer, not a render layer.

## Layer 4: Runtime Ingestion

Key file:

- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\orchestration\Layers\ProviderRuntimeIngestion.ts`

This is the most important file in the entire architecture.

It decides what becomes visible state.

### What it allows through

It converts only a curated subset of runtime events into projected orchestration artifacts:

- assistant text deltas
- proposed plan deltas
- approvals requested/resolved
- user-input requested/resolved
- task progress summaries
- selected tool lifecycle items
- runtime warnings/errors
- plan updates

### What it does not do

It does not turn every raw runtime event into a visible UI row.

That means:

- raw command stdout is not a chat card
- raw reasoning summary chunks are not standalone thought cards
- transport noise is not UI state

### Buffering behavior

`t3code` buffers:

- assistant text
- proposed plan text

Then finalizes them into stable entities.

That means the UI gets:

- one assistant message row identified by message id
- one proposed plan row identified by plan id

Instead of per-delta card spam.

### Activity creation

`runtimeEventToActivities(...)` converts selected runtime events into `thread.activities`.

These are already summarized, typed, and constrained before they ever reach the UI.

## Layer 5: Command Reactor

Key file:

- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\orchestration\Layers\ProviderCommandReactor.ts`

This handles commands from the client side such as:

- start turn
- answer approval
- answer user input

The client does not mutate chat state directly.
It asks orchestration to do it.

This matters because:

- approvals stay authoritative
- user-input stays authoritative
- session status stays authoritative

## Layer 6: Decider

Key file:

- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\orchestration\decider.ts`

This turns orchestration commands into durable domain events.

Important event families:

- `thread.message.assistant.delta`
- `thread.message.assistant.complete`
- `thread.activity.append`
- `thread.proposed-plan.upsert`

This is where `t3code` stops thinking in terms of provider deltas and starts thinking in domain events.

## Layer 7: Projector

Key file:

- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\orchestration\projector.ts`

This is the in-memory/domain projector.

Important behavior:

- assistant messages are merged by stable `messageId`
- activities are keyed by stable `activity.id`
- plans are merged by stable `planId`

This is one of the main anti-duplication mechanisms.

If the same assistant message streams over time, `t3code` updates the same projected message.
It does not create a new visible message for every delta.

## Layer 8: Projection Pipeline

Key file:

- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\orchestration\Layers\ProjectionPipeline.ts`

This persists the projections into projection tables.

Separate projection slices exist for:

- projects
- threads
- thread messages
- thread proposed plans
- thread activities
- thread sessions
- turns
- checkpoints
- pending approvals

This separation is important because the UI later consumes clean state buckets rather than mixed telemetry blobs.

## Layer 9: Snapshot Query

Key file:

- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\orchestration\Layers\ProjectionSnapshotQuery.ts`

This assembles the authoritative `OrchestrationReadModel`.

The snapshot contains:

- projects
- threads
- thread messages
- thread activities
- thread plans
- thread session state
- checkpoint summaries
- latest turn info
- snapshot sequence

This is what the web client hydrates from.

## Layer 10: WebSocket Transport

Key files:

- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\server\src\wsServer.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\web\src\wsTransport.ts`
- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\web\src\wsNativeApi.ts`

The transport model is:

- request/response for commands and snapshot fetches
- push for domain event notifications

The key client behavior is important:

- on domain event push, the client re-syncs from snapshot
- it does not rebuild UI from raw pushed delta payloads

That is another major reason `t3code` avoids renderer drift.

## Layer 11: Client Store

Key file:

- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\web\src\store.ts`

The store is thin.

It mainly:

- syncs the read model into local Zustand state
- preserves local-only UI state such as expanded projects or last visited thread timestamps
- does not own the assistant runtime truth

This is different from DevScope, where the renderer currently reconstructs too much live assistant state itself.

## Layer 12: Client Settings

Key file:

- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\web\src\appSettings.ts`

This is a good pattern worth copying directly.

It gives:

- validated local settings
- strongly typed settings
- simple subscription model
- custom models and service-tier support

This is much cleaner than burying assistant runtime logic inside generic renderer settings blobs.

## Layer 13: Session Logic

Key file:

- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\web\src\session-logic.ts`

This is the selector layer that turns projected thread state into renderable UI concepts.

Important selectors:

- `derivePendingApprovals(...)`
- `derivePendingUserInputs(...)`
- `deriveActivePlanState(...)`
- `deriveWorkLogEntries(...)`
- `deriveTimelineEntries(...)`
- `hasToolActivityForTurn(...)`
- `derivePhase(...)`

This file is where `t3code` does the second denoise pass.

### Most important rule for DevScope

`deriveWorkLogEntries(...)` filters out:

- `tool.started`
- `task.started`
- `task.completed`
- checkpoint noise

That means even projected activity still gets reduced before the user sees it.

This is exactly the kind of rule DevScope is missing.

## Layer 14: Main Chat View

Key file:

- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\web\src\components\ChatView.tsx`

This is the main assistant screen.

It is not a plain chat bubble list.

It combines:

- user messages
- assistant messages
- grouped work-log rows
- proposed plan cards
- pending approvals
- pending user-input flow
- changed-files summaries
- completion divider
- live working indicator row

The screen is built from:

- `thread.messages`
- `thread.activities`
- `thread.proposedPlans`
- `thread.checkpoints`
- `thread.session`
- `thread.latestTurn`

## Thinking Indicator In T3code

There is no raw “reasoning token card” stream.

Instead `t3code` shows thinking in two safer ways:

### 1. Work log / reasoning summaries

`task.progress` and similar normalized activities become work-log entries.

These come from:

- `ProviderRuntimeIngestion.ts`
- `session-logic.ts`

So “thinking” is represented as curated progress/work summaries, not raw reasoning chunk spam.

### 2. Live working row

`ChatView.tsx` appends a synthetic `working` row when the thread is active.

That row renders as three pulsing dots.

This is the exact “thinking/working” indicator behavior to copy.

Relevant behavior:

- `isWorking = phase === "running" || isSendBusy || isConnecting || isRevertingCheckpoint`
- `MessagesTimeline` appends a `working` row when `isWorking`
- the row renders three animated dots

This is the cleanest answer to “assistant is still thinking.”

## Answering Indicator In T3code

There are two answering indicators:

### 1. Streaming assistant message row

Assistant messages have `streaming: true` in projected message state.

`ChatView.tsx` passes `isStreaming` into `ChatMarkdown`.

This means the current assistant answer is shown in place as one evolving message row.

Important point:

The user sees one answer row being updated, not multiple partial cards.

### 2. Sending / connecting CTA states

The composer and action buttons surface:

- `Connecting`
- `Sending...`

while the request is in progress.

This is a useful secondary answering indicator that DevScope should copy.

## Sidebar Status Indicators In T3code

Key file:

- `C:\Users\elson\my_coding_play\opensource.codeinspirations\t3code\apps\web\src\components\Sidebar.tsx`

Each thread can show a status pill:

- `Working`
- `Connecting`
- `Completed`
- `Pending Approval`

This is derived from projected thread/session state plus pending approval selectors.

This is worth copying into DevScope session/sidebar UI.

## Why T3code Does Not Explode Into Bad Streaming Cards

The main reasons are:

1. Runtime content is classified early.
2. Only allowlisted runtime events become orchestration-visible state.
3. Assistant text is buffered and merged by stable message id.
4. Plans are buffered and merged by stable plan id.
5. Work log is derived from projected activities, not raw transport events.
6. The work log selector removes start/completion lifecycle noise.
7. The client re-syncs snapshots instead of trying to render every push event directly.

## What DevScope Should Fork

### Must fork

- runtime contracts shape from `providerRuntime.ts`
- orchestration read-model shape from `orchestration.ts`
- Codex event classification approach from `CodexAdapter.ts`
- runtime ingestion model from `ProviderRuntimeIngestion.ts`
- orchestration command/event flow from `ProviderCommandReactor.ts` and `decider.ts`
- projection model from `projector.ts`, `ProjectionPipeline.ts`, and `ProjectionSnapshotQuery.ts`
- session selectors from `session-logic.ts`
- `ChatView` work/timeline concepts

### Strongly recommended to fork

- app settings pattern from `appSettings.ts`
- thin client-store sync model from `store.ts`
- reconnecting request/push transport pattern from `wsTransport.ts`
- sidebar thread status pill behavior
- working row and streaming-message indicator behavior

### Keep from DevScope

- Electron shell
- overall DevScope page layout
- dock mode
- project browsing integration
- DevScope settings shell
- DevScope branding and navigation

## What Needs Adaptation For DevScope

### Transport

`t3code` uses WebSocket between web and server.

DevScope can do either:

- keep a local internal socket/server model
- or adapt the same shape onto Electron IPC

If we use IPC, we should still preserve the same logical contract:

- request command
- request snapshot
- push domain-event notification

### Runtime host

`t3code` server code currently assumes a server-style orchestration runtime.

For DevScope we need to choose:

- main-process orchestration engine
- or sidecar process managed by Electron main

The sidecar is closer to `t3code` semantics.
The main-process port is simpler operationally.

### Persistence

We need projection persistence for:

- threads
- messages
- activities
- plans
- sessions
- turns
- approvals
- checkpoints

This can live in:

- SQLite
- or structured persisted state with a projection layer

If we want exact `t3code` behavior, SQLite-style projections are the safer choice.

### UI adaptation

We should not copy the exact `t3code` UI.
We should copy the data flow and interaction model.

That means:

- DevScope keeps its UI shell
- DevScope message and sidebar components are rebuilt around projected state
- the `working` row, streaming answer row, status pill, plan card, approval card, and user-input card behaviors are carried over

## Proposed DevScope Fork Shape

### New source of truth

Replace the current DevScope assistant live-state model with:

- `runtime events`
- `orchestration events`
- `projected read model`

and render only from the projected read model.

### New renderer model

The renderer should consume:

- `snapshot`
- `domain event notification -> re-sync snapshot`

not:

- `assistant-delta`
- `assistant-reasoning`
- `assistant-activity`
- `turn-part`

as direct render inputs.

### New active-work model

DevScope `Active Work` should be renamed conceptually into a `work log` selector backed by projected `activities`.

It should:

- scope to latest turn
- ignore `tool.started`
- ignore start/completion lifecycle noise
- ignore terminal/command-output noise
- show only curated summaries and useful details

### Thinking indicator to copy

Copy both:

- the `working` row with animated dots
- the summarized work-log thinking entries

Do not reintroduce raw reasoning token cards.

### Answering indicator to copy

Copy both:

- one streaming assistant message row
- button/status text like `Connecting` and `Sending...`

## What To Expect During A Full Fork

### Expect these benefits

- much cleaner streaming
- no more raw command text leaking into `Active Work`
- approvals and user-input become stable flows
- message streaming becomes one evolving answer row
- easier future additions such as plan mode, checkpoints, changed-files cards, and status pills

### Expect these costs

- current DevScope assistant bridge code becomes mostly obsolete
- history/session persistence will need migration or reset
- many renderer selectors will be replaced
- some current event-console logic may become a separate raw-runtime/debug surface rather than part of the main chat
- implementation is larger than a feature merge

### Expect these compatibility decisions

- whether to keep Electron IPC only or add a local WS-compatible layer
- whether to port persistence exactly or adapt it
- whether to preserve current DevScope session IDs or remap them

## Recommended Migration Strategy

### Phase 1: Freeze the current DevScope assistant architecture

Do not keep extending the current live projection path.

Only emergency fixes after this point.

### Phase 2: Import contracts and runtime classification

Port:

- runtime event contract
- orchestration read-model contract
- Codex classification logic

### Phase 3: Port orchestration engine

Port:

- command reactor
- decider
- projector
- projection pipeline
- snapshot query

### Phase 4: Add DevScope transport adapter

Expose:

- `getSnapshot`
- `dispatchCommand`
- `subscribeDomainEvents`

over Electron main/preload.

### Phase 5: Rebuild renderer selectors

Replace current assistant runtime reducers with:

- snapshot sync
- `session-logic` style selectors

### Phase 6: Rebuild DevScope assistant UI around projected state

Keep the DevScope look and layout.

Adopt:

- working row
- streaming answer row
- pending approval flow
- pending user-input flow
- status pill
- grouped work log
- proposed plan card
- changed-files card if desired

### Phase 7: Remove legacy bridge rendering path

Delete or retire:

- direct delta-driven streaming render path
- duplicate telemetry-driven work rendering
- current mixed `assistant-delta` / `assistant-activity` / `turn-part` render flow

## Non-Negotiable Rules If We Fork T3code Infra

1. Never render raw provider/runtime deltas directly.
2. Every visible assistant answer must resolve to one stable projected message row.
3. Every visible work item must come from projected `activities`, not raw command output.
4. Terminal or command output must live on a separate runtime/debug surface.
5. Snapshot sequence must gate client sync so old events do not duplicate rows.
6. The renderer must be a consumer of projected state, not the owner of assistant truth.

## Recommendation

We should do a full assistant-engine transplant, not continue patching DevScope's existing assistant live-state model.

The correct target is:

- `t3code` orchestration behavior
- DevScope shell and UI skin

not:

- `t3code` UI copied wholesale
- DevScope event system patched forever

## DevScope Files That Will Eventually Be Replaced Or Heavily Reworked

Current DevScope files most likely to be replaced or reduced after a real fork:

- `C:\Users\elson\my_coding_play\devscope\devscope-air-win\src\main\assistant\assistant-bridge.ts`
- `C:\Users\elson\my_coding_play\devscope\devscope-air-win\src\main\assistant\assistant-bridge-core.ts`
- `C:\Users\elson\my_coding_play\devscope\devscope-air-win\src\main\assistant\assistant-bridge-events.ts`
- `C:\Users\elson\my_coding_play\devscope\devscope-air-win\src\main\assistant\assistant-bridge-operations.ts`
- `C:\Users\elson\my_coding_play\devscope\devscope-air-win\src\main\assistant\assistant-bridge-rpc.ts`
- `C:\Users\elson\my_coding_play\devscope\devscope-air-win\src\main\assistant\assistant-bridge-session.ts`
- `C:\Users\elson\my_coding_play\devscope\devscope-air-win\src\renderer\src\pages\assistant\assistant-page-runtime.ts`
- `C:\Users\elson\my_coding_play\devscope\devscope-air-win\src\renderer\src\pages\assistant\useAssistantPageController.ts`

Current DevScope files likely to remain but be rewired:

- `C:\Users\elson\my_coding_play\devscope\devscope-air-win\src\renderer\src\pages\assistant\AssistantPageContent.tsx`
- `C:\Users\elson\my_coding_play\devscope\devscope-air-win\src\renderer\src\pages\assistant\AssistantMessage.tsx`
- `C:\Users\elson\my_coding_play\devscope\devscope-air-win\src\renderer\src\pages\assistant\AssistantComposer.tsx`
- `C:\Users\elson\my_coding_play\devscope\devscope-air-win\src\renderer\src\pages\assistant\AssistantSessionsSidebar.tsx`

## Final Call

If the goal is exact `t3code` assistant quality, the correct move is:

- fork the infra fully
- keep DevScope UI ownership
- rebuild DevScope assistant rendering around the `t3code` projected state model

That is the clean path.
