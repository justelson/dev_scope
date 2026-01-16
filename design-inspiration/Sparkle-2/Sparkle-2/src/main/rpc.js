import { ipcMain } from "electron"
import discordRPC from "discord-rpc"
import { logo } from "."
import jsonData from "../../package.json"
import log from "electron-log"
console.log = log.log
console.error = log.error
console.warn = log.warn
const clientId = "1188686354490609754"
let rpcClient

function startDiscordRPC() {
  try {
    rpcClient = new discordRPC.Client({ transport: "ipc" })

    rpcClient.on("ready", () => {
      console.log("(rpc.js) ", logo, "Discord RPC connected")

      rpcClient.setActivity({
        details: "Optimizing your PC",
        state: `Running Sparkle v${jsonData.version || "2"}`,
        buttons: [
          { label: "Download Sparkle", url: "https://parcoil.com/sparkle" },
          { label: "Join Discord", url: "https://discord.com/invite/En5YJYWj3Z" },
        ],
        largeImageKey: "sparklelogo",
        largeImageText: "Sparkle Optimizer",
        instance: false,
      })
    })

    rpcClient.login({ clientId }).catch(console.error)
    return true
  } catch (error) {
    console.error("(rpc.js) ", "Failed to start Discord RPC:", error)
    return false
  }
}

function stopDiscordRPC() {
  if (rpcClient) {
    rpcClient.destroy()
    rpcClient = null
    console.log("(rpc.js) ", "Discord RPC disconnected")
    return true
  }
  return false
}

ipcMain.handle("start-discord-rpc", () => {
  return startDiscordRPC()
})

ipcMain.handle("stop-discord-rpc", () => {
  return stopDiscordRPC()
})

export { startDiscordRPC, stopDiscordRPC }
