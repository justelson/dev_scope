# UI Border And Divider Standards

Last updated: April 19, 2026

This document defines the default border and subtle-separator treatment for the current DevScope UI.

Use it together with:

- `.codex/skills/devscope-ui-standards/SKILL.md`
- `docs/current/CURRENT_CODEBASE_ARCHITECTURE.md`
- `docs/current/CONNECTED_DROPDOWN_BUTTON_PATTERN.md` for attached split-button/dropdown controls

## Primary Rule

Do not use white-border chrome as the default treatment for current UI work.

Do not use `border-sparkle-border` as the default border treatment either.

Prefer:

- transparent or near-invisible borders for controls that do not need structural separation
- subtle fills and opacity changes for idle states
- motion, tint, and background changes for hover/active emphasis

Use visible white borders only when the surrounding surface already relies on them for containment, grouping, or separation.

## Reference Pattern

Reference component:

- `src/renderer/src/pages/project-details/ProjectDetailsHeaderSection.tsx`

Canonical values for cases where a visible border is actually needed:

- default border: `border-white/10`
- hover border: `hover:border-white/20`
- subtle divider: `border-white/5`
- very subtle compact border: `border-white/6` to `border-white/8`
- bordered surface background: `bg-sparkle-card` or `bg-white/[0.03]`
- hover surface background: `hover:bg-white/[0.03]` or `hover:bg-white/10`

Preferred values for non-structural controls:

- idle border: `border-transparent`
- idle surface: `bg-white/[0.02]` to `bg-white/[0.03]`
- idle text: muted or reduced-opacity foreground
- hover emphasis: background/tint change first, border second

## Where This Applies

- assistant sidebar
- assistant session rows
- compact and non-compact assistant states
- modal dialogs
- dropdowns
- buttons and interactive controls
- resize handles
- separators and timeline surfaces when a bordered treatment is needed

## Separator And Divider Treatment

For subtle separators, dividers, and timeline guides:

- do not default to a hard full-width line
- prefer softened guides using gradients or low-contrast custom strokes
- match existing centered fade / shortened span behavior where applicable
- verify visibility in the active theme instead of assuming opacity values are enough

## UI Review Checklist

When touching these surfaces:

1. check the reference component first
2. do not add a visible white border unless the control actually needs structural definition
3. search for stray `border-sparkle-border` usage in the edited surface
4. keep state styling consistent across default, hover, active, collapsed, and expanded states
5. verify compact and non-compact modes
6. verify hover and active states

## When To Update This Doc

Update this file when:

- the canonical border pattern changes
- a new reference component replaces the current standard
- divider/timeline treatment changes materially
