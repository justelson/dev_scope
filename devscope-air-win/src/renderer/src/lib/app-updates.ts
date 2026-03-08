import { useEffect, useState } from 'react'
import type { DevScopeUpdateState } from '@shared/contracts/devscope-api'

export function useAppUpdateState() {
    const [updateState, setUpdateState] = useState<DevScopeUpdateState | null>(null)

    useEffect(() => {
        let mounted = true

        void window.devscope.updates.getState().then((state) => {
            if (mounted) {
                setUpdateState(state)
            }
        }).catch(() => undefined)

        const unsubscribe = window.devscope.updates.onStateChange((state) => {
            if (mounted) {
                setUpdateState(state)
            }
        })

        return () => {
            mounted = false
            unsubscribe()
        }
    }, [])

    return updateState
}

export function getUpdateActionLabel(updateState: DevScopeUpdateState | null): string {
    if (!updateState || !updateState.enabled) return 'Updates unavailable'
    switch (updateState.status) {
        case 'checking':
            return 'Checking for updates...'
        case 'available':
            return updateState.availableDisplayVersion
                ? `Update available: ${updateState.availableDisplayVersion}`
                : 'Update available'
        case 'downloading':
            return updateState.downloadPercent !== null
                ? `Downloading ${Math.round(updateState.downloadPercent)}%`
                : 'Downloading update...'
        case 'downloaded':
            return updateState.downloadedDisplayVersion
                ? `Ready to install: ${updateState.downloadedDisplayVersion}`
                : 'Ready to install'
        case 'up-to-date':
            return updateState.checkedAt ? 'Up to date' : 'Check for updates'
        case 'error':
            return updateState.message || 'Update failed'
        default:
            return 'Check for updates'
    }
}
