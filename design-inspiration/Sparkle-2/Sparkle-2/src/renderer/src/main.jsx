import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { HashRouter } from "react-router-dom"
import { init } from "@sentry/electron/renderer"
import { init as reactInit } from "@sentry/react"
import { PostHogProvider } from "posthog-js/react"
import * as Sentry from "@sentry/react"

init({
  sendDefaultPii: true,
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  reactInit,
})

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PostHogProvider
      apiKey="phc_4vF2nxwQK17nl5wIQ4sT8UJae8iHZmsjGkPxgyQJhZo"
      options={{
        api_host: "https://us.i.posthog.com",
        capture_exceptions: true,
        debug: import.meta.env.MODE === "development",
      }}
    >
      <HashRouter>
        <App />
      </HashRouter>
    </PostHogProvider>
  </React.StrictMode>,
)
