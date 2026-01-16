/**
 * Sparkle Design System - Utility Functions
 */

/**
 * A simple utility for conditionally joining classNames together
 * @param {...string} classes - Class names to join
 * @returns {string} - Joined class names
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

/**
 * Set the current theme
 * @param {string} theme - Theme name: "dark" | "light" | "purple" | "green" | "gray" | "classic"
 */
export function setTheme(theme) {
  document.body.classList.remove("dark", "light", "purple", "green", "gray", "classic")
  document.body.classList.add(theme)
  document.body.setAttribute("data-theme", theme)
  localStorage.setItem("sparkle-theme", theme)
}

/**
 * Get the current theme from localStorage or default to dark
 * @returns {string} - Current theme name
 */
export function getTheme() {
  return localStorage.getItem("sparkle-theme") || "dark"
}

/**
 * Initialize theme on app load
 */
export function initTheme() {
  const theme = getTheme()
  setTheme(theme)
}
