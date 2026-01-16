/**
 * Sparkle Design System - Loading Components
 * 
 * Spinner and progress loading states.
 */

import React from "react"
import { motion } from "framer-motion"
import { cn } from "./utils"

// ========================================
// Spinner
// ========================================

export function Spinner({ size = "md", className }) {
  const sizes = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-[3px]",
    lg: "w-8 h-8 border-[3px]",
    xl: "w-12 h-12 border-4",
  }

  return (
    <div
      className={cn(
        "animate-spin inline-block border-current border-t-transparent text-sparkle-primary rounded-full",
        sizes[size],
        className
      )}
      role="status"
      aria-label="loading"
    />
  )
}

// ========================================
// Loading Screen with Progress
// ========================================

export function LoadingScreen({ steps, currentStep }) {
  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <div className="flex justify-center items-center h-screen bg-sparkle-bg">
      <motion.div 
        className="flex flex-col items-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.div 
          className="text-2xl font-medium mb-8 text-sparkle-text"
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {steps[currentStep]}
        </motion.div>

        {/* Progress bar */}
        <div className="w-64 h-1 bg-sparkle-accent rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-sparkle-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Step indicators */}
        <div className="mt-12 flex space-x-4">
          {steps.map((_, i) => (
            <motion.div
              key={i}
              className={cn(
                "w-3 h-3 rounded-full transition-colors",
                i === currentStep ? "bg-sparkle-primary" : "bg-sparkle-accent"
              )}
              animate={{
                scale: i === currentStep ? 1.2 : 1,
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  )
}

// ========================================
// Skeleton Loader
// ========================================

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        "animate-pulse bg-sparkle-border rounded",
        className
      )}
      {...props}
    />
  )
}

// ========================================
// Loading Overlay
// ========================================

export function LoadingOverlay({ visible, message }) {
  if (!visible) return null

  return (
    <div className="fixed inset-0 bg-sparkle-bg/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        {message && (
          <p className="text-sparkle-text-secondary text-sm">{message}</p>
        )}
      </div>
    </div>
  )
}
