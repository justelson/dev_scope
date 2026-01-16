import { promises as fsp } from "fs"
import os from "os"
import path from "path"
import util from "util"
import { exec } from "child_process"
import { app, ipcMain } from "electron"
import { mainWindow } from "./index"
import fs from "fs"
import log from "electron-log"
const execPromise = util.promisify(exec)

console.log = log.log
console.error = log.error
console.warn = log.warn

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

export async function executePowerShell(_, props) {
  const { script, name = "script" } = props

  try {
    const tempDir = path.join(app.getPath("userData"), "scripts")
    ensureDirectoryExists(tempDir)
    const tempFile = path.join(tempDir, `${name}-${Date.now()}.ps1`)

    await fsp.writeFile(tempFile, script)

    const { stdout, stderr } = await execPromise(
      `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`,
    )

    await fsp.unlink(tempFile).catch(console.error)

    if (stderr) {
      console.warn(`PowerShell stderr [${name}]:`, stderr)
    }

    console.log(`PowerShell stdout [${name}]:`, stdout)

    return { success: true, output: stdout }
  } catch (error) {
    console.error(`PowerShell execution error [${name}]:`, error)
    return { success: false, error: error.message }
  }
}
async function runPowerShellInWindow(event, { script, name = "script", noExit = true }) {
  try {
    const tempDir = path.join(app.getPath("userData"), "scripts")
    ensureDirectoryExists(tempDir)

    const tempFile = path.join(tempDir, `${name}-${Date.now()}.ps1`)
    await fsp.writeFile(tempFile, script)
    const noExitFlag = noExit ? "-NoExit" : ""
    const command = `start powershell.exe ${noExitFlag} -ExecutionPolicy Bypass -File "${tempFile}"`

    exec(command, (error) => {
      if (error) {
        console.error(`Error launching PowerShell window [${name}]:`, error)
      }
    })

    return { success: true }
  } catch (error) {
    console.error(`Error in runPowerShellInWindow [${name}]:`, error)
    return { success: false, error: error.message }
  }
}

ipcMain.handle("run-powershell-window", runPowerShellInWindow)
ipcMain.handle("run-powershell", executePowerShell)
ipcMain.handle("handle-apps", async (event, { action, apps }) => {
  switch (action) {
    case "install":
      for (const app of apps) {
        const command = `winget install ${app} --silent --accept-package-agreements --accept-source-agreements`
        mainWindow.webContents.send("install-progress", `${app}`)
        const result = await executePowerShell(event, { script: command, name: `Install-${app}` })
        if (result.success) {
          console.log(`Successfully installed ${app}`)
        } else {
          console.error(`Failed to install ${app}:`, result.error)
          mainWindow.webContents.send("install-error")
        }
      }
      mainWindow.webContents.send("install-complete")
      break
    case "uninstall":
      for (const app of apps) {
        const command = `winget uninstall ${app} --silent`
        mainWindow.webContents.send("install-progress", `${app}`)
        const result = await executePowerShell(event, { script: command, name: `Uninstall-${app}` })
        if (result.success) {
          console.log(`Successfully uninstalled ${app}`)
        } else {
          console.error(`Failed to uninstall ${app}:`, result.error)
          mainWindow.webContents.send("install-error")
        }
      }
      mainWindow.webContents.send("install-complete")
      break
    case "check-installed":
      try {
        const result = await executePowerShell(event, {
          script: "winget list",
          name: "check-installed",
        })

        if (!result.success) {
          throw new Error(result.error)
        }

        const escapeRegExp = (string) => {
          return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        }

        const installedAppIds = apps.filter((appId) => {
          const regex = new RegExp(`\\b${escapeRegExp(appId)}\\b`, "i")
          return regex.test(result.output)
        })

        mainWindow.webContents.send("installed-apps-checked", {
          success: true,
          installed: installedAppIds,
        })
      } catch (error) {
        console.error("Failed to check installed apps:", error)
        mainWindow.webContents.send("installed-apps-checked", {
          success: false,
          error: error.message,
        })
      }
      break
    default:
      console.error(`Unknown action: ${action}`)
  }
})
