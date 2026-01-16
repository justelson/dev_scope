import { useState, useEffect } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import TitleBar from "./components/Titlebar"
import Nav from "./components/Nav"
import "./app.css"
import { ToastContainer, Slide } from "react-toastify"
import Home from "./pages/Home"
import Tweaks from "./pages/Tweaks"
import Clean from "./pages/Clean"
import Apps from "./pages/Apps"
import Utilities from "./pages/Utilities"
import DNS from "./pages/DNS"
import Settings from "./pages/Settings"
import Backup from "./pages/Backup"
import FirstTime from "./components/FirstTime"
import UpdateManager from "./components/UpdateManager"

function App() {
  const [theme, setTheme] = useState(localStorage.getItem("theme"))

  useEffect(() => {
    const current = theme || "dark"
    setTheme(current)
    document.body.classList.remove("dark", "light", "purple")
    document.body.classList.add(current)
    document.body.setAttribute("data-theme", current)

    if (localStorage.getItem("posthogDisabled") === "true") {
      document.body.classList.add("ph-no-capture")
    } else {
      document.body.classList.remove("ph-no-capture")
    }
  }, [])
  return (
    <div className="flex flex-col h-screen bg-sparkle-bg text-sparkle-text overflow-hidden">
      <FirstTime />
      <TitleBar />
      <Nav />
      <div className="flex flex-1 pt-[50px] relative">
        <>
          <main className="flex-1 ml-52 p-6 ">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/tweaks" element={<Tweaks />} />
              <Route path="/clean" element={<Clean />} />
              <Route path="/backup" element={<Backup />} />
              <Route path="/utilities" element={<Utilities />} />
              <Route path="/dns" element={<DNS />} />
              <Route path="/apps" element={<Apps />} />{" "}
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </>
      </div>

      <UpdateManager />

      <ToastContainer
        stacked
        limit={5}
        position="bottom-right"
        theme="dark"
        transition={Slide}
        hideProgressBar
        pauseOnFocusLoss={false}
      />
    </div>
  )
}

export default App
