---
name: Sparkle Design System
description: A modern, premium design system with dark mode themes, CSS variables, Tailwind integration, and reusable UI components for building stunning desktop and web applications.
---

# Sparkle Design System

This skill provides guidelines and resources for implementing the **Sparkle design system** in any project. Sparkle is characterized by its dark-first color themes, CSS variable-based theming, gradient accents, smooth animations, and premium UI components.

## When to Use This Skill

Use Sparkle design when you want:
- A modern, premium look with dark mode as default
- Multiple color theme support (dark, light, purple, green, gray, classic)
- Consistent UI components with smooth transitions
- Desktop-class UI (especially Electron apps)
- Professional dashboard or utility applications

---

## Design Tokens & Color System

### CSS Variables (Root Theming)

Sparkle uses CSS custom properties for seamless theme switching. Define these in your base CSS:

```css
/* Dark Theme (Default) */
:root {
  --color-bg: #0c121f;
  --color-text: #f0f4f8;
  --color-text-dark: #d3dbe4;
  --color-text-darker: #aab4c3;
  --color-text-secondary: #7e92a9;
  --color-text-muted: #3b4658;
  --color-card: #131c2c;
  --color-border: #1f2a3d;
  --color-border-secondary: #212f44;
  --color-primary: #4f90e6;
  --color-secondary: #3db58a;
  --color-accent: #243144;
}

/* Light Theme */
.light {
  --color-bg: #f9fafb;
  --color-text: #1e293b;
  --color-text-dark: #334155;
  --color-text-darker: #475569;
  --color-text-secondary: #64748b;
  --color-text-muted: #94a3b8;
  --color-card: #ffffff;
  --color-border: #e2e8f0;
  --color-border-secondary: #cbd5e1;
  --color-primary: #3b82f6;
  --color-secondary: #2dac7d;
  --color-accent: #f1f5f9;
}

/* Purple Theme */
.purple {
  --color-bg: #151122;
  --color-text: #dac9f5;
  --color-text-dark: #c6aef5;
  --color-text-darker: #b091e6;
  --color-text-secondary: #a48adf;
  --color-text-muted: #3c305a;
  --color-card: #1e1830;
  --color-border: #301a54;
  --color-border-secondary: #341d5a;
  --color-primary: #7c32cc;
  --color-secondary: #6a1cb4;
  --color-accent: #341a4c;
}

/* Green Theme */
.green {
  --color-bg: #0a1a11;
  --color-text: #cceccc;
  --color-text-dark: #9fd9a3;
  --color-text-darker: #76b981;
  --color-text-secondary: #4fd19c;
  --color-text-muted: #365542;
  --color-card: #122c1d;
  --color-border: #1a3f28;
  --color-border-secondary: #153422;
  --color-primary: #1ebd87;
  --color-secondary: #047857;
  --color-accent: #254335;
}

/* Gray Theme */
.gray {
  --color-bg: #111214;
  --color-text: #f5f6fa;
  --color-text-dark: #e0e2e6;
  --color-text-darker: #c8ccd2;
  --color-text-secondary: #aeb3bb;
  --color-text-muted: #7a7f87;
  --color-card: #18191b;
  --color-border: #202124;
  --color-border-secondary: #232426;
  --color-primary: #6366f1;
  --color-secondary: #818cf8;
  --color-accent: #232324;
}

/* Classic Theme */
.classic {
  --color-bg: #0f172a;
  --color-text: #ffffff;
  --color-text-dark: #e6e6e6;
  --color-text-darker: #cccccc;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #475569;
  --color-card: #162033;
  --color-border: #253144;
  --color-border-secondary: #1e293b;
  --color-primary: #3b82f6;
  --color-secondary: #2dac7d;
  --color-accent: #2e394b;
}
```

### Tailwind Configuration

Extend Tailwind with Sparkle colors:

```javascript
/** @type {import('tailwindcss').Config} */
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

---

## Typography

Sparkle uses the **Poppins** font family for a modern, clean look:

```css
@import url("https://fonts.googleapis.com/css2?family=Poppins:wght@100;200;300;400;500;600;700;800;900&display=swap");

@layer base {
  html {
    font-family: "Poppins", sans-serif;
  }
}
```

### Text Styles

| Class | Usage |
|-------|-------|
| `text-sparkle-text` | Primary text color |
| `text-sparkle-text-secondary` | Secondary/muted text |
| `text-sparkle-text-muted` | Hints, placeholders |
| `text-sparkle-primary` | Accent/interactive text |

---

## UI Components

### Button Component

```jsx
import React from "react"
import clsx from "clsx"

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-5 py-3 text-lg",
}

