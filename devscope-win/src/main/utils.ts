/**
 * DevScope - Electron Toolkit Utils Shim
 * Provides utilities for Electron development
 */

import { app } from 'electron'
import path from 'path'

export const electronApp = {
    setAppUserModelId: (id: string) => {
        if (process.platform === 'win32') {
            app.setAppUserModelId(id)
        }
    }
}

export const optimizer = {
    // Placeholder for optimizer utilities
}

export const is = {
    dev: !app.isPackaged,
    prod: app.isPackaged
}
