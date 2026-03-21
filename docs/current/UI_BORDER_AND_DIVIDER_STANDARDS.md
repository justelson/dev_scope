# UI Border And Divider Standards

Last updated: March 19, 2026

This document defines the default border and subtle-separator treatment for the current DevScope UI.

Use it together with:

- `.codex/skills/devscope-ui-standards/SKILL.md`
- `docs/current/CURRENT_CODEBASE_ARCHITECTURE.md`

## Primary Rule

Use white-border patterns for application UI borders.

Do not use `border-sparkle-border` as the default border treatment for current UI work.

## Reference Pattern

Reference component:

- `src/renderer/src/pages/project-details/ProjectDetailsHeaderSection.tsx`

Canonical values:

- default border: `border-white/10`
- hover border: `hover:border-white/20`
- subtle divider: `border-white/5`
- very subtle compact border: `border-white/6` to `border-white/8`
- bordered surface background: `bg-sparkle-card` or `bg-white/[0.03]`
- hover surface background: `hover:bg-white/[0.03]` or `hover:bg-white/10`

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
2. keep border tokens consistent across default, hover, active, collapsed, and expanded states
3. search for stray `border-sparkle-border` usage in the edited surface
4. verify compact and non-compact modes
5. verify hover and active states

## When To Update This Doc

Update this file when:

- the canonical border pattern changes
- a new reference component replaces the current standard
- divider/timeline treatment changes materially