export default function Button({
  children,
  variant = "primary",
  size = "sm",
  className = "",
  disabled = false,
  ...props
}) {
  const base =
    "flex items-center rounded-lg font-medium transition-all duration-200 select-none focus:outline-none active:scale-90"

  const variants = {
    primary:
      "bg-sparkle-primary text-white hover:brightness-110 border-sparkle-secondary hover:bg-sparkle-secondary hover:border-sparkle-primary",
    outline:
      "border border-sparkle-primary text-sparkle-primary hover:bg-sparkle-primary hover:text-white",
    secondary:
      "bg-sparkle-card border border-sparkle-secondary text-sparkle-text hover:bg-sparkle-secondary hover:border-sparkle-card",
    danger:
      "bg-red-600 text-white border border-red-700 hover:bg-red-700 hover:border-red-800 focus:ring-red-500",
  }

  const disabledClasses = "opacity-50 cursor-not-allowed pointer-events-none"

  return (
    <button
      className={clsx(
        base,
        sizes[size],
        variants[variant],
        disabled ? disabledClasses : "",
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
```

### Modal Component

```jsx
import React, { useEffect } from "react"

export default function Modal({ open, onClose, children }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose()
    }
    if (open) window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  return (
    <div
      onClick={onClose}
      className={`
        fixed inset-0 flex justify-center items-center z-50 transition-all
        ${open ? "visible bg-black/60 backdrop-blur-sm" : "invisible bg-black/0"}
      `}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`
          transform transition-all duration-300 ease-out
          ${open ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}
        `}
      >
        {children}
      </div>
    </div>
  )
}
```

**Usage:**
```jsx
<Modal open={showModal} onClose={() => setShowModal(false)}>
  <div className="bg-sparkle-card p-6 rounded-2xl border border-sparkle-border text-sparkle-text w-[90vw] max-w-md">
    <h2 className="text-lg font-semibold">Modal Title</h2>
    <p>Modal content goes here</p>
  </div>
</Modal>
```

### Toggle Component

```jsx
export default function Toggle({ checked, onChange, disabled }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <div className="w-11 h-6 bg-sparkle-border-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sparkle-primary"></div>
    </label>
  )
}
```

### Checkbox Component

```jsx
import { useId } from "react"
import { Check } from "lucide-react"

export default function Checkbox({ label, checked, onChange }) {
  const id = useId()

  return (
    <label
      htmlFor={id}
      className="flex items-center gap-2 cursor-pointer select-none text-sparkle-text"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer hidden"
      />
      <div className="h-5 w-5 rounded-md border-2 border-sparkle-border flex items-center justify-center transition-colors peer-checked:bg-sparkle-primary peer-checked:border-sparkle-border">
        {checked && <Check className="h-3.5 w-3.5 text-white" />}
      </div>
      <span className="text-sm">{label}</span>
    </label>
  )
}
```

### InfoCard Component

```jsx
import { cn } from "@/lib/utils"

export default function InfoCard({
  icon: Icon,
  iconBgColor = "bg-blue-500/10",
  iconColor = "text-blue-500",
  title,
  subtitle,
  items = [],
  className,
  ...props
}) {
  return (
    <div
      className={cn(
        "bg-sparkle-card backdrop-blur-sm rounded-xl border border-sparkle-border hover:shadow-sm overflow-hidden p-5",
        className
      )}
      {...props}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className={cn("p-3 rounded-lg", iconBgColor)}>
          <Icon className={cn("text-lg", iconColor)} size={24} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-sparkle-text mb-1">{title}</h2>
          {subtitle && <p className="text-sparkle-text-secondary text-sm">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index}>
            <p className="text-sparkle-text-secondary text-xs mb-1">{item.label}</p>
            <p className="text-sparkle-text font-medium">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Layout Patterns

### App Shell with Sidebar Navigation

```jsx
function App() {
  return (
    <div className="flex flex-col h-screen bg-sparkle-bg text-sparkle-text overflow-hidden">
      <TitleBar />
      <Nav />
      <div className="flex flex-1 pt-[50px] relative">
        <main className="flex-1 ml-52 p-6">
          {/* Page content */}
        </main>
      </div>
    </div>
  )
}
```

### Titlebar (Electron)

```jsx
import { Minus, Square, X } from "lucide-react"

function TitleBar() {
  return (
    <div
      style={{ WebkitAppRegion: "drag" }}
      className="h-[50px] fixed top-0 left-0 right-0 z-10 flex justify-between items-center pl-4 border-b border-sparkle-border-secondary"
    >
      <div className="flex items-center gap-3 border-r h-full w-48 border-sparkle-border-secondary pr-4">
        <img src={logo} alt="App" className="h-5 w-5" />
        <span className="text-sparkle-text text-sm font-medium">AppName</span>
        <div className="bg-sparkle-card border border-sparkle-border-secondary p-1 rounded-xl w-16 text-center text-sm text-sparkle-text">
          Beta
        </div>
      </div>

      <div className="flex" style={{ WebkitAppRegion: "no-drag" }}>
        <button className="h-[50px] w-12 inline-flex items-center justify-center text-sparkle-text-secondary hover:bg-sparkle-accent transition-colors">
          <Minus size={16} />
        </button>
        <button className="h-[50px] w-12 inline-flex items-center justify-center text-sparkle-text-secondary hover:bg-sparkle-accent transition-colors">
          <Square size={14} />
        </button>
        <button className="h-[50px] w-12 inline-flex items-center justify-center text-sparkle-text-secondary hover:bg-red-600 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
```

### Sidebar Navigation

```jsx
function Nav() {
  const tabs = {
    home: { label: "Dashboard", path: "/" },
    settings: { label: "Settings", path: "/settings" },
    // Add more tabs...
  }

  return (
    <nav className="h-screen w-52 text-sparkle-text fixed left-0 top-0 flex flex-col py-6 border-r border-sparkle-border-secondary z-40">
      <div className="flex-1 flex flex-col gap-2 px-3 mt-10 relative">
        {/* Active indicator bar */}
        <div className="absolute left-0 w-1 bg-sparkle-primary rounded transition-all duration-300" />
        
        {Object.entries(tabs).map(([id, { label, path }]) => (
          <button
            key={id}
            onClick={() => navigate(path)}
            className={clsx(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 border",
              isActive
                ? "border-transparent text-sparkle-primary"
                : "text-sparkle-text-secondary hover:bg-sparkle-border-secondary hover:text-sparkle-text border-transparent"
            )}
          >
            <Icon size={20} />
            <span className="text-sm">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
```

---

## Custom Scrollbar

```css
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: var(--color-border);
  border-radius: 5px;
  transition: all 0.2s ease-in-out;
}

::-webkit-scrollbar-thumb {
  background: var(--color-primary);
  border-radius: 5px;
  transition: all 0.2s ease-in-out;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-secondary);
}
```

### No Scrollbar Utility

```css
@layer utilities {
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
}
```

---

## Loading States

### Spinner

```jsx
<div
  className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-sparkle-primary rounded-full"
  role="status"
  aria-label="loading"
/>
```

### Loading Screen with Progress

```jsx
import { motion } from "framer-motion"

function Loading({ steps, currentStep }) {
  return (
    <div className="flex justify-center items-center h-screen">
      <motion.div className="flex flex-col items-center">
        <motion.div className="text-2xl font-medium mb-8 text-sparkle-text">
          {steps[currentStep]}
        </motion.div>

        <div className="w-64 h-1 bg-sparkle-accent rounded-full">
          <motion.div
            className="h-full bg-sparkle-primary"
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="mt-12 flex space-x-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full ${
                i === currentStep ? "bg-sparkle-primary" : "bg-sparkle-accent"
              }`}
            />
          ))}
        </div>
      </motion.div>
    </div>
  )
}
```

---

## Toast Notifications

When using react-toastify, apply Sparkle styling:

```css
.Toastify__toast-theme--dark {
  @apply bg-[--color-card] text-[--color-text] border border-[--color-border] shadow-lg;
}
```

```jsx
<ToastContainer
  stacked
  limit={5}
  position="bottom-right"
  theme="dark"
  transition={Slide}
  hideProgressBar
  pauseOnFocusLoss={false}
