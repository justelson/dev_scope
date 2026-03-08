# Agent Session Constraints

These constraints were explicitly set by the user and should be treated as active defaults in this repo.

## Build/Test Permission
- Do **not** run rebuilds, full builds, or test suites unless the user explicitly re-approves in the current session.
- If validation is needed, prefer lightweight checks (for example, targeted syntax/transpile checks) unless build/test permission is granted.

## Agent/Escalation Permission
- Commands requiring agent/escalated privileges may need fresh approval in a new session.
- If a required command is blocked by sandbox/permissions, request approval before proceeding.

## Assistant UI Notes
- For subtle separators, dividers, and timeline guides in the assistant UI, do **not** use plain border-token lines by default.
- Prefer rebuilt soft guides using gradients or very low-contrast custom strokes, and verify they are actually visible in the current theme instead of assuming opacity values are sufficient.
- When matching an existing subtle line treatment, copy its visual behavior first: centered fade, shortened span, and soft middle emphasis rather than a full hard edge.

## Border Styling Standards
- **CRITICAL**: All borders in the application MUST use the white border pattern, NOT `border-sparkle-border` tokens.
- The standard border pattern used throughout the app (reference: ProjectDetailsHeaderSection.tsx):
  - Default borders: `border-white/10`
  - Hover borders: `hover:border-white/20`
  - Subtle/divider borders: `border-white/5`
  - Very subtle borders (compact mode): `border-white/6` to `border-white/8`
  - Background with borders: `bg-sparkle-card` or `bg-white/[0.03]`
  - Hover backgrounds: `hover:bg-white/[0.03]` or `hover:bg-white/10`
- When working on ANY UI component with borders:
  1. First check ProjectDetailsHeaderSection.tsx for the reference pattern
  2. Use EXACT same border values (border-white/10, hover:border-white/20, etc.)
  3. Apply consistently across ALL states: default, hover, active, collapsed, expanded
  4. Never mix `border-sparkle-border` with `border-white/*` - use white borders exclusively
- Components that MUST follow this pattern:
  - Assistant sidebar (both compact and non-compact modes)
  - All buttons and interactive elements
  - Modal dialogs and dropdowns
  - Session avatars and list items
  - Dividers and separators
  - Resize handles
- When fixing border issues:
  - Search for ALL instances of `border-sparkle-border` in the component
  - Replace with appropriate `border-white/*` values
  - Check both compact and non-compact modes
  - Verify collapsed and expanded states
  - Test hover and active states

