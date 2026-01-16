# Sparkle Design System Power

A modern, premium design system with dark-first themes, CSS variables, Tailwind integration, and reusable UI components. Use this power to apply consistent Sparkle styling to any React/Tailwind project.

## Overview

Sparkle is characterized by:
- Dark-first color themes with 6 theme variants (dark, light, purple, green, gray, classic)
- CSS variable-based theming for seamless theme switching
- Tailwind CSS integration with custom `sparkle-*` color utilities
- Premium UI components with smooth animations
- Poppins font family for modern typography

## Quick Start

### 1. Add CSS Variables

Add the theme CSS to your main stylesheet. See `resources/sparkle.css` for the complete theme definitions.

### 2. Configure Tailwind

Extend your `tailwind.config.js` with Sparkle colors:

```javascript
theme: {
  extend: {
    colors: {
      sparkle: {
        primary: "var(--color-primary)",
        secondary: "var(--color-secondary)",
        text: "var(--color-text)",
        "text-secondary": "var(--color-text-secondary)",
        "text-muted": "var(--color-text-muted)",
        bg: "var(--color-bg)",
        card: "var(--color-card)",
        border: "var(--color-border)",
        "border-secondary": "var(--color-border-secondary)",
        accent: "var(--color-accent)",
      },
    },
  },
}
```

### 3. Use Components

Copy components from the `examples/` folder and customize as needed.

## Color System

| Token | Usage |
|-------|-------|
| `sparkle-bg` | Page/app background |
| `sparkle-card` | Card/panel backgrounds |
| `sparkle-text` | Primary text |
| `sparkle-text-secondary` | Secondary/muted text |
| `sparkle-text-muted` | Hints, placeholders |
| `sparkle-primary` | Primary accent color |
| `sparkle-secondary` | Secondary accent |
| `sparkle-border` | Primary borders |
| `sparkle-border-secondary` | Subtle borders |
| `sparkle-accent` | Hover/active states |

## Common Patterns

### Card
```jsx
<div className="bg-sparkle-card rounded-xl border border-sparkle-border p-5">
  Content
</div>
```

### Button (Primary)
```jsx
<button className="bg-sparkle-primary text-white px-4 py-2 rounded-lg hover:brightness-110 transition-all active:scale-90">
  Click me
</button>
```

### Text Hierarchy
```jsx
<h1 className="text-sparkle-text font-semibold">Title</h1>
<p className="text-sparkle-text-secondary">Description</p>
<span className="text-sparkle-text-muted">Hint</span>
```

## Theme Switching

```javascript
function setTheme(theme) {
  document.body.classList.remove("dark", "light", "purple", "green", "gray", "classic")
  document.body.classList.add(theme)
  localStorage.setItem("theme", theme)
}
```

## Dependencies

```json
{
  "clsx": "^2.0.0",
  "lucide-react": "^0.400.0",
  "framer-motion": "^11.0.0",
  "@headlessui/react": "^2.0.0"
}
```

## Files Included

- `resources/sparkle.css` - Complete CSS with all themes
- `resources/tailwind.config.js` - Tailwind configuration
- `examples/Button.jsx` - Button component with variants
- `examples/Modal.jsx` - Animated modal component
- `examples/FormComponents.jsx` - Toggle, Checkbox, Input, Select
- `examples/InfoCard.jsx` - Information card component
- `examples/Tooltip.jsx` - Animated tooltip component
- `examples/utils.js` - Utility functions (cn)
