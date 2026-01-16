import { useState, useEffect, useMemo } from "react"
import Modal from "@/components/ui/modal"
import Button from "@/components/ui/button"
import { toast } from "react-toastify"

export default function UpdateManager() {
  const [updateOpen, setUpdateOpen] = useState(false)
  const [updateVersion, setUpdateVersion] = useState(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadPercent, setDownloadPercent] = useState(0)
  const isDownloaded = useMemo(() => downloadPercent >= 100, [downloadPercent])

  useEffect(() => {
    const onAvailable = (_e, payload) => {
      setUpdateVersion(payload?.version ?? null)
      setUpdateOpen(true)
      setIsDownloading(false)
      setDownloadPercent(0)
    }
    const onNotAvailable = () => {
      toast.success("You're up to date")
    }
    const onError = (_e, payload) => {
      toast.error(payload?.message ?? "Update error")
      setIsDownloading(false)
    }
    const onProgress = (_e, payload) => {
      setIsDownloading(true)
      setDownloadPercent(Math.max(0, Math.min(100, payload.percent || 0)))
    }
    const onDownloaded = () => {
      setIsDownloading(false)
      setDownloadPercent(100)
    }

    window.electron.ipcRenderer.on("updater:available", onAvailable)
    window.electron.ipcRenderer.on("updater:not-available", onNotAvailable)
    window.electron.ipcRenderer.on("updater:error", onError)
    window.electron.ipcRenderer.on("updater:download-progress", onProgress)
    window.electron.ipcRenderer.on("updater:downloaded", onDownloaded)

    return () => {
      window.electron.ipcRenderer.removeListener("updater:available", onAvailable)
      window.electron.ipcRenderer.removeListener("updater:not-available", onNotAvailable)
      window.electron.ipcRenderer.removeListener("updater:error", onError)
      window.electron.ipcRenderer.removeListener("updater:download-progress", onProgress)
      window.electron.ipcRenderer.removeListener("updater:downloaded", onDownloaded)
    }
  }, [])

  const handleUpdateNow = async () => {
    if (isDownloaded) {
      await window.electron.ipcRenderer.invoke("updater:install")
      return
    }
    setIsDownloading(true)
    setDownloadPercent(0)
    await window.electron.ipcRenderer.invoke("updater:download")
  }

  const handleRemindLater = () => {
    setUpdateOpen(false)
  }

  return (
    <Modal open={updateOpen} onClose={() => !isDownloading && setUpdateOpen(false)}>
      <div className="bg-sparkle-card border border-sparkle-border rounded-2xl p-6 shadow-xl max-w-lg w-full mx-4">
        <h2 className="text-xl font-semibold mb-2 text-sparkle-text">
          Update available{updateVersion ? ` (${updateVersion})` : ""}
        </h2>
        <p className="mb-6 text-sparkle-text">
          {isDownloaded
            ? "The update has been downloaded. Restart to install now."
            : isDownloading
              ? `Downloading update… ${Math.floor(downloadPercent)}%`
              : "A new version is available. Would you like to update now?"}
        </p>
        <div className="flex justify-end gap-3">
          {!isDownloading && (
            <Button variant="secondary" onClick={handleRemindLater}>
              Remind me later
            </Button>
          )}
          <Button onClick={handleUpdateNow} disabled={isDownloading}>
            {isDownloaded ? "Restart and install" : isDownloading ? "Downloading…" : "Update now"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
