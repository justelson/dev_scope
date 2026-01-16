# Sparkle Design System - Kiro Power

A modern, premium design system power for Kiro that provides dark-first themes, CSS variables, Tailwind integration, and reusable UI components.

## Installation

To use this power globally in Kiro:

1. Copy the `sparkle-design-power` folder to your Kiro powers directory:
   - Windows: `%USERPROFILE%\.kiro\powers\sparkle-design`
   - macOS/Linux: `~/.kiro/powers/sparkle-design`

2. Restart Kiro or reload powers

3. The power will now be available in any project when you mention design, UI, components, or styling

## What's Included

### Resources
- `sparkle.css` - Complete CSS with 6 theme variants (dark, light, purple, green, gray, classic)
- `tailwind.config.js` - Tailwind configuration with Sparkle color tokens

### Components (examples/)
- `Button.jsx` - Button with primary, outline, secondary, danger, ghost variants
- `Card.jsx` - Card container with header, content, footer sections
- `FormComponents.jsx` - Toggle, Checkbox, Input, Select, Textarea
- `InfoCard.jsx` - Information card with icon header
- `Layout.jsx` - App shell, Titlebar, Sidebar navigation
- `Loading.jsx` - Spinner, LoadingScreen, Skeleton, LoadingOverlay
- `Modal.jsx` - Animated modal with backdrop
- `Tooltip.jsx` - Animated tooltip with position options
- `utils.js` - Utility functions (cn, setTheme, getTheme)

### Steering Guides
- `getting-started.md` - Setup guide for new projects
- `component-patterns.md` - Common UI patterns reference

## Usage

When working on any React/Tailwind project, ask Kiro to:
- "Use Sparkle design system for this component"
- "Style this page with Sparkle"
- "Create a card using Sparkle patterns"
- "Add dark mode with Sparkle themes"

## Color Tokens

| Token | Usage |
|-------|-------|
| `sparkle-bg` | Page background |
| `sparkle-card` | Card backgrounds |
| `sparkle-text` | Primary text |
| `sparkle-text-secondary` | Secondary text |
| `sparkle-text-muted` | Muted/placeholder text |
| `sparkle-primary` | Primary accent |
| `sparkle-secondary` | Secondary accent |
| `sparkle-border` | Primary borders |
| `sparkle-border-secondary` | Subtle borders |
| `sparkle-accent` | Hover states |

## Based On

This design system is extracted from [Sparkle](https://github.com/Parcoil/Sparkle) - a Windows optimization application built with Electron, React, and Tailwind CSS.
