import { Tray, Menu, app } from "electron"
import path from "path"

export function createTray(mainWindow) {
  const tray = new Tray(path.join(__dirname, "../../resources/sparkle2.ico"))

  const contextMenu = Menu.buildFromTemplate([
    { label: "Open Window", click: () => mainWindow.show() },
    { label: "Quit", click: () => app.quit() },
  ])

  tray.setToolTip("Sparkle Optimizer")
  tray.setTitle("Sparkle Optimizer")
  tray.setContextMenu(contextMenu)
  tray.on("click", () => ToggleWindowState(mainWindow))
}

function ToggleWindowState(mainWindow) {
  mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
}
