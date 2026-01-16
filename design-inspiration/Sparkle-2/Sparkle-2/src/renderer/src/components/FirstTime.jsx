import { useEffect, useState } from "react"
import Modal from "@/components/ui/modal"
import Button from "./ui/button"
import { toast } from "react-toastify"
import { invoke } from "@/lib/electron"
import data from "../../../../package.json"

export default function FirstTime() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const firstTime = localStorage.getItem("firstTime")
    if (!firstTime || firstTime === "true") {
      const timer = setTimeout(() => setOpen(true), 20)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleGetStarted = async () => {
    localStorage.setItem("firstTime", "false")
    setOpen(false)

    // Show a loading toast with spinner and same message
    const toastId = toast.info("Creating restore point... Please wait before applying tweaks.", {
      autoClose: false,
      isLoading: true,
      closeOnClick: false,
      draggable: false,
    })

    try {
      await invoke({ channel: "create-sparkle-restore-point" })

      toast.update(toastId, {
        render: "Restore point created!",
        type: "success",
        isLoading: false,
        autoClose: 3000,
      })
    } catch (err) {
      toast.update(toastId, {
        render: "Failed to create restore point.",
        type: "error",
        isLoading: false,
        autoClose: 3000,
      })
      console.error("Error creating restore point:", err)
    }
  }

  const handleSkipRestorePoint = () => {
    localStorage.setItem("firstTime", "false")
    setOpen(false)
  }

  return (
    <Modal open={open}>
      <div className="bg-sparkle-card border border-sparkle-border rounded-2xl p-8 shadow-2xl max-w-lg w-full mx-4 flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold text-sparkle-text mb-4">Welcome to Sparkle</h1>

        <p className="text-sparkle-text-secondary mb-6">
          It looks like this is your first time here. <br />
          Would you like to create a restore point before you start?
        </p>

        <p className="text-sparkle-text-secondary mb-8 text-sm">
          <span className="font-medium">
            By clicking <strong>Yes</strong>, Sparkle will create a restore point and disable the
            cooldown for future restore points.
          </span>{" "}
          Please only download from <strong>GitHub</strong>, <strong>parcoil.com</strong>, or{" "}
          <strong>getsparkle.net</strong>.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <Button onClick={handleSkipRestorePoint} variant="danger">
            No (Not Recommended)
          </Button>
          <Button onClick={handleGetStarted}>Yes (Recommended)</Button>
        </div>

        <p className="text-sparkle-text-secondary mt-4 text-sm">
          <span className="font-semibold">Sparkle Version:</span>{" "}
          {data?.version || "Error fetching version"}
        </p>
      </div>
    </Modal>
  )
}
