import { create } from "zustand"

const useTweaksStore = create((set) => {
  const saved = parseInt(localStorage.getItem("tweaks-enabled") || "0", 10)

  return {
    activeTweaks: saved,
    incrementTweaks: () =>
      set((state) => {
        const newCount = state.activeTweaks + 1
        localStorage.setItem("tweaks-enabled", newCount)
        return { activeTweaks: newCount }
      }),
    decrementTweaks: () =>
      set((state) => {
        const newCount = state.activeTweaks - 1
        localStorage.setItem("tweaks-enabled", newCount)
        return { activeTweaks: newCount }
      }),
  }
})

export default useTweaksStore
