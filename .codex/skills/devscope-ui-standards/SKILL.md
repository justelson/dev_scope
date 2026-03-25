---
name: devscope-ui-standards
description: UI standards for DevScope assistant and app chrome styling, especially borders, dividers, separators, compact states, and subtle line treatments. Use when working on assistant UI, sidebars, modals, dropdowns, headers, resize handles, borders, dividers, or timeline styling.
---

# DevScope UI Standards

Read these files before making UI styling changes in the covered surfaces:

1. `docs/current/UI_BORDER_AND_DIVIDER_STANDARDS.md`
2. `docs/current/CURRENT_CODEBASE_ARCHITECTURE.md`

## Workflow

- Do not introduce white-border chrome by default on supported UI surfaces.
- Do not use `border-sparkle-border` as the fallback border treatment either.
- Prefer the existing surface language first: transparent borders, subtle fills, and state changes through background, opacity, and motion.
- Only use visible white borders when the surrounding surface already depends on that treatment for structure or separation.
- Check `src/renderer/src/pages/project-details/ProjectDetailsHeaderSection.tsx` before choosing border values.
- Keep default, hover, active, collapsed, and expanded states visually consistent.
- Match the existing subtle divider behavior before introducing a new one.

## Surfaces

- assistant sidebar
- session rails and rows
- assistant timeline separators/guides
- modals
- dropdowns
- headers
- resize handles
- compact-mode variants

## Divider Rule

- Prefer softened gradients or low-contrast custom guides for subtle separators.
- Do not default to hard full-width border lines where the existing UI uses a softer treatment.

## Verification

- Check compact and non-compact states.
- Check hover and active states.
- If visual verification is not performed, say that explicitly.
