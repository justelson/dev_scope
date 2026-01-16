/**
 * Sparkle Design System - Layout Components
 * 
 * App shell with sidebar navigation and titlebar for desktop apps.
 */

import React, { useRef, useEffect, useState } from "react"
import { cn } from "./utils"

// ========================================
// App Shell - Main Layout Container
// ========================================

export function AppShell({ children, className }) {
  return (
    <div className={cn("flex flex-col h-screen bg-sparkle-bg text-sparkle-text overflow-hidden", className)}>
      {children}
    </div>
  )
}

// ========================================
// Titlebar - Desktop App Header
// ========================================

export function Titlebar({ 
  logo, 
  title, 
  badge,
  onMinimize, 
  onMaximize, 
  onClose 
}) {
  return (
    <div
      style={{ WebkitAppRegion: "drag" }}
      className="h-[50px] fixed top-0 left-0 right-0 z-50 flex justify-between items-center pl-4 border-b border-sparkle-border-secondary bg-sparkle-bg"
    >
      <div className="flex items-center gap-3 border-r h-full w-48 border-sparkle-border-secondary pr-4">
        {logo && <img src={logo} alt={title} className="h-5 w-5" />}
        <span className="text-sparkle-text text-sm font-medium">{title}</span>
        {badge && (
          <div className="bg-sparkle-card border border-sparkle-border-secondary px-2 py-0.5 rounded-xl text-xs text-sparkle-text">
            {badge}
          </div>
        )}
      </div>

      <div className="flex" style={{ WebkitAppRegion: "no-drag" }}>
        <button
          onClick={onMinimize}
          className="h-[50px] w-12 inline-flex items-center justify-center text-sparkle-text-secondary hover:bg-sparkle-accent transition-colors"
        >
          <MinusIcon />
        </button>
        <button
          onClick={onMaximize}
          className="h-[50px] w-12 inline-flex items-center justify-center text-sparkle-text-secondary hover:bg-sparkle-accent transition-colors"
        >
          <SquareIcon />
        </button>
        <button
          onClick={onClose}
          className="h-[50px] w-12 inline-flex items-center justify-center text-sparkle-text-secondary hover:bg-red-600 hover:text-white transition-colors"
        >
          <XIcon />
        </button>
      </div>
    </div>
  )
}

// ========================================
// Sidebar Navigation
// ========================================

export function Sidebar({ children, className }) {
  return (
    <nav className={cn(
      "h-screen w-52 text-sparkle-text fixed left-0 top-0 flex flex-col py-6 border-r border-sparkle-border-secondary z-40",
      className
    )}>
      {children}
    </nav>
  )
}

export function SidebarNav({ tabs, activeTab, onTabChange }) {
  const tabRefs = useRef({})
  const containerRef = useRef(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0 })

  useEffect(() => {
    const updateIndicator = () => {
      const ref = tabRefs.current[activeTab]
      const container = containerRef.current
      if (ref && container) {
        const tabRect = ref.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        setIndicatorStyle({
          top: tabRect.top - containerRect.top,
          height: tabRect.height,
        })
      }
    }
    updateIndicator()
    window.addEventListener("resize", updateIndicator)
    return () => window.removeEventListener("resize", updateIndicator)
  }, [activeTab])

  return (
    <div className="flex-1 flex flex-col gap-2 px-3 mt-10 relative" ref={containerRef}>
      {/* Active indicator bar */}
      <div
        className="absolute left-0 w-1 bg-sparkle-primary rounded transition-all duration-300"
        style={{
          top: indicatorStyle.top,
          height: indicatorStyle.height,
        }}
      />
      
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => (tabRefs.current[tab.id] = el)}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 border",
            activeTab === tab.id
              ? "border-transparent text-sparkle-primary"
              : "text-sparkle-text-secondary hover:bg-sparkle-border-secondary hover:text-sparkle-text border-transparent"
          )}
        >
          {tab.icon}
          <span className="text-sm">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}

// ========================================
// Main Content Area
// ========================================

export function MainContent({ children, className }) {
  return (
    <main className={cn("flex-1 ml-52 pt-[50px] p-6 overflow-auto", className)}>
      {children}
    </main>
  )
}

// ========================================
// Simple Icons (inline SVG)
// ========================================

function MinusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function SquareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
