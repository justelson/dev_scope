import { useEffect, useState } from "react"
import { motion } from "framer-motion"

function Loading({ onLoadingComplete }) {
  const [loadingStep, setLoadingStep] = useState(0)

  const steps = ["Loading tweaks", "Checking backups", "Fetching system info"]

  useEffect(() => {
    const stepIntervals = [
      setTimeout(() => setLoadingStep(1), 1000),
      setTimeout(() => setLoadingStep(2), 2000),
      setTimeout(() => {
        setTimeout(() => onLoadingComplete(), 1000)
      }, 2900),
    ]

    return () => {
      stepIntervals.forEach((interval) => clearTimeout(interval))
    }
  }, [onLoadingComplete])

  const pulseVariants = {
    initial: { scale: 1 },
    animate: {
      scale: [1, 1.05, 1],
      opacity: [0.7, 1, 0.7],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  }

  const progressVariants = {
    initial: { width: 0 },
    animate: (custom) => ({
      width: `${((custom + 1) / steps.length) * 100}%`,
      transition: {
        duration: 1,
        ease: "easeOut",
      },
    }),
  }

  return (
    <div className="flex justify-center items-center h-screen">
      <motion.div
        className="flex flex-col items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="text-2xl font-medium mb-8 text-sparkle-text"
          variants={pulseVariants}
          initial="initial"
          animate="animate"
          key={loadingStep}
        >
          {steps[loadingStep]}
        </motion.div>

        <div className="w-64 h-1 bg-sparkle-accent rounded-full ">
          <motion.div
            className="h-full bg-sparkle-primary"
            variants={progressVariants}
            custom={loadingStep}
            initial="initial"
            animate="animate"
          />
        </div>

        <div className="mt-12 flex space-x-4">
          {steps.map((_, i) => (
            <motion.div
              key={i}
              className={`w-3 h-3 rounded-full ${i === loadingStep ? "bg-sparkle-primary" : "bg-sparkle-accent"}`}
              animate={{
                scale: i === loadingStep ? [1, 1.2, 1] : 1,
                opacity: i === loadingStep ? 1 : 0.6,
              }}
              transition={{
                duration: 0.8,
                repeat: i === loadingStep ? Infinity : 0,
                repeatType: "reverse",
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  )
}

export default Loading
