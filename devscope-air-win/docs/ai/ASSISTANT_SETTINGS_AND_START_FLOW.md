# Assistant Settings and Start Flow Spec

Status: planning-only. Defines exact user flow and required settings behavior.

## Objective

Make assistant startup obvious and reliable:

- User can configure it quickly in Settings.
- User can start it from assistant page with one primary action.
- Failure states provide immediate fix guidance.

## User Flow

## 1. Configure (Settings)

Entry points:

- `Settings -> AI Features` (existing)
- New card: `Settings -> Assistant`

Minimum settings for first release:

1. `Enabled` toggle
2. `Default model` selector
3. `Approval mode` selector (`safe`/`yolo`)
4. `Show thinking` toggle
5. `Auto-connect on Assistant page open` toggle
6. `Reset assistant session` action

Optional advanced settings:

1. `Sidebar default width`
2. `Collapse sidebar by default`
3. `Show event/debug panel`

## 2. Start (Assistant Page)

When user opens `/assistant`:

- If not enabled:
  - Show non-blocking setup state with action button: `Open Assistant Settings`.
- If enabled and disconnected:
  - Show prominent primary action: `Connect and Start`.
- If auto-connect is enabled:
  - Start connect attempt automatically and show spinner state.

## 3. Ready State

On successful connect:

- Header status changes to `Connected`.
- Composer becomes active.
- Model badge and approval badge are visible.
- Start button changes to `Disconnect`.

## 4. Error State

On failed connect:

- Keep page interactive.
- Show clear reason and target action.

Examples:

- Missing executable -> `Assistant runtime not found. Install or configure path.`
- Auth/config issue -> `Authentication required. Open Assistant Settings.`
- Unsupported model -> `Selected model is unavailable. Choose a different model.`

## Behavior Contracts

## Settings Persistence

- Settings updates must apply immediately and persist in `devscope-settings`.
- Invalid stored values should fall back safely to defaults.
- Upgrades must not crash when older settings shape is loaded.

## Start/Stop Idempotency

- Repeated click on `Connect and Start` during in-flight connect must be ignored.
- `Disconnect` should be safe even when partially connected.
- After disconnect, composer and turn controls must be disabled.

## Turn Lifecycle Safety

- While turn is active:
  - disable duplicate send
  - keep cancel action available
  - keep UI responsive
- On completion:
  - final text locks
  - progress/thinking state finalizes

## UI Requirements

## Header Status Block

Must show:

- Connection status
- Active model
- Approval mode
- Current turn status

## Composer

Must support:

- Enter to send
- Shift+Enter newline
- disabled state while disconnected
- clear user feedback when busy

## Sidebar

Must include:

- New chat
- Chat history list
- Persistent collapse state
- Persistent width (desktop)

## Integration Points (Current Codebase)

Settings state:

- `src/renderer/src/lib/settings.tsx`

Settings UI:

- `src/renderer/src/pages/Settings.tsx`
- `src/renderer/src/pages/settings/AISettings.tsx`
- New page: `src/renderer/src/pages/settings/AssistantSettings.tsx` (proposed)

App routing and nav:

- `src/renderer/src/App.tsx`
- `src/renderer/src/components/layout/Sidebar.tsx`

IPC and preload:

- `src/main/ipc/handlers.ts`
- `src/preload/index.ts`

## QA Checklist

1. Enable assistant in settings, restart app, verify setting persists.
2. Open `/assistant`, connect, send prompt, receive response.
3. Disconnect and reconnect without app restart.
4. Toggle approval mode and confirm runtime mode updates.
5. Toggle show-thinking and verify transcript behavior changes immediately.
6. Corrupt local settings manually and verify fallback defaults prevent crash.

## Implementation Notes

- Keep current app style and layout quality unchanged outside assistant surfaces.
- Reuse existing settings patterns and card components where possible.
- Keep assistant page modular from day one; avoid a monolithic `Assistant.tsx`.

