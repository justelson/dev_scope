/**
 * Sparkle Design System - Form Components
 * Toggle, Checkbox, Input, Select
 */

import React, { useId } from "react"
import { Check, ChevronDown } from "lucide-react"

// ========================================
// Toggle Component
// ========================================

export function Toggle({ checked, onChange, disabled, label }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 gap-3">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <div className="w-11 h-6 bg-sparkle-border-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sparkle-primary peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
      {label && <span className="text-sm text-sparkle-text">{label}</span>}
    </label>
  )
}

// ========================================
// Checkbox Component
// ========================================

export function Checkbox({ label, checked, onChange }) {
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
        aria-checked={checked}
      />
      <div className="h-5 w-5 rounded-md border-2 border-sparkle-border flex items-center justify-center transition-colors peer-checked:bg-sparkle-primary peer-checked:border-sparkle-primary">
        {checked && <Check className="h-3.5 w-3.5 text-white" />}
      </div>
      <span className="text-sm">{label}</span>
    </label>
  )
}

// ========================================
// Input Component
// ========================================

export function Input({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  error,
  className = "",
  ...props
}) {
  const id = useId()

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm text-sparkle-text-secondary">
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`
          w-full px-4 py-2.5 rounded-lg
          bg-sparkle-card border border-sparkle-border
          text-sparkle-text placeholder-sparkle-text-muted
          focus:outline-none focus:border-sparkle-primary focus:ring-1 focus:ring-sparkle-primary
          transition-colors duration-200
          ${error ? "border-red-500" : ""}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}

// ========================================
// Select Component
// ========================================

export function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select an option",
  className = "",
  ...props
}) {
  const id = useId()

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm text-sparkle-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={onChange}
          className={`
            w-full px-4 py-2.5 rounded-lg
            bg-sparkle-card border border-sparkle-border
            text-sparkle-text
            focus:outline-none focus:border-sparkle-primary focus:ring-1 focus:ring-sparkle-primary
            transition-colors duration-200
            appearance-none cursor-pointer pr-10
            ${className}
          `}
          {...props}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sparkle-text-secondary pointer-events-none" />
      </div>
    </div>
  )
}

// ========================================
// Textarea Component
// ========================================

export function Textarea({
  label,
  placeholder,
  value,
  onChange,
  rows = 4,
  error,
  className = "",
  ...props
}) {
  const id = useId()

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm text-sparkle-text-secondary">
          {label}
        </label>
      )}
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className={`
          w-full px-4 py-2.5 rounded-lg resize-none
          bg-sparkle-card border border-sparkle-border
          text-sparkle-text placeholder-sparkle-text-muted
          focus:outline-none focus:border-sparkle-primary focus:ring-1 focus:ring-sparkle-primary
          transition-colors duration-200
          ${error ? "border-red-500" : ""}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
