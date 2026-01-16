import { ipcMain, app } from "electron"
import fs from "fs/promises"
import path from "path"
import { exec } from "child_process"
import { promisify } from "util"
import { logo } from "./index"
import { executePowerShell } from "./powershell"
import log from "electron-log"
console.log = log.log
console.error = log.error
console.warn = log.warn

const execPromise = promisify(exec)
const userDataPath = app.getPath("userData")
const tweaksStatePath = path.join(userDataPath, "tweakStates.json")
const isDev = !app.isPackaged
const tweaksDir = isDev
  ? path.join(process.cwd(), "resources", "tweaks")
  : path.join(process.resourcesPath, "tweaks")

const getExePath = (exeName) => {
  if (isDev) {
    return path.resolve(process.cwd(), "resources", exeName)
  }
  return path.join(process.resourcesPath, exeName)
}

async function loadTweaks() {
  const entries = await fs.readdir(tweaksDir, { withFileTypes: true })
  const tweaks = []
  for (const dir of entries) {
    if (!dir.isDirectory()) continue

    const name = dir.name
    const folder = path.join(tweaksDir, name)

    const applyPath = path.join(folder, "apply.ps1")
    const metaPath = path.join(folder, "meta.json")

    const hasMeta = await fs
      .access(metaPath)
      .then(() => true)
      .catch(() => false)

    if (!hasMeta) continue

    const unapplyPath = path.join(folder, "unapply.ps1")

    let psapply = ""
    let psunapply = ""

    try {
      psapply = await fs.readFile(applyPath, "utf8")
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.warn(`Error reading apply.ps1 for tweak: ${name}`, error)
      }
    }

    try {
      psunapply = await fs.readFile(unapplyPath, "utf8")
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.warn(`Error reading unapply.ps1 for tweak: ${name}`, error)
      }
    }

    let meta = {}

    try {
      meta = JSON.parse(await fs.readFile(metaPath, "utf8"))
    } catch (error) {
      console.warn(`Error reading meta.json for tweak: ${name}`, error)
      continue
    }

    tweaks.push({
      name,
      psapply,
      psunapply: psunapply || "",
      ...meta,
    })
  }
  return tweaks
}

const getNipPath = () => {
  if (isDev) {
    return path.resolve(process.cwd(), "resources", "sparklenvidia.nip")
  }
  return path.join(process.resourcesPath, "sparklenvidia.nip")
}

function NvidiaProfileInspector() {
  const exePath = getExePath("nvidiaProfileInspector.exe")
  const nipPath = getNipPath()
  return new Promise((resolve, reject) => {
    exec(`"${exePath}" -silentImport "${nipPath}"`, (error, stdout, stderr) => {
      console.log("stdout:", stdout)
      console.log("stderr:", stderr)
      if (error) {
        console.error("Error:", error)
        reject(error)
      } else {
        resolve(stdout || "Completed with no output.")
      }
    })
  })
}

export const setupTweaksHandlers = () => {
  ipcMain.handle("tweak-states:load", async () => {
    try {
      await fs.access(tweaksStatePath)
      const data = await fs.readFile(tweaksStatePath, "utf8")
      return data
    } catch (error) {
      if (error.code === "ENOENT") {
        return JSON.stringify({})
      }
      console.error("Error loading tweak states:", error)
      throw error
    }
  })

  ipcMain.handle("tweak-states:save", async (event, payload) => {
    try {
      await fs.mkdir(path.dirname(tweaksStatePath), { recursive: true })
      await fs.writeFile(tweaksStatePath, payload, "utf8")
      return true
    } catch (error) {
      console.error("Error saving tweak states:", error)
      throw error
    }
  })

  ipcMain.handle("tweaks:fetch", async () => {
    return await loadTweaks()
  })

  ipcMain.handle("tweak:apply", async (_, name) => {
    const tweaks = await loadTweaks()
    const tweak = tweaks.find((t) => t.name === name)
    if (!tweak) {
      throw new Error(`No apply script found for tweak: ${name}`)
    }
    if (name === "optimize-nvidia-settings") {
      console.log(logo, "Running Nvidia settings optimization...")
      NvidiaProfileInspector()
    } else {
      return executePowerShell(null, { script: tweak.psapply, name })
    }
  })

  ipcMain.handle("tweak:unapply", async (_, name) => {
    const tweaks = await loadTweaks()
    const tweak = tweaks.find((t) => t.name === name)
    if (!tweak || !tweak.psunapply) {
      throw new Error(`No unapply script found for tweak: ${name}`)
    }
    return executePowerShell(null, { script: tweak.psunapply, name })
  })

  ipcMain.handle("nvidia-inspector", (_, args) => {
    return NvidiaProfileInspector(args)
  })
}

export const cleanupTweaksHandlers = () => {
  ipcMain.removeHandler("tweak-states:load")
  ipcMain.removeHandler("tweak-states:save")
  ipcMain.removeHandler("tweaks:fetch")
  ipcMain.removeHandler("tweak:apply")
  ipcMain.removeHandler("tweak:unapply")
  ipcMain.removeHandler("nvidia-inspector")
}

export default {
  setupTweaksHandlers,
  cleanupTweaksHandlers,
}