/>
```

---

## Utility Function

```javascript
/**
 * A simple utility for conditionally joining classNames together
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}
```

---

## Common Card Pattern

```jsx
<div className="bg-sparkle-card backdrop-blur-sm rounded-xl border border-sparkle-border hover:shadow-sm overflow-hidden p-3 w-full flex gap-4 items-center">
  <div className="p-3 bg-yellow-500/10 rounded-lg">
    <Icon className="text-yellow-500" size={18} />
  </div>
  <div>
    <h1 className="font-medium text-sparkle-text">Card Title</h1>
    <p className="text-sparkle-text-secondary">Card description</p>
  </div>
  <div className="ml-auto">
    <Button variant="outline">Action</Button>
  </div>
</div>
```

---

## Theme Switching

To switch themes, add the theme class to the body element:

```javascript
function setTheme(theme) {
  document.body.classList.remove("dark", "light", "purple", "green", "gray", "classic")
  document.body.classList.add(theme)
  document.body.setAttribute("data-theme", theme)
  localStorage.setItem("theme", theme)
}
```

---

## Recommended Dependencies

```json
{
  "dependencies": {
    "clsx": "^2.0.0",
    "lucide-react": "^0.400.0",
    "framer-motion": "^11.0.0",
    "react-toastify": "^10.0.0",
    "@headlessui/react": "^2.0.0"
  }
}
```

---

## Quick Reference

| Element | Sparkle Classes |
|---------|----------------|
| Background | `bg-sparkle-bg` |
| Card | `bg-sparkle-card rounded-xl border border-sparkle-border` |
| Text Primary | `text-sparkle-text` |
| Text Secondary | `text-sparkle-text-secondary` |
| Text Muted | `text-sparkle-text-muted` |
| Primary Accent | `bg-sparkle-primary text-white` |
| Borders | `border-sparkle-border` or `border-sparkle-border-secondary` |
| Hover State | `hover:bg-sparkle-accent` or `hover:bg-sparkle-border-secondary` |
| Active Nav | `text-sparkle-primary` with indicator |

---

## Source Reference

This design system is based on the [Sparkle](https://github.com/Parcoil/Sparkle) project - a Windows optimization and debloating application built with Electron, React, and Tailwind CSS.
