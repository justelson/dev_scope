import { Minus, Square, X } from "lucide-react"
import { close, minimize, toggleMaximize } from "../lib/electron"
import sparkleLogo from "../../../../resources/sparklelogo.png"

function TitleBar() {
  return (
    <div
      style={{ WebkitAppRegion: "drag" }}
      className="h-[50px] fixed top-0 left-0 right-0 z-10 flex justify-between items-center pl-4 border-b border-sparkle-border-secondary"
    >
      <div className="flex items-center gap-3 border-r h-full w-48 border-sparkle-border-secondary pr-4">
        <img src={sparkleLogo} alt="Sparkle" className="h-5 w-5" />
        <span className="text-sparkle-text text-sm font-medium">Sparkle</span>
        <div className="bg-sparkle-card border border-sparkle-border-secondary p-1 rounded-xl w-16 text-center text-sm text-sparkle-text">
          Beta
        </div>
      </div>

      <div className="flex" style={{ WebkitAppRegion: "no-drag" }}>
        <button
          onClick={minimize}
          className="h-[50px] w-12 inline-flex items-center justify-center text-sparkle-text-secondary hover:bg-sparkle-accent transition-colors"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={toggleMaximize}
          className="h-[50px] w-12 inline-flex items-center justify-center text-sparkle-text-secondary hover:bg-sparkle-accent transition-colors"
        >
          <Square size={14} />
        </button>
        <button
          onClick={close}
          className="h-[50px] w-12 inline-flex items-center justify-center text-sparkle-text-secondary hover:bg-red-600 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

export default TitleBar
