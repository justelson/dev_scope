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
          transform transition-all
          duration-300 ease-out
          ${open ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}
        `}
      >
        {children}
      </div>
    </div>
  )
}
