import { useEffect, useState } from 'react'
import type { AssistantComposerPreferenceEffort } from './assistant-composer-preferences'

const LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY = 'assistant-left-sidebar-collapsed'
const LEFT_SIDEBAR_WIDTH_STORAGE_KEY = 'assistant-left-sidebar-width'
const RIGHT_SIDEBAR_OPEN_STORAGE_KEY = 'assistant-right-sidebar-open'
const RIGHT_PANEL_MODE_STORAGE_KEY = 'assistant-right-panel-mode'

export type AssistantRightPanelMode = 'none' | 'details' | 'plan' | 'diff'

export const SIDEBAR_EFFORT_LABELS: Record<AssistantComposerPreferenceEffort, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    xhigh: 'Extra High'
}

export function useAssistantPageSidebarState() {
    const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(() => localStorage.getItem(LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true')
    const [leftSidebarWidth, setLeftSidebarWidth] = useState(() => {
        const saved = Number(localStorage.getItem(LEFT_SIDEBAR_WIDTH_STORAGE_KEY))
        return Number.isFinite(saved) && saved > 0 ? saved : 320
    })
    const [rightPanelMode, setRightPanelMode] = useState<AssistantRightPanelMode>(() => {
        const savedMode = localStorage.getItem(RIGHT_PANEL_MODE_STORAGE_KEY)
        if (savedMode === 'details' || savedMode === 'plan' || savedMode === 'diff' || savedMode === 'none') return savedMode

        const legacySaved = localStorage.getItem(RIGHT_SIDEBAR_OPEN_STORAGE_KEY)
        return legacySaved !== null ? (legacySaved === 'true' ? 'details' : 'none') : 'details'
    })

    useEffect(() => {
        localStorage.setItem(LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY, String(leftSidebarCollapsed))
    }, [leftSidebarCollapsed])

    useEffect(() => {
        localStorage.setItem(LEFT_SIDEBAR_WIDTH_STORAGE_KEY, String(leftSidebarWidth))
    }, [leftSidebarWidth])

    useEffect(() => {
        localStorage.setItem(RIGHT_PANEL_MODE_STORAGE_KEY, rightPanelMode)
        localStorage.setItem(RIGHT_SIDEBAR_OPEN_STORAGE_KEY, String(rightPanelMode === 'details'))
    }, [rightPanelMode])

    return {
        leftSidebarCollapsed,
        setLeftSidebarCollapsed,
        leftSidebarWidth,
        setLeftSidebarWidth,
        rightPanelMode,
        setRightPanelMode
    }
}
