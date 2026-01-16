# Sparkle Design System - AI Assistant Setup Guide

This document explains how we set up the Sparkle Design System as a reusable design resource for AI coding assistants, and how to adapt it for other AI tools.

---

## What We Built

We extracted the complete design language from the Sparkle app and packaged it as:

1. **Design tokens** (CSS variables + Tailwind config)
2. **Component library** (React/JSX examples)
3. **Steering instructions** (how the AI should use it)

This allows any AI assistant to consistently apply Sparkle's design patterns when building UI.

---

## Kiro Setup (What We Did)

### Location
```
C:\Users\<username>\.kiro\steering\sparkle-design.md
```

### Key Features
- **Manual inclusion** (`inclusion: manual` in front-matter) - Call it with `#sparkle-design` in chat
- **Interactive flow** - AI asks what you're building, then recommends settings
- **Customizable** - Creativity level, layout type, theme, animations

### Files Created
```
sparkle-design-power/           # Full power package
├── POWER.md                    # Main documentation
├── power.json                  # Metadata
├── README.md                   # Installation guide
├── resources/
│   ├── sparkle.css            # Complete CSS with 6 themes
│   └── tailwind.config.js     # Tailwind color tokens
├── examples/
│   ├── Button.jsx
│   ├── Card.jsx
│   ├── FormComponents.jsx
│   ├── InfoCard.jsx
│   ├── Layout.jsx
│   ├── Loading.jsx
│   ├── Modal.jsx
│   ├── Tooltip.jsx
│   └── utils.js
└── steering/
    ├── getting-started.md
    └── component-patterns.md

sparkle-steering-manual.md      # The steering file installed to Kiro
```

---

## Adapting for Other AI Tools

### For Cursor

1. Create `.cursor/rules/sparkle-design.md` in your project or globally
2. Copy the content from `sparkle-steering-manual.md`
3. Remove the front-matter (`---` block) - Cursor doesn't use it
4. Add to the top:
```
You are using the Sparkle Design System. Follow these instructions when building UI.
```

### For GitHub Copilot

1. Create `.github/copilot-instructions.md` in your repo
2. Paste the design system content
3. Copilot will use it as context for that repository

### For Claude (via API or claude.ai Projects)

1. Add as a **Project Knowledge** file or system prompt
2. Use the full content from `sparkle-steering-manual.md`
3. The instructions section works as-is

### For ChatGPT (Custom GPT or API)

1. Create a Custom GPT with the design system as instructions
2. Or include in system prompt for API calls:
```
You are a UI developer using the Sparkle Design System.

[Paste full content of sparkle-steering-manual.md here]
```

### For Windsurf / Codeium

1. Create `.windsurfrules` or add to workspace settings
2. Include the design system documentation

### For Any Other AI Tool

The core content you need is in `sparkle-steering-manual.md`. Adapt the delivery method:

| Tool | Location | Format |
|------|----------|--------|
| Kiro | `~/.kiro/steering/` | Markdown with front-matter |
| Cursor | `.cursor/rules/` | Plain markdown |
| Copilot | `.github/copilot-instructions.md` | Plain markdown |
| Claude | Project Knowledge / System Prompt | Plain text |
| ChatGPT | Custom GPT Instructions | Plain text |
| API calls | System message | Plain text |

---

## The Steering Instructions (Core Content)

This is the key part that makes the AI interactive. Copy this pattern for any tool:

```markdown
## Instructions

When asked to build UI, follow this flow:

### Step 0: Understand & Recommend First
Ask: "What are you building? Give me a quick description."

Based on their answer, PROVIDE YOUR OWN RECOMMENDATIONS:
> "Based on your [app description], here's what I'd recommend:
> - **Creativity Level**: [1-5] - [reason]
> - **Layout Type**: [type] - [reason]  
> - **Theme**: [theme] - [reason]
> - **Animations**: [yes/no] - [reason]
> 
> Want to go with these, or customize any of them?"

### Creativity Levels
1: Strict - Follow patterns exactly
2: Conservative - Minor tweaks only
3: Balanced - Mix of standard and custom
4: Creative - Experimental combinations
5: Wild - Push boundaries

### Layout Types
- Dashboard: Data-heavy with charts/stats
- Feed/List: Vertical content streams
- Tabbed: Tab bar navigation
- Grid: Columns/rows for visual items
- Split-View: List + detail panels
- Steppers: Multi-step flows
- Cards: Content in card containers
- Hub and Spoke: Central home with feature branches
```

---

## Design System Reference (Include This Too)

Always include the actual design tokens and patterns. Key sections:

### CSS Variables (Themes)
```css
:root {
  --color-bg: #0c121f;
  --color-text: #f0f4f8;
  --color-card: #131c2c;
  --color-border: #1f2a3d;
  --color-primary: #4f90e6;
  --color-secondary: #3db58a;
  /* ... see sparkle.css for all themes */
}
```

### Tailwind Config
```javascript
colors: {
  sparkle: {
    primary: "var(--color-primary)",
    bg: "var(--color-bg)",
    card: "var(--color-card)",
    text: "var(--color-text)",
    border: "var(--color-border)",
    // ... etc
  }
}
```

### Common Patterns
```jsx
// Card
<div className="bg-sparkle-card rounded-xl border border-sparkle-border p-5">

// Button
<button className="bg-sparkle-primary text-white px-4 py-2 rounded-lg hover:brightness-110 transition-all active:scale-90">

// Text hierarchy
<h1 className="text-sparkle-text font-semibold">
<p className="text-sparkle-text-secondary">
<span className="text-sparkle-text-muted">
```

---

## Quick Setup Checklist

- [ ] Copy `sparkle-steering-manual.md` to your AI tool's config location
- [ ] Adjust format if needed (remove front-matter for non-Kiro tools)
- [ ] Include `resources/sparkle.css` content for full theme definitions
- [ ] Include `resources/tailwind.config.js` for Tailwind setup
- [ ] Optionally include component examples from `examples/` folder
- [ ] Test by asking the AI to build a simple card or button

---

## Source

This design system is extracted from [Sparkle](https://github.com/Parcoil/Sparkle) - a Windows optimization app built with Electron, React, and Tailwind CSS.
