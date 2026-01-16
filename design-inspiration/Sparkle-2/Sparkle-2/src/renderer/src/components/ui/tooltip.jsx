import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

const Tooltip = ({ content, children, side = "top", delay = 0.5 }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [timeoutId, setTimeoutId] = useState(null)

  const handleMouseEnter = () => {
    const id = setTimeout(() => {
      setIsVisible(true)
    }, delay * 1000)
    setTimeoutId(id)
  }

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId)
    setIsVisible(false)
  }

  const sideToPosition = {
    top: { y: -8, x: "-50%" },
    bottom: { y: 8, x: "-50%" },
    left: { x: -8, y: "-50%" },
    right: { x: 8, y: "-50%" },
  }

  const position = sideToPosition[side] || sideToPosition.top

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, ...position }}
            animate={{ opacity: 1, scale: 1, ...position }}
            exit={{ opacity: 0, scale: 0.95, ...position }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 px-2 py-1 text-xs font-medium bg-sparkle-card text-sparkle-text rounded-md shadow-lg border border-sparkle-border whitespace-nowrap"
            style={{
              left: side === "top" || side === "bottom" ? "50%" : undefined,
              bottom: side === "top" ? "100%" : undefined,
              top:
                side === "bottom"
                  ? "100%"
                  : side === "left" || side === "right"
                    ? "50%"
                    : undefined,
              right: side === "left" ? "100%" : undefined,
            }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Tooltip
