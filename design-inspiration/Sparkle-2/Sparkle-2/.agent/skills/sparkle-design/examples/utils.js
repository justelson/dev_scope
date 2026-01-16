/**
 * Sparkle Design System - Utility Functions
 */

/**
 * A simple utility for conditionally joining classNames together
 * @param {...string} classes - Class names to join
 * @returns {string} - Joined class names
 * 
 * Usage:
 * cn("base-class", isActive && "active", className)
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

/**
 * Set the current theme
 * @param {string} theme - Theme name: 'dark' | 'light' | 'purple' | 'green' | 'gray' | 'classic'
 */
export function setTheme(theme) {
  const themes = ["dark", "light", "purple", "green", "gray", "classic"]
  document.body.classList.remove(...themes)
  document.body.classList.add(theme)
  document.body.setAttribute("data-theme", theme)
  localStorage.setItem("theme", theme)
}

/**
 * Get the current theme from localStorage or default to 'dark'
 * @returns {string} - Current theme name
 */
export function getTheme() {
  return localStorage.getItem("theme") || "dark"
}

/**
 * Initialize theme on app load
 * Call this in your app's root component useEffect
 */
export function initializeTheme() {
  const theme = getTheme()
  setTheme(theme)
  return theme
}

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Number of bytes
 * @param {number} decimals - Decimal places
 * @returns {string} - Formatted string
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes"
  
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}
