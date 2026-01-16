import { useState } from "react"
import { invoke } from "@/lib/electron"
import RootDiv from "@/components/RootDiv"
import Modal from "@/components/ui/modal"
import { toast } from "react-toastify"
import Button from "@/components/ui/button"
import Toggle from "@/components/ui/toggle"
import log from "electron-log/renderer"
import {
  SquareTerminal,
  Binary,
  ChartColumn,
  Settings,
  HardDrive,
  Activity,
  Shield,
  Wrench,
  Monitor,
  MonitorCog,
  Printer,
  Info,
  CaseSensitive,
  ScreenShare,
} from "lucide-react"

const utilities = [
  {
    name: "System File Checker",
    command: "sfc /scannow",
    type: "System",
    icon: <Shield className="w-5 h-5" />,
    color: "text-blue-500",
  },
  {
    name: "DISM Health Restore",
    command: "DISM /Online /Cleanup-Image /RestoreHealth",
    type: "System",
    icon: <Activity className="w-5 h-5" />,
    color: "text-green-500",
  },
  {
    name: "Check Disk",
    command: "chkdsk C: /f /r /x",
    type: "System",
    icon: <HardDrive className="w-5 h-5" />,
    color: "text-yellow-500",
  },
  {
    name: "Show Power Plan",
    type: "System",
    command: "powercfg /getactivescheme",
    icon: <Settings className="w-5 h-5" />,
    color: "text-purple-500",
  },
  {
    name: "Reset IP Stack",
    type: "Network",
    command: "netsh int ip reset",
    icon: <Wrench className="w-5 h-5" />,
    color: "text-pink-500",
  },
  {
    name: "Reset Winsock",
    type: "Network",
    command: "netsh winsock reset",
    icon: <Wrench className="w-5 h-5" />,
    color: "text-red-500",
  },
  {
    name: "Flush DNS Cache",
    type: "Network",
    command: "ipconfig /flushdns",
    icon: <Wrench className="w-5 h-5" />,
    color: "text-indigo-500",
  },
  {
    name: "Disk Cleanup",
    type: "System",
    command: "cleanmgr.exe /sagerun:1",
    icon: <HardDrive className="w-5 h-5" />,
    color: "text-teal-500",
  },
]

export default function UtilitiesPage() {
  const [running, setRunning] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedUtility, setSelectedUtility] = useState(null)
  const [noExit, setNoExit] = useState(true)

  const confirmAndRun = async () => {
    if (!selectedUtility) return
    setModalOpen(false)
    setRunning(true)
    const toastId = toast.loading(`Running ${selectedUtility.name}...`)
    try {
      await invoke({
        channel: "run-powershell-window",
        payload: { script: selectedUtility.command, name: selectedUtility.name, noExit: noExit },
      })
      toast.update(toastId, {
        render: `${selectedUtility.name} completed!`,
        type: "success",
        isLoading: false,
        autoClose: 3000,
      })
    } catch (error) {
      log.error(`Error running utility ${selectedUtility.name}:`, error)
      toast.update(toastId, {
        render: `Failed to run ${selectedUtility.name}: ${error.message || error}`,
        type: "error",
        isLoading: false,
        autoClose: 4000,
      })
    }
    setRunning(false)
    setSelectedUtility(null)
  }

  const openConfirmationModal = (utility) => {
    setSelectedUtility(utility)
    setModalOpen(true)
  }

  const openQuickAccessTool = async (script) => {
    try {
      await invoke({
        channel: "run-powershell",
        payload: { script },
      })
    } catch (error) {
      log.error("Error running quick access tool:", error)
    }
  }

  const quickAccess = [
    {
      name: "Regedit",
      command: "start regedit.exe",
      icon: <Binary className="w-6 h-6 text-green-400" />,
    },
    {
      name: "Task Manager",
      command: "start taskmgr.exe",
      icon: <ChartColumn className="w-6 h-6 text-blue-400" />,
    },
    {
      name: "Disk Cleanup",
      command: "start cleanmgr.exe",
      icon: <HardDrive className="w-6 h-6 text-teal-400" />,
    },
    {
      name: "Display Settings",
      command: "start desk.cpl",
      icon: <Monitor className="w-6 h-6 text-purple-400" />,
    },
    {
      name: "System Information",
      command: "start msinfo32.exe",
      icon: <MonitorCog className="w-6 h-6 text-red-400" />,
    },
    {
      name: "Device Manager",
      command: "start devmgmt.msc",
      icon: <Printer className="w-6 h-6 text-indigo-400" />,
    },
    {
      name: "System Properties",
      command: "start sysdm.cpl",
      icon: <Info className="w-6 h-6 text-yellow-400" />,
    },
    {
      name: "Character Map",
      command: "start charmap.exe",
      icon: <CaseSensitive className="w-6 h-6 text-pink-400" />,
    },
    {
      name: "Remote Desktop",
      command: "start mstsc.exe",
      icon: <ScreenShare className="w-6 h-6 text-blue-400" />,
    },
  ]

  return (
    <>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="bg-sparkle-card p-6 rounded-2xl border border-sparkle-border text-sparkle-text w-[90vw] max-w-md">
          <h2 className="text-lg font-semibold mb-4">Confirm Action</h2>
          {selectedUtility && (
            <>
              <p className="mb-4">
                You are about to run{" "}
                <span className={`${selectedUtility.color} underline  font-medium`}>
                  {selectedUtility.name}
                </span>
                .
              </p>
              <div className="bg-sparkle-border-secondary border border-sparkle-border p-2 text-sm rounded-md text-sparkle-text-secondary">
                {selectedUtility.command}
              </div>
            </>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button onClick={() => setModalOpen(false)} variant="secondary">
              Cancel
            </Button>
            <Button onClick={confirmAndRun}>Run</Button>
          </div>
        </div>
      </Modal>
      <RootDiv>
        <div className="bg-sparkle-bg text-sparkle-text pb-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {utilities.map((util) => (
              <button
                key={util.name}
                onClick={() => openConfirmationModal(util)}
                disabled={running}
                className="bg-sparkle-card border border-sparkle-border p-4 rounded-2xl flex items-center gap-3 hover:border-sparkle-primary transition"
              >
                <div className={`${util.color}`}>{util.icon}</div>
                <div className="text-left">
                  <h2 className="font-semibold">Run {util.name}</h2>
                  <p className="text-sm text-sparkle-text-secondary">Type: {util.type}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="flex flex-row gap-2 mt-3">
            <Toggle checked={noExit} onChange={() => setNoExit(!noExit)} id="noExitToggle" />
            <p>Keep PowerShell window open after execution</p>
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-2 text-sparkle-text-secondary">Quick Access</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {quickAccess.map((tool) => (
                <button
                  key={tool.name}
                  onClick={() => openQuickAccessTool(tool.command)}
                  className="inline-flex items-center gap-2 px-3 py-3.5 text-sm bg-sparkle-card border border-sparkle-border rounded-xl hover:border-sparkle-primary transition text-sparkle-text"
                >
                  {tool.icon}
                  <span>Open {tool.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </RootDiv>
    </>
  )
}
