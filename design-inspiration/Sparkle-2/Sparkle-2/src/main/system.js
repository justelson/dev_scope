import os from "os"
import { ipcMain } from "electron"
import si from "systeminformation"
import { exec } from "child_process"
import fs from "fs"
import path from "path"
import log from "electron-log"
import { shell } from "electron"
console.log = log.log
console.error = log.error
console.warn = log.warn
async function getSystemInfo() {
  try {
    const [cpuData, graphicsData, osInfo, memLayout, diskLayout] = await Promise.all([
      si.cpu(),
      si.graphics(),
      si.osInfo(),
      si.memLayout(),
      si.diskLayout(),
    ])

    let totalMemory = os.totalmem()
    const memoryType = memLayout.length > 0 ? memLayout[0].type : "Unknown"

    const primaryDisk = diskLayout.length > 0 ? diskLayout[0] : null

    let gpuInfo = { model: "GPU not found", vram: "N/A" }

    if (graphicsData.controllers && graphicsData.controllers.length > 0) {
      const dedicatedGPU = graphicsData.controllers.find((controller) => {
        const model = (controller.model || "").toLowerCase()
        return (
          (model.includes("nvidia") &&
            (model.includes("gtx") ||
              model.includes("rtx") ||
              model.includes("titan") ||
              model.includes("quadro") ||
              model.includes("mx") ||
              model.includes("tesla") ||
              model.includes("a100") ||
              model.includes("a40"))) ||
          (model.includes("amd") &&
            (model.includes("radeon") ||
              model.includes("rx") ||
              model.includes("vega") ||
              model.includes("firepro") ||
              model.includes("instinct"))) ||
          (model.includes("intel") && model.includes("arc"))
        )
      })

      const gpu = dedicatedGPU || graphicsData.controllers[0]

      if (gpu) {
        gpuInfo = {
          model: gpu.model || "Unknown GPU",
          vram: gpu.vram ? `${Math.round(gpu.vram / 1024)} GB` : "Unknown",
        }
      }
    }

    return {
      cpu_model: cpuData.brand,
      cpu_cores: cpuData.cores,
      cpu_threads: cpuData.threads,

      gpu_model: gpuInfo.model,
      vram: gpuInfo.vram,

      memory_total: totalMemory,
      memory_type: memoryType,

      os: osInfo.distro || "Windows",
      os_version: osInfo.release || "Unknown",

      disk_model: primaryDisk?.name || "Unknown Storage",
      disk_size: primaryDisk?.size
        ? `${Math.round(primaryDisk.size / 1024 / 1024 / 1024)} GB`
        : "Unknown",
    }
  } catch (error) {
    console.error("Failed to get system info:", error)
    throw error
  }
}

function restartSystem() {
  try {
    exec("shutdown /r /t 0")
    return { success: true }
  } catch (error) {
    console.error("Failed to restart system:", error)
    throw error
  }
}
function getUserName() {
  return os.userInfo().username
}
function clearSparkleCache() {
  try {
    const appDataPath = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming")
    const scriptsPath = path.join(appDataPath, "sparkle", "scripts")
    const logsPath = path.join(appDataPath, "sparkle", "logs")

    let scriptsCleared = false
    let logsCleared = false
    let errors = []

    if (fs.existsSync(scriptsPath)) {
      const files = fs.readdirSync(scriptsPath)
      for (const file of files) {
        const filePath = path.join(scriptsPath, file)
        try {
          if (fs.lstatSync(filePath).isFile()) {
            fs.unlinkSync(filePath)
          }
        } catch (err) {
          errors.push(`Failed to delete script file: ${file} - ${err.message}`)
        }
      }

      scriptsCleared = true
      console.log("Sparkle scripts directory files cleared successfully.")
    } else {
      console.warn("Sparkle scripts directory does not exist.")
      errors.push("Scripts directory does not exist.")
    }

    if (fs.existsSync(logsPath)) {
      const logFiles = fs.readdirSync(logsPath)
      for (const file of logFiles) {
        const filePath = path.join(logsPath, file)
        try {
          if (fs.lstatSync(filePath).isFile()) {
            fs.unlinkSync(filePath)
          }
        } catch (err) {
          errors.push(`Failed to delete log file: ${file} - ${err.message}`)
        }
      }
      logsCleared = true
      console.log("Sparkle logs directory files cleared successfully.")
    } else {
      console.warn("Sparkle logs directory does not exist.")
      errors.push("Logs directory does not exist.")
    }

    if (errors.length === 0) {
      return { success: true }
    } else {
      return {
        success: scriptsCleared || logsCleared,
        error: errors.join(" | "),
      }
    }
  } catch (error) {
    console.error("Failed to clear Sparkle scripts or logs directory:", error)
    return { success: false, error: error.message }
  }
}

function openLogFolder() {
  const logPath = path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
    "sparkle",
    "logs",
  )
  if (fs.existsSync(logPath)) {
    shell.openPath(logPath)
  } else {
    console.warn("Sparkle logs directory does not exist.")
    return { success: false, error: "Logs directory does not exist." }
  }
}

ipcMain.handle("restart", restartSystem)
ipcMain.handle("open-log-folder", openLogFolder)
ipcMain.handle("clear-sparkle-cache", clearSparkleCache)
ipcMain.handle("get-system-info", getSystemInfo)
ipcMain.handle("get-user-name", getUserName)
