# Assistant Sidebar Design Audit (julia.codex)

Status: planning-only reference. No implementation in this document.

## Purpose

Capture the design language and interaction model used in `julia.codex` so DevScope can implement a similarly high-quality assistant experience without guessing.

## Source Files Reviewed

- `C:\Users\elson\my_coding_play\play projects\playgound\play_tests\julia.codex\app-server-ui\public\index.html`
- `C:\Users\elson\my_coding_play\play projects\playgound\play_tests\julia.codex\app-server-ui\public\styles.css`
- `C:\Users\elson\my_coding_play\play projects\playgound\play_tests\julia.codex\app-server-ui\public\app.js`
- `C:\Users\elson\my_coding_play\play projects\playgound\play_tests\julia.codex\docs\06-julia-codex\ui-contracts.md`
- `C:\Users\elson\my_coding_play\play projects\playgound\play_tests\julia.codex\docs\06-julia-codex\architecture.md`
- `C:\Users\elson\my_coding_play\play projects\playgound\play_tests\julia.codex\docs\06-julia-codex\state-lifecycle.md`
- `C:\Users\elson\my_coding_play\play projects\playgound\play_tests\julia.codex\docs\06-julia-codex\event-mapping-matrix.md`
- `C:\Users\elson\my_coding_play\play projects\playgound\play_tests\julia.codex\docs\06-julia-codex\runbook-model-streaming-issues.md`

## Design System Summary

### Typography

- Display: `Instrument Serif`
- Body: `DM Sans`
- Mono: `JetBrains Mono`

The contrast between elegant serif headings and technical mono labels gives the UI a clear identity.

### Tokenized Theme

The interface is fully token-driven (light and dark variants), including:

- Background layers: base/surface/elevated/inset/overlay
- Text layers: default/muted/subtle
- Semantic colors: accent/success/warning/info/destructive
- Radii and shadows
- Sidebar width and transitions

This enables consistent styling across chat, settings, account, and events.

### Spatial Language

- Primary shell is a 3-column grid:
  - Sidebar
  - Resize handle
  - Workspace
- Sidebar supports collapse + resize.
- Workspace views are separated into `Chat`, `Settings`, `Account`, and `Events`.

## Interaction Model Summary

### Chat

- Rich transcript with assistant/user/system message roles.
- Assistant supports attempt history (regenerate variants) with next/previous navigation.
- Inline action controls on assistant message hover:
  - Copy
  - Regenerate
- Thinking/provisional state is visually distinct from final answer.

### Thought Stream

- Thought blocks are grouped per assistant attempt.
- Thought block header includes:
  - label
  - elapsed time
  - expand/collapse
- Activities are typed rows: command/file/search/tool/agent.
- Diff previews are side-by-side and intentionally limited.

### Settings and Diagnostic UX

- Settings are tabbed and grouped by intent.
- Data viewers support formatted/raw modes with copy.
- Event viewer includes filter chips, search, and typed color coding.
- YOLO/safe approval mode is explicit and guarded by a warning modal.

## Motion and Feedback

Meaningful motion is used in a few places only:

- View entry
- Message entry
- Typing indicator
- Assistant shimmer while thinking
- Regeneration spinner
- Toast entry/exit

The pattern is "few strong animations" instead of many weak micro-animations.

## Responsiveness and Accessibility Patterns

- On small screens, sidebar collapses out and workspace becomes full width.
- `aria-*` attributes are used for tabs, toggles, dialogs, and expanded states.
- Keyboard interaction is considered for text input, tab-like controls, and toggles.

## State and Persistence Patterns

`julia.codex` persists:

- Theme
- Sidebar layout (width + collapsed)
- Settings defaults
- Event filters
- Chat history and assistant attempts

This is a key reason the UI feels "stateful" and polished instead of reset-heavy.

## What DevScope Should Reuse

1. Token-first design for assistant surface.
2. Collapsible/resizable assistant sidebar behavior.
3. Attempt-aware assistant responses.
4. Separate provisional/thinking/final states with strict final-locking.
5. Typed events/log panel with filter chips and severity colors.
6. Settings grouped around actual user workflows (connect, defaults, behavior, safety).

## What DevScope Should Avoid Copying Directly

1. Monolithic single-file frontend architecture (`app.js` + large CSS).
2. Direct localStorage-heavy logic inside one global state object.
3. Tight coupling of rendering + event classification + persistence in one file.

DevScope should implement equivalent UX using modular React components/hooks and typed IPC boundaries.

## Non-Negotiable UX Quality Bar for DevScope Assistant

- No flicker between provisional and final assistant output.
- Sidebar state persists across app restarts.
- Assistant controls remain understandable for first-time users.
- Error states are specific and actionable.
- "Connect/Start" flow is visible and requires minimal setup.

