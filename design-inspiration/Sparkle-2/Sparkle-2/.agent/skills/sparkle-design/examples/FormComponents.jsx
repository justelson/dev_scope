/**
 * Sparkle Design System - Form Components
 * Toggle and Checkbox
 */

import React, { useId } from "react"
import { Check } from "lucide-react"

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
            <div className="w-11 h-6 bg-sparkle-border-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sparkle-primary"></div>
            {label && <span className="text-sm text-sparkle-text">{label}</span>}
        </label>
    )
}

// ========================================
// Checkbox Component
// ========================================

export function Checkbox({ label, checked, onChange, onClick }) {
    const id = useId()

    return (
        <label
            htmlFor={id}
            onClick={onClick}
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
            <div className="h-5 w-5 rounded-md border-2 border-sparkle-border flex items-center justify-center transition-colors peer-checked:bg-sparkle-primary peer-checked:border-sparkle-border">
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
          appearance-none cursor-pointer
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
        </div>
    )
}
