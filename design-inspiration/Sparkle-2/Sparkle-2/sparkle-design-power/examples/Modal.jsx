/**
 * Sparkle Design System - Modal Component
 * 
 * Animated modal with backdrop blur and escape key support.
 * 
 * Usage:
 * <Modal open={isOpen} onClose={() => setIsOpen(false)}>
 *   <div className="bg-sparkle-card p-6 rounded-2xl border border-sparkle-border text-sparkle-text w-[90vw] max-w-md">
 *     <h2 className="text-lg font-semibold mb-2">Modal Title</h2>
 *     <p className="text-sparkle-text-secondary mb-4">Content goes here</p>
 *     <div className="flex gap-2 justify-end">
 *       <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
 *       <Button variant="primary">Confirm</Button>
 *     </div>
 *   </div>
 * </Modal>
 */

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
