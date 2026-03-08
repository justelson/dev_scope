/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
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
      fontFamily: {
        sans: ["DM Sans", "Poppins", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}

