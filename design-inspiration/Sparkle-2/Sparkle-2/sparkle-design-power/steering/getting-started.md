# Getting Started with Sparkle Design System

This guide walks you through setting up Sparkle in a new or existing project.

## Step 1: Install Dependencies

```bash
npm install clsx lucide-react framer-motion
# or
yarn add clsx lucide-react framer-motion
```

Optional for advanced components:
```bash
npm install @headlessui/react
```

## Step 2: Add Sparkle CSS

Copy `resources/sparkle.css` to your project's styles folder and import it in your main entry point:

```javascript
// main.jsx or App.jsx
import "./styles/sparkle.css"
```

Or add the CSS variables directly to your existing stylesheet.

## Step 3: Configure Tailwind

Merge the Sparkle config with your existing `tailwind.config.js`:

```javascript
export default {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,html}"],
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
  },
}
```

## Step 4: Set Up Theme

Initialize the theme in your app:

```javascript
// App.jsx
import { useEffect } from "react"
import { initTheme } from "./lib/sparkle-utils"

function App() {
  useEffect(() => {
    initTheme()
  }, [])

  return (
    <div className="min-h-screen bg-sparkle-bg text-sparkle-text">
      {/* Your app content */}
    </div>
  )
}
```

## Step 5: Copy Components

Copy the components you need from `examples/` to your project's components folder. Adjust import paths as needed.

## Quick Patterns

### Basic Page Layout
```jsx
<div className="min-h-screen bg-sparkle-bg text-sparkle-text p-6">
  <h1 className="text-2xl font-semibold mb-4">Page Title</h1>
  <div className="grid gap-4">
    {/* Content */}
  </div>
</div>
```

### Card Grid
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-5">
    Card 1
  </div>
  <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-5">
    Card 2
  </div>
</div>
```

### Form Section
```jsx
<div className="bg-sparkle-card rounded-xl border border-sparkle-border p-6 space-y-4">
  <h2 className="text-lg font-semibold text-sparkle-text">Settings</h2>
  <Input label="Name" placeholder="Enter your name" />
  <Select label="Theme" options={themeOptions} />
  <Button variant="primary">Save</Button>
</div>
```
