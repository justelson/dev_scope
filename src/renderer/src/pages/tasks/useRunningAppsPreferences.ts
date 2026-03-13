import { useEffect, useRef, useState } from 'react'
import type { MemoryUnit, RunningAppsPreferences, RunningAppsSort } from './tasks-types'
import { RUNNING_APPS_PREFS_KEY } from './tasks-types'

function readRunningAppsPreferences(): Partial<RunningAppsPreferences> {
    try {
        const raw = window.localStorage.getItem(RUNNING_APPS_PREFS_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw) as Partial<RunningAppsPreferences>
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
        return {}
    }
}

export function useRunningAppsPreferences() {
    const savedPrefsRef = useRef<Partial<RunningAppsPreferences> | null>(null)
    if (savedPrefsRef.current === null) {
        savedPrefsRef.current = readRunningAppsPreferences()
    }

    const savedPrefs = savedPrefsRef.current
    const [appScope, setAppScope] = useState<'all' | 'app' | 'background'>(
        savedPrefs.appScope === 'app' || savedPrefs.appScope === 'background' ? savedPrefs.appScope : 'all'
    )
    const [appsFilter, setAppsFilter] = useState<'all' | 'highCpu' | 'highMemory' | 'multiInstance' | 'activeOnly'>(
        savedPrefs.appsFilter === 'highCpu'
        || savedPrefs.appsFilter === 'highMemory'
        || savedPrefs.appsFilter === 'multiInstance'
        || savedPrefs.appsFilter === 'activeOnly'
            ? savedPrefs.appsFilter
            : 'all'
    )
    const [memoryUnit, setMemoryUnit] = useState<MemoryUnit>(savedPrefs.memoryUnit === 'gb' ? 'gb' : 'mb')
    const [sortBy, setSortBy] = useState<RunningAppsSort>(
        savedPrefs.sortBy === 'name'
        || savedPrefs.sortBy === 'processCount'
        || savedPrefs.sortBy === 'cpu'
        || savedPrefs.sortBy === 'memoryMb'
        || savedPrefs.sortBy === 'avgUsage'
            ? savedPrefs.sortBy
            : 'avgUsage'
    )
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
        savedPrefs.sortDirection === 'asc' ? 'asc' : 'desc'
    )
    const [appsPage, setAppsPage] = useState(1)

    useEffect(() => {
        const prefs: RunningAppsPreferences = {
            appScope,
            appsFilter,
            sortBy,
            sortDirection,
            memoryUnit
        }
        try {
            window.localStorage.setItem(RUNNING_APPS_PREFS_KEY, JSON.stringify(prefs))
        } catch {
            // Ignore persistence failures in restricted environments.
        }
    }, [appScope, appsFilter, sortBy, sortDirection, memoryUnit])

    useEffect(() => {
        setAppsPage(1)
    }, [appsFilter, appScope, sortBy, sortDirection])

    return {
        appScope,
        setAppScope,
        appsFilter,
        setAppsFilter,
        memoryUnit,
        setMemoryUnit,
        sortBy,
        setSortBy,
        sortDirection,
        setSortDirection,
        appsPage,
        setAppsPage
    }
}
