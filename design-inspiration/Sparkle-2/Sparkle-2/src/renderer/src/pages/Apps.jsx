import { useState, useMemo } from "react"
import data from "../assets/apps.json"
import RootDiv from "@/components/RootDiv"
import { Search } from "lucide-react"
import Button from "@/components/ui/button"
import Checkbox from "@/components/ui/Checkbox"
import Modal from "@/components/ui/modal"
import { invoke } from "@/lib/electron"
import { Download } from "lucide-react"
import { Trash } from "lucide-react"
import { toast } from "react-toastify"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import log from "electron-log/renderer"
function Apps() {
  const [search, setSearch] = useState("")
  const [selectedApps, setSelectedApps] = useState([])
  const [loading, setLoading] = useState("")
  const [currentApp, setCurrentApp] = useState("")
  const [totalApps, setTotalApps] = useState(0)
  const [installedApps, setInstalledApps] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importedApps, setImportedApps] = useState([])
  const [selectedImportedApps, setSelectedImportedApps] = useState(importedApps)

  const appsList = data.apps
  const router = useNavigate()

  const filteredApps = appsList.filter((app) =>
    app.name.toLowerCase().includes(search.toLowerCase()),
  )

  const exportSelectedApps = () => {
    const blob = new Blob([JSON.stringify(selectedApps, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "sparkle-apps.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  const importSelectedApps = (event) => {
    const file = event.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result)
        if (Array.isArray(parsed)) {
          setImportedApps(parsed)
          setSelectedImportedApps(parsed)
          setImportModalOpen(true)
        } else {
          toast.error("Invalid import file format")
        }
      } catch {
        toast.error("Failed to parse JSON file")
      } finally {
        event.target.value = ""
      }
    }
    reader.readAsText(file)
  }

  const appsByCategory = useMemo(() => {
    return filteredApps.reduce((acc, app) => {
      if (!acc[app.category]) acc[app.category] = []
      acc[app.category].push(app)
      return acc
    }, {})
  }, [filteredApps])

  const checkInstalledApps = () => {
    invoke({
      channel: "handle-apps",
      payload: {
        action: "check-installed",
        apps: appsList.map((a) => a.id),
      },
    })
  }
  const toggleApp = (appId) => {
    setSelectedApps((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId],
    )
  }

  useEffect(() => {
    const idleHandle = requestIdleCallback(() => {
      try {
        const item = window.localStorage.getItem("installedApps")
        if (item) {
          setInstalledApps(JSON.parse(item))
        }
      } catch (error) {
        console.error("Failed to parse installedApps from localStorage", error)
      }
    })

    checkInstalledApps()

    const listeners = {
      "install-progress": (event, message) => {
        console.log(message)
        setCurrentApp(message)
        setCurrentIndex((prev) => prev + 1)
      },
      "install-complete": () => {
        setLoading("")
        setCurrentApp("")
        setCurrentIndex(0)
        setTotalApps(0)
        toast.success("Operation completed successfully!")
        checkInstalledApps()
      },
      "install-error": () => {
        setLoading("")
        setCurrentApp("")
        toast.error("There was an error during the operation. Please try again.")
      },
      "installed-apps-checked": (event, { success, installed, error }) => {
        if (success) {
          setInstalledApps(installed)
          try {
            window.localStorage.setItem("installedApps", JSON.stringify(installed))
          } catch (err) {
            console.error("Failed to save installed apps to localStorage", err)
          }
        } else {
          console.error("Failed to check installed apps:", error)
          toast.error("Could not verify installed apps.")
        }
      },
    }

    Object.entries(listeners).forEach(([channel, listener]) => {
      window.electron.ipcRenderer.on(channel, listener)
    })

    return () => {
      cancelIdleCallback(idleHandle)
      Object.keys(listeners).forEach((channel) => {
        window.electron.ipcRenderer.removeAllListeners(channel)
      })
    }
  }, [])

  const handleAppAction = async (type, appsToUse = selectedApps) => {
    const actionVerb = type === "install" ? "Installing" : "Uninstalling"
    setLoading(type)

    try {
      const commands = appsToUse.flatMap((appId) => {
        const app = appsList.find(
          (a) => a.id === appId || (Array.isArray(a.id) && a.id.includes(appId)),
        )
        return app
      })

      if (commands.length === 0) return

      invoke({
        channel: "handle-apps",
        payload: {
          action: type,
          apps: appsToUse,
        },
      })

      setTotalApps(appsToUse.length)
      setCurrentIndex(0)
    } catch (error) {
      console.error(`Error ${actionVerb.toLowerCase()} apps:`, error)
      log.error(`Error ${actionVerb.toLowerCase()} apps:`, error)
    }
  }

  return (
    <>
      <Modal open={importModalOpen} onClose={() => setImportModalOpen(false)}>
        <div className="bg-sparkle-card border border-sparkle-border rounded-2xl p-6 shadow-xl max-w-lg w-full mx-4">
          <h3 className="text-xl font-semibold text-sparkle-text mb-3">
            Import Apps ({importedApps.length})
          </h3>

          <div className="text-sparkle-text-secondary text-sm leading-6 whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar mb-6">
            {importedApps.length > 0 ? (
              <ul className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {importedApps.map((id) => {
                  const app = appsList.find((a) => a.id === id)
                  return (
                    <li key={id} className="flex items-center gap-2 text-sparkle-text">
                      <Checkbox
                        checked={selectedImportedApps.includes(id)}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setSelectedImportedApps((prev) => {
                            if (checked) {
                              return prev.includes(id) ? prev : [...prev, id]
                            } else {
                              return prev.filter((x) => x !== id)
                            }
                          })
                        }}
                      />

                      {app ? app.name : `Unknown App (${id})`}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sparkle-text-secondary italic">No apps found in file</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setImportModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={selectedImportedApps.length === 0}
              onClick={() => {
                setSelectedApps(selectedImportedApps)
                setImportModalOpen(false)
                handleAppAction("install", selectedImportedApps)
              }}
            >
              Install Selected
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!loading} onClose={() => {}}>
        <div className="bg-sparkle-card border border-sparkle-border rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-10 h-10 border-4 border-sparkle-primary/30 rounded-full animate-spin border-t-sparkle-primary border-sparkle-accent"></div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-sparkle-text">
                {loading === "install" ? "Installing" : "Uninstalling"} {currentApp || "Apps"}
                <p className="text-sm text-sparkle-text-secondary  mt-1 mb-1">
                  {totalApps > 0 && ` (${currentIndex} of ${totalApps})`}
                </p>
              </h3>
              <p className="text-sm text-sparkle-text-secondary">This may take a few moments</p>
            </div>
          </div>
        </div>
      </Modal>
      <RootDiv>
        <div className="flex items-center gap-3 bg-sparkle-card border border-sparkle-border rounded-xl px-4 backdrop-blur-sm ml-1 mr-4">
          <Search className="text-sparkle-text-secondary" />
          <input
            type="text"
            placeholder={`Search for ${appsList.length} apps...`}
            className="w-full py-3 px-0 bg-transparent border-none focus:outline-none focus:ring-0 text-sparkle-text placeholder:text-sparkle-text-secondary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-3 mt-5 w-auto ml-1 mr-1">
          <Button
            className="text-sparkle-text flex gap-2"
            disabled={selectedApps.length === 0 || loading}
            onClick={() => handleAppAction("install")}
          >
            <Download className="w-5" />
            Install Selected
          </Button>
          <Button
            className="flex gap-2"
            variant="danger"
            disabled={selectedApps.length === 0 || loading}
            onClick={() => handleAppAction("uninstall")}
          >
            <Trash className="w-5" />
            Uninstall Selected
          </Button>
          <Button
            className="flex gap-2"
            onClick={exportSelectedApps}
            disabled={selectedApps.length === 0}
          >
            Export List
          </Button>

          <label className="flex gap-2 cursor-pointer bg-sparkle-border text-sparkle-text rounded-lg font-medium px-3 py-1.5 text-sm text-center items-center active:scale-90 hover:bg-sparkle-secondary transition-all duration-200">
            Import List
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={importSelectedApps}
            />
          </label>

          {selectedApps.length > 0 && (
            <Button
              className="flex gap-2 ml-auto bg-sparkle-border text-sparkle-text"
              variant="ghost"
              onClick={() => setSelectedApps([])}
            >
              Uncheck All
            </Button>
          )}
        </div>
        <p className="mb-5 mt-2 text-sparkle-text-muted font-medium">
          Looking to debloat windows? its located in {""}
          <a className="text-sparkle-primary cursor-pointer" onClick={() => router("/tweaks")}>
            Tweaks
          </a>
        </p>
        <div className="space-y-10 mb-10">
          {Object.entries(appsByCategory).map(([category, apps]) => (
            <div key={category} className="space-y-4">
              <h2 className="text-2xl text-sparkle-primary font-bold capitalize">{category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4 mr-4">
                {apps.map((app) => (
                  <div
                    key={app.id}
                    className="bg-sparkle-card border border-sparkle-border rounded-lg p-4 hover:border-sparkle-primary transition group cursor-pointer"
                    onClick={() => toggleApp(app.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedApps.includes(app.id)}
                            onChange={() => toggleApp(app.id)}
                          />
                        </div>
                        <div className="min-w-10 max-w-10 max--h-10 min-h-10 rounded-lg overflow-hidden bg-sparkle-accent flex items-center justify-center">
                          {app.icon ? (
                            <img
                              src={app.icon}
                              alt={app.name}
                              className="w-8 h-8 object-contain rounded-md"
                            />
                          ) : (
                            <img src={sparkleLogo} alt="" className="w-6 h-6 opacity-50" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-sparkle-text font-medium group-hover:text-sparkle-primary transition">
                            {app.name}
                          </h3>
                          {app.info && (
                            <p className="text-sm text-sparkle-text-secondary line-clamp-1 font-semibold">
                              {app.info}
                            </p>
                          )}
                          <p className="text-xs text-sparkle-text-secondary">ID: {app.id}</p>
                        </div>
                      </div>
                      {installedApps.includes(app.id) && (
                        <div className="text-xs font-semibold text-sparkle-text bg-sparkle-accent py-1 px-2 rounded-full">
                          Installed
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-center text-sparkle-text-muted">
            Request more apps or make a pull request on{" "}
            <a
              href="https://github.com/parcoil/sparkle"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sparkle-primary"
            >
              github
            </a>
          </p>
        </div>
      </RootDiv>
    </>
  )
}

export default Apps
