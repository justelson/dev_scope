import { useSyncExternalStore } from 'react'

type AssistantShipPayload = {
    id: number
    contextPath?: string
    prompt?: string
    source?: string
}

type AssistantDockState = {
    open: boolean
    width: number
    contextPath: string
    pendingShip: AssistantShipPayload | null
}

const WIDTH_MIN = 360
const WIDTH_MAX = 980
const DEFAULT_WIDTH = 560
const WIDTH_STORAGE_KEY = 'devscope:assistant-dock-width:v1'

const listeners = new Set<() => void>()

function clampWidth(width: number): number {
    if (!Number.isFinite(width)) return DEFAULT_WIDTH
    return Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, Math.round(width)))
}

function loadInitialWidth(): number {
    try {
        const raw = localStorage.getItem(WIDTH_STORAGE_KEY)
        if (!raw) return DEFAULT_WIDTH
        const storedWidth = Number(raw)
        // Migrate older default width down to the new default.
        if (storedWidth === 700) return DEFAULT_WIDTH
        return clampWidth(storedWidth)
    } catch {
        return DEFAULT_WIDTH
    }
}

let state: AssistantDockState = {
    open: false,
    width: loadInitialWidth(),
    contextPath: '',
    pendingShip: null
}

function emit() {
    listeners.forEach((listener) => listener())
}

function setState(updater: (prev: AssistantDockState) => AssistantDockState) {
    const next = updater(state)
    if (next === state) return
    state = next
    emit()
}

export function subscribeAssistantDock(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function getAssistantDockState(): AssistantDockState {
    return state
}

export function useAssistantDockState(): AssistantDockState {
    return useSyncExternalStore(subscribeAssistantDock, getAssistantDockState, getAssistantDockState)
}

export function openAssistantDock(input?: { contextPath?: string }) {
    const normalizedPath = String(input?.contextPath || '').trim()
    setState((prev) => ({
        ...prev,
        open: true,
        contextPath: normalizedPath || prev.contextPath,
        pendingShip: null
    }))
}

export function closeAssistantDock() {
    setState((prev) => ({
        ...prev,
        open: false,
        pendingShip: null
    }))
}

export function toggleAssistantDock(input?: { contextPath?: string }) {
    const normalizedPath = String(input?.contextPath || '').trim()
    setState((prev) => ({
        ...prev,
        open: !prev.open,
        contextPath: normalizedPath || prev.contextPath,
        pendingShip: null
    }))
}

export function setAssistantDockContextPath(path: string) {
    const normalizedPath = String(path || '').trim()
    setState((prev) => ({
        ...prev,
        contextPath: normalizedPath
    }))
}

export function setAssistantDockWidth(width: number) {
    const normalizedWidth = clampWidth(width)
    try {
        localStorage.setItem(WIDTH_STORAGE_KEY, String(normalizedWidth))
    } catch {
        // Ignore storage failures.
    }
    setState((prev) => ({
        ...prev,
        width: normalizedWidth
    }))
}

export function shipToAssistant(input: { contextPath?: string; prompt?: string; source?: string }) {
    const normalizedPath = String(input.contextPath || '').trim()
    const normalizedPrompt = String(input.prompt || '').trim()
    const ship: AssistantShipPayload = {
        id: Date.now(),
        contextPath: normalizedPath || undefined,
        prompt: normalizedPrompt || undefined,
        source: input.source
    }
    setState((prev) => ({
        ...prev,
        open: true,
        contextPath: normalizedPath || prev.contextPath,
        pendingShip: ship
    }))
}

export function acknowledgeAssistantShip(shipId: number) {
    setState((prev) => {
        if (!prev.pendingShip || prev.pendingShip.id !== shipId) return prev
        return {
            ...prev,
            pendingShip: null
        }
    })
}
