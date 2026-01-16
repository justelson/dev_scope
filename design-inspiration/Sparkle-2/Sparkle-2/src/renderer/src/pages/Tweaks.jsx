import { useState, useEffect, useMemo } from "react"
import {
  Wrench,
  Search,
  AlertTriangle,
  Monitor,
  Shield,
  Gamepad,
  Network,
  Zap,
  Paintbrush,
  ExternalLink,
} from "lucide-react"
import { toast } from "react-toastify"
import RootDiv from "@/components/RootDiv"
import Tooltip from "@/components/ui/tooltip"
import Modal from "@/components/ui/modal"
import { invoke } from "@/lib/electron"
import useTweaksStore from "@/store/tweaksStore"
import useRestartStore from "@/store/restartState"
import Button from "@/components/ui/button"
import Toggle from "@/components/ui/Toggle"
import log from "electron-log/renderer"
import posthog from "posthog-js"

function Tweaks() {
  const [tweaks, setTweaks] = useState([])
  const [toggleStates, setToggleStates] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [modalContent, setModalContent] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTweak, setSelectedTweak] = useState(null)

  const { incrementTweaks, decrementTweaks } = useTweaksStore.getState()
  const { setNeedsRestart } = useRestartStore()

  useEffect(() => {
    loadTweaks()
    loadToggleStates()
  }, [])

  const loadTweaks = async () => {
    try {
      const fetchedTweaks = await invoke({
        channel: "tweaks:fetch",
      })
      setTweaks(fetchedTweaks)
    } catch (error) {
      console.error("Error fetching tweaks:", error)
      log.error("Error fetching tweaks:", error)
    }
  }

  const loadToggleStates = async () => {
    try {
      const savedStates = await invoke({
        channel: "tweak-states:load",
      })

      if (savedStates) {
        setToggleStates(JSON.parse(savedStates))
      }
    } catch (error) {
      console.error("Error loading toggle states:", error)
      log.error("Error loading toggle states:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveToggleStates = async (newStates) => {
    try {
      await invoke({
        channel: "tweak-states:save",
        payload: JSON.stringify(newStates),
      })
    } catch (error) {
      console.error("Error saving toggle states:", error)
      log.error("Error saving toggle states:", error)
    }
  }

  const applyTweak = async (tweak, index) => {
    const newState = !toggleStates[tweak.name]
    const newStates = {
      ...toggleStates,
      [tweak.name]: newState,
    }

    setToggleStates(newStates)

    const loadingToastId = toast.loading(
      `${newState ? "Applying" : "Unapplying"} tweak: ${tweak.title}`,
    )

    try {
      await saveToggleStates(newStates)

      if (newState) {
        await invoke({
          channel: "tweak:apply",
          payload: tweak.name,
        })
        incrementTweaks()
        if (tweak.restart) {
          setNeedsRestart(true)
        }
        toast.update(loadingToastId, {
          render: `Applied tweak: ${tweak.title}`,
          type: "success",
          isLoading: false,
          autoClose: 3000,
        })
        posthog.capture("tweak_applied", {
          tweak_name: tweak.name,
        })
      } else {
        await invoke({
          channel: "tweak:unapply",
          payload: tweak.name,
        })
        decrementTweaks()
        if (tweak.restart) {
          setNeedsRestart(true)
        }
        toast.update(loadingToastId, {
          render: `Unapplied tweak: ${tweak.title}`,
          type: "info",
          isLoading: false,
          autoClose: 3000,
        })
        posthog.capture("tweak_unapplied", {
          tweak_name: tweak.name,
        })
      }
    } catch (error) {
      console.error(`Error toggling tweak ${tweak.title}:`, error)
      log.error(`Error toggling tweak ${tweak.title}:`, error)

      toast.update(loadingToastId, {
        render: `Failed to ${newState ? "apply" : "unapply"} tweak: ${tweak.title}`,
        type: "error",
        isLoading: false,
        autoClose: 3000,
      })

      const revertedStates = {
        ...newStates,
        [tweak.name]: !newState,
      }

      setToggleStates(revertedStates)

      try {
        await saveToggleStates(revertedStates)
      } catch (err) {
        console.error("Error reverting toggle state:", err)
        log.error("Error reverting toggle state:", err)
      }
    }
  }

  const applyNonReversibleTweak = async (tweak, index) => {
    const newStates = {
      ...toggleStates,
      [tweak.name]: true,
    }

    setToggleStates(newStates)

    const loadingToastId = toast.loading(`Applying tweak: ${tweak.title}`)

    try {
      await saveToggleStates(newStates)
      await invoke({
        channel: "tweak:apply",
        payload: tweak.name,
      })
      incrementTweaks()
      if (tweak.restart) {
        setNeedsRestart(true)
      }
      toast.update(loadingToastId, {
        render: `Applied tweak: ${tweak.title}`,
        type: "success",
        isLoading: false,
        autoClose: 3000,
      })
      posthog.capture("tweak_applied", {
        tweak_name: tweak.name,
      })
    } catch (error) {
      console.error(`Error applying tweak ${tweak.title}:`, error)
      log.error(`Error applying tweak ${tweak.title}:`, error)
      toast.update(loadingToastId, {
        render: `Failed to apply tweak: ${tweak.title}`,
        type: "error",
        isLoading: false,
        autoClose: 3000,
      })
    }
  }

  const handleToggle = async (index) => {
    const tweak = tweaks[index]

    if (tweak.modal && !toggleStates[tweak.name]) {
      setSelectedTweak(tweak)
      setModalContent(tweak.modal)
      setIsModalOpen(true)
      return
    }

    await applyTweak(tweak, index)
  }

  const handleButtonClick = async (index) => {
    const tweak = tweaks[index]

    if (tweak.modal) {
      setSelectedTweak(tweak)
      setModalContent(tweak.modal)
      setIsModalOpen(true)
      return
    }

    await applyNonReversibleTweak(tweak, index)
  }

  const categories = useMemo(
    () => ["All", ...new Set(tweaks.flatMap((t) => t.category || []).filter(Boolean))],
    [tweaks],
  )

  const filteredTweaks = useMemo(() => {
    return tweaks.filter((tweak) => {
      const matchesSearch =
        tweak.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tweak.description.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesCategory =
        activeCategory === "All" ||
        (Array.isArray(tweak.category) && tweak.category.includes(activeCategory)) ||
        tweak.category === activeCategory

      return matchesSearch && matchesCategory
    })
  }, [tweaks, searchTerm, activeCategory])

  // sort this so recommended tweaks are at the top
  const sortedTweaks = useMemo(() => {
    return [...filteredTweaks].sort((a, b) => {
      const aRec = !!a.recommended
      const bRec = !!b.recommended
      return bRec - aRec
    })
  }, [filteredTweaks])

  const categoryIcons = {
    Performance: <Zap className="w-4 h-4  text-yellow-400" />,
    GPU: <Monitor className="w-4 h-4 text-purple-400" />,
    Privacy: <Shield className="w-4 h-4 text-green-500" />,
    Network: <Network className="w-4 h-4 text-orange-400" />,
    Appearance: <Paintbrush className="w-4 h-4 text-sparkle-primary" />,
    Gaming: <Gamepad className="w-4 h-4 text-teal-400" />,
    General: <Wrench className="w-4 h-4 text-blue-400" />,
  }

  if (isLoading) {
    return (
      <RootDiv>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading tweaks...</div>
        </div>
      </RootDiv>
    )
  }

  return (
    <>
      <Modal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
        }}
      >
        <div className="bg-sparkle-card border border-sparkle-border rounded-2xl p-6 shadow-xl max-w-lg w-full mx-4">
          <h3 className="text-xl font-semibold text-sparkle-text mb-3">{selectedTweak?.title}</h3>
          <div className="text-sparkle-text-secondary text-sm leading-6 whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar mb-6">
            {modalContent}
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsModalOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const index = tweaks.indexOf(selectedTweak)
                const newState = true
                const newStates = {
                  ...toggleStates,
                  [selectedTweak.name]: newState,
                }

                setToggleStates(newStates)
                setIsModalOpen(false)

                const loadingToastId = toast.loading(`Applying tweak: ${selectedTweak.title}`)

                try {
                  await saveToggleStates(newStates)
                  await invoke({
                    channel: "tweak:apply",
                    payload: selectedTweak.name,
                  })
                  incrementTweaks()
                  if (selectedTweak.restart) {
                    setNeedsRestart(true)
                  }
                  toast.update(loadingToastId, {
                    render: `Applied tweak: ${selectedTweak.title}`,
                    type: "success",
                    isLoading: false,
                    autoClose: 3000,
                  })
                  posthog.capture("tweak_applied", {
                    tweak_name: selectedTweak.name,
                  })
                } catch (error) {
                  console.error(`Error applying tweak ${selectedTweak.title}:`, error)
                  log.error(`Error applying tweak ${selectedTweak.title}:`, error)

                  const revertedStates = {
                    ...toggleStates,
                    [selectedTweak.name]: false,
                  }
                  setToggleStates(revertedStates)
                  await saveToggleStates(revertedStates)
                }
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </Modal>
      <RootDiv>
        <div className="max-w-[1800px] mx-auto mr-4">
          <div className="mb-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-sparkle-card border border-sparkle-border rounded-xl px-4 backdrop-blur-sm">
                <Search className="text-sparkle-text-secondary" />
                <input
                  type="text"
                  placeholder="Search tweaks by name or description..."
                  className="w-full py-3 px-0 bg-transparent border-none focus:outline-none focus:ring-0 text-sparkle-text placeholder:text-sparkle-text-secondary"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95  ${
                      activeCategory === category
                        ? "bg-sparkle-primary text-white shadow-lg border border-sparkle-border"
                        : "bg-sparkle-card/50 text-sparkle-text-secondary  hover:bg-sparkle-border border border-sparkle-border-secondary"
                    }`}
                    onClick={() => setActiveCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            {sortedTweaks.length > 0 ? (
              sortedTweaks.map((tweak, index) => {
                const originalIndex = tweaks.indexOf(tweak)
                return (
                  <div
                    key={originalIndex}
                    className="group bg-sparkle-card backdrop-blur-sm rounded-xl border border-sparkle-border hover:shadow-sm hover:border-sparkle-border-secondary transition-all duration-300 overflow-hidde h-52 "
                  >
                    <div className="p-5 flex flex-col h-[260px]">
                      <div className="flex items-center justify-between mb-3">
                        {tweak.category && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <>
                              {tweak.warning && (
                                <Tooltip content={tweak.warning} delay={0.3} side="right">
                                  <div className="p-1.5 bg-red-900/50 rounded-lg hover:bg-red-900/80 transition-colors">
                                    <AlertTriangle className="w-4 h-4 text-red-400" />
                                  </div>
                                </Tooltip>
                              )}
                              {(Array.isArray(tweak.category)
                                ? tweak.category
                                : [tweak.category]
                              ).map((cat) => (
                                <Tooltip
                                  key={cat}
                                  content={`${cat} Optimization`}
                                  delay={0.3}
                                  side="right"
                                >
                                  <div className="p-1.5 bg-sparkle-accent rounded-lg hover:bg-sparkle-bg transition-colors text-sparkle-text">
                                    {categoryIcons[cat] || categoryIcons["General"]}
                                  </div>
                                </Tooltip>
                              ))}
                            </>
                          </div>
                        )}
                        <div className="flex items-center m-0 gap-2">
                          <Button
                            variant="secondary"
                            className="!px-2 !py-1 text-xs flex items-center gap-1"
                            title="Open Docs"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              const url = `https://docs.getsparkle.net/tweaks/${tweak.name}`
                              window.open(url, "_blank")
                            }}
                          >
                            <ExternalLink className="w-3 h-3" /> Docs
                          </Button>
                          {tweak.reversible == null || tweak.reversible == true ? (
                            <Toggle
                              checked={toggleStates[tweak.name] || false}
                              onChange={(e) => {
                                const willOpenModal = !!tweak.modal && !toggleStates[tweak.name]
                                if (willOpenModal) {
                                  e.preventDefault()
                                  e.stopPropagation()
                                }
                                handleToggle(originalIndex)
                              }}
                              disabled={false}
                            />
                          ) : (
                            <div>
                              <Button
                                onClick={() => handleButtonClick(originalIndex)}
                                disabled={false}
                              >
                                Apply
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start mb-3">
                        <h2 className="font-semibold text-sparkle-text text-base">{tweak.title}</h2>
                      </div>
                      <div className="flex flex-col flex-1 overflow-hidden">
                        <p className="text-sparkle-text-secondary text-sm flex-1 overflow-y-auto custom-scrollbar pr-1">
                          {tweak.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <div className="bg-sparkle-card p-6 rounded-2xl mb-4">
                  <Search className="w-10 h-10 text-sparkle-text-secondary" />
                </div>
                <h3 className="text-xl font-medium mb-2 text-sparkle-text"> Loading Tweaks...</h3>
                <h3 className="text-sm font-medium mb-2 text-sparkle-text-muted">
                  No tweaks Found
                </h3>
                <p className="text-sparkle-text-secondary">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        </div>
      </RootDiv>
    </>
  )
}

export default Tweaks
