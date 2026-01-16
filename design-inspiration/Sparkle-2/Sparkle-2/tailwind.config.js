/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./src/renderer/index.html", "./src/renderer/src/**/*.{js,ts,jsx,tsx}"],

  theme: {
    extend: {
      colors: {
        sparkle: {
          "old-primary": "#01e5ff",
          primary: "var(--color-primary)",
          text: "var(--color-text)",
          "text-secondary": "var(--color-text-secondary)",
          "text-muted": "var(--color-text-muted)",
          bg: "var(--color-bg)",
          card: "var(--color-card)",
          border: "var(--color-border)",
          secondary: "var(--color-secondary)",
          accent: "var(--color-accent)",
          "border-secondary": "var(--color-border-secondary)",
          "old-secondary": "#005FFF",
        },
      },
    },
  },
}
