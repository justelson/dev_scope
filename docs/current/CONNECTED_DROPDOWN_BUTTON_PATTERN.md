# Connected Dropdown Button Pattern

Last updated: April 19, 2026

Use this pattern for compact two-state or small-option controls that should behave like an attached action button plus dropdown, instead of a segmented control or a full-width select.

Use it together with:

- `docs/current/UI_BORDER_AND_DIVIDER_STANDARDS.md`
- `.codex/skills/devscope-ui-standards/SKILL.md`

## Canonical References

- Shared reusable component:
  - `src/renderer/src/components/ui/ConnectedDropdownButton.tsx`
- Style references that informed the shared component:
  - `src/renderer/src/components/ui/file-preview/PreviewHeaderEditMenu.tsx`
  - `src/renderer/src/components/ui/OpenWithProjectButton.tsx`
- Current settings usage:
  - `src/renderer/src/pages/settings/AssistantDefaultsPanel.tsx`

## When To Use It

Use this control when all of these are true:

- the current state needs to stay visible at all times
- the control should support one-click switching to the alternate state
- the full option list is still useful from a chevron menu
- the surface needs to stay compact and visually attached

Do not use it for:

- long option lists
- search-heavy selection
- settings that need descriptions under every menu row
- forms that should use the standard dropdown/select semantics instead

## Visual Rules

- Keep the shell attached:
  - one shared rounded container
  - primary action on the left
  - chevron trigger on the right
- Use structural borders only where the attachment needs definition:
  - shell border: `border-white/[0.07]`
  - open state border: `border-white/20`
  - chevron divider: `border-white/[0.08]`
- Keep the idle surface subtle:
  - shell base: `bg-sparkle-card`
  - menu surface: `bg-sparkle-card`
- Put color in the selected state, not in the full container:
  - selected trigger half gets the tint
  - chevron half inherits the same tone family
  - selected menu row gets the tint
  - use a small colored dot for fast scanning
- Let the selected option drive the tone. Different selected states should be allowed to use different colors within the same control.
- Keep the control compact:
  - trigger height: `h-8`
  - trigger text: `text-xs`
  - menu rows: `text-xs`, `px-2.5`, `py-1.5`

## Supported Tones

The shared component currently exposes:

- `sky`
- `amber`
- `emerald`
- `violet`
- `rose`

Add tones only when they map to a real state family in the UI. Do not introduce arbitrary colors per screen.

## Reusable API

`ConnectedDropdownButton` accepts:

- `value`
- `options`
- `onChange`
- `className`
- `tone`
- `menuLabel`

Option shape:

- `{ id: string; label: string; tone?: ConnectedDropdownButtonTone }`

## Example Usage

```tsx
import { ConnectedDropdownButton } from '@/components/ui/ConnectedDropdownButton'

<ConnectedDropdownButton
    value={settings.assistantTextStreamingMode}
    options={[
        { id: 'stream', label: 'Live stream', tone: 'sky' },
        { id: 'chunks', label: 'Chunked output', tone: 'amber' }
    ]}
    menuLabel="Choose streaming mode"
    onChange={(value) => updateSettings({ assistantTextStreamingMode: value as 'stream' | 'chunks' })}
/>
```

## Implementation Notes

- The left side is the fast action. It switches to the alternate option directly.
- The chevron opens the full option list.
- The menu stays attached to the shell and drops inline below the trigger.
- The expanded border treatment should match `PreviewHeaderEditMenu`:
  - shell opens with `rounded-b-none`
  - shell uses `border-b-transparent`
  - menu attaches with `-mt-px`
  - menu adds a top alignment line with `absolute inset-x-0 top-0 h-px bg-white/[0.08]`
- The selected option is visible in both places:
  - tinted trigger half
  - tinted chevron half
  - tinted selected menu row

## Maintenance Rule

If this control's shape, spacing, or color logic changes materially:

- update `src/renderer/src/components/ui/ConnectedDropdownButton.tsx`
- update the active usage example in `src/renderer/src/pages/settings/AssistantDefaultsPanel.tsx`
- update this document in the same workstream
