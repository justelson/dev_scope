/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEVSCOPE_RELAY_URL?: string
  readonly VITE_DEVSCOPE_RELAY_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
