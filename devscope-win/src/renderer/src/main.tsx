import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { prefetchEssentialData } from './lib/refreshCache'

// Start prefetching essential data immediately (lightweight)
// Heavy data (tooling, AI runtime) loads in background
prefetchEssentialData()

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
