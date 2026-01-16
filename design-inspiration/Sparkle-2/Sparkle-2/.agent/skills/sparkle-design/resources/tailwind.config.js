/**
 * Sparkle Design System - Tailwind Configuration
 * 
 * Use this as a reference for extending your tailwind.config.js
 * with Sparkle design tokens.
 */

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sparkle: {
          // Core colors (CSS variables for theming)
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
      fontFamily: {
        sans: ["Poppins", "sans-serif"],
      },
      borderRadius: {
        "sparkle": "0.75rem", // 12px - standard card radius
      },
      animation: {
        "sparkle-spin": "spin 1s linear infinite",
        "sparkle-pulse": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
}
