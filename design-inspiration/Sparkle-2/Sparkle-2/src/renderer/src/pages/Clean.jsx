import Button from "@/components/ui/button"
import Toggle from "@/components/ui/toggle"
import { useState } from "react"
import { invoke } from "@/lib/electron"
import RootDiv from "@/components/RootDiv"
import { RefreshCw, Icon } from "lucide-react"
import { broom } from "@lucide/lab"
import { toast } from "react-toastify"
import log from "electron-log/renderer"

const cleanups = [
  {
    id: "temp",
    label: "Clean Temporary Files",
    description: "Remove system and user temporary files.",
    script: `
      $systemTemp = "$env:SystemRoot\\Temp"
      $userTemp = [System.IO.Path]::GetTempPath()
      $foldersToClean = @($systemTemp, $userTemp)
      foreach ($folder in $foldersToClean) {
          if (Test-Path $folder) {
              Get-ChildItem -Path $folder -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
          }
      }
    `,
  },
  {
    id: "prefetch",
    label: "Clean Prefetch Files",
    description: "Delete files from the Windows Prefetch folder.",
    script: `
      $prefetch = "$env:SystemRoot\\Prefetch"
      if (Test-Path $prefetch) {
          Remove-Item "$prefetch\\*" -Force -Recurse -ErrorAction SilentlyContinue
      }
    `,
  },
  {
    id: "recyclebin",
    label: "Empty Recycle Bin",
    description: "Permanently remove files from the Recycle Bin.",
    script: `Clear-RecycleBin -Force -ErrorAction SilentlyContinue`,
  },
  {
    id: "windows-update",
    label: "Clean Windows Update Cache",
    description: "Remove Windows Update downloaded installation files.",
    script: `
      $windowsUpdateDownload = "$env:SystemRoot\\SoftwareDistribution\\Download"
      if (Test-Path $windowsUpdateDownload) {
          Remove-Item "$windowsUpdateDownload\\*" -Force -Recurse -ErrorAction SilentlyContinue
      }
    `,
  },
  {
    id: "thumbnails",
    label: "Clear Thumbnail Cache",
    description: "Remove cached thumbnail images used by File Explorer.",
    script: `
      $thumbCache = "$env:LOCALAPPDATA\\Microsoft\\Windows\\Explorer"
      Get-ChildItem "$thumbCache\\thumbcache_*.db" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    `,
  },
]

function Clean() {
  const [selected, setSelected] = useState([])
  const [loadingQueue, setLoadingQueue] = useState([])
  const [lastClean, setLastClean] = useState(
    localStorage.getItem("last-clean") || "Not cleaned yet.",
  )
  const [isCleaning, setIsCleaning] = useState(false)

  const toggleCleanup = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function runSelectedCleanups() {
    setIsCleaning(true)
    setLoadingQueue([])
    let anySuccess = false
    for (const cleanup of cleanups) {
      if (!selected.includes(cleanup.id)) continue
      setLoadingQueue((q) => [...q, cleanup.id])
      const toastId = toast.loading(`Running ${cleanup.label}...`)
      try {
        await invoke({
          channel: "run-powershell",
          payload: { script: cleanup.script, name: `cleanup-${cleanup.id}` },
        })
        toast.update(toastId, {
          render: `${cleanup.label} completed!`,
          type: "success",
          isLoading: false,
          autoClose: 3000,
        })
        anySuccess = true
      } catch (err) {
        toast.update(toastId, {
          render: `Failed: ${err.message || err}`,
          type: "error",
          isLoading: false,
          autoClose: 4000,
        })
        log.error(`Failed to run ${cleanup.id} cleanup: ${err.message || err}`)
      }
    }
    if (anySuccess) {
      const now = new Date().toLocaleString()
      setLastClean(now)
      localStorage.setItem("last-clean", now)
    }
    setLoadingQueue([])
    setIsCleaning(false)
  }

  return (
    <RootDiv>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4 p-6 rounded-2xl border border-sparkle-border bg-sparkle-card ">
          <div className="flex items-center justify-center p-3 rounded-xl bg-green-500/10">
            <Icon iconNode={broom} className="text-green-500" size={28} />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-sparkle-text mb-1">System Cleanup</h2>
            <p className="text-sm text-sparkle-text-secondary">
              Last cleaned: <span className="font-medium">{lastClean}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col divide-y divide-sparkle-border bg-sparkle-card rounded-xl border border-sparkle-border">
          {cleanups.map(({ id, label, description }, idx) => {
            const isSelected = selected.includes(id)
            return (
              <div
                key={id}
                className={`relative flex items-center justify-between px-6 py-4 ${idx === 0 ? "rounded-t-xl" : ""} ${idx === cleanups.length - 1 ? "rounded-b-xl" : ""} group`}
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-base font-semibold text-sparkle-text truncate">
                    {label}
                  </span>
                  <span className="text-xs text-sparkle-text-secondary mt-0.5 truncate">
                    {description}
                  </span>
                </div>
                <div className="ml-4 flex items-center">
                  <Toggle
                    checked={isSelected}
                    onChange={() => toggleCleanup(id)}
                    disabled={isCleaning}
                  />
                </div>
                {loadingQueue.includes(id) && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 rounded-xl">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sparkle-border border border-sparkle-border-secondary">
                      <RefreshCw className="animate-spin text-green-500" size={18} />
                      <span className="text-sm font-medium text-green-600">Cleaning...</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex justify-end mt-2">
          <Button
            onClick={runSelectedCleanups}
            disabled={isCleaning || selected.length === 0}
            size="md"
            variant="primary"
            className="min-w-[180px] flex items-center justify-center gap-2 text-base font-semibold"
          >
            {isCleaning ? (
              <>
                <RefreshCw className="animate-spin" size={18} />
                <span>Cleaning...</span>
              </>
            ) : (
              <>
                <Icon iconNode={broom} size={18} />
                <span>Clean Selected</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </RootDiv>
  )
}

export default Clean
