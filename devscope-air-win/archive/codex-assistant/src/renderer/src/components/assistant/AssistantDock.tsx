import { useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { AssistantPageContent } from '@/pages/assistant/AssistantPageContent'
import { useAssistantPageController } from '@/pages/assistant/useAssistantPageController'
import {
    acknowledgeAssistantShip,
    closeAssistantDock,
    setAssistantDockContextPath,
    setAssistantDockWidth,
    useAssistantDockState
} from '@/lib/assistantDockStore'

const TITLE_BAR_HEIGHT = 46
const MAX_PENDING_SHIP_AGE_MS = 30000

function isProjectsAreaPath(pathname: string): boolean {
    return (
        pathname === '/projects'
        || pathname.startsWith('/projects/')
        || pathname.startsWith('/folder-browse/')
    )
}

function decodePathSegment(value: string): string {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

function resolveContextPathFromRoute(pathname: string): string {
    if (pathname.startsWith('/projects/')) {
        return decodePathSegment(pathname.slice('/projects/'.length)).trim()
    }
    if (pathname.startsWith('/folder-browse/')) {
        return decodePathSegment(pathname.slice('/folder-browse/'.length)).trim()
    }
    return ''
}

function AssistantDockContent({
    routeContextPath,
    contextPath,
    pendingShip
}: {
    routeContextPath: string
    contextPath: string
    pendingShip: { id: number; contextPath?: string; prompt?: string } | null
}) {
    const controller = useAssistantPageController()
    const appliedPathRef = useRef('')
    const handledShipIdRef = useRef(0)

    const effectiveContextPath = String(contextPath || routeContextPath || '').trim()

    useEffect(() => {
        if (!effectiveContextPath) return
        controller.setChatProjectPath(effectiveContextPath)
        controller.setWorkflowProjectPath(effectiveContextPath)
    }, [controller, effectiveContextPath])

    useEffect(() => {
        if (!effectiveContextPath) return
        if (appliedPathRef.current === effectiveContextPath) return
        appliedPathRef.current = effectiveContextPath
        void controller.handleApplyChatProjectPath(effectiveContextPath)
    }, [controller, effectiveContextPath])

    useEffect(() => {
        if (!pendingShip || pendingShip.id === handledShipIdRef.current) return

        handledShipIdRef.current = pendingShip.id
        let cancelled = false

        const run = async () => {
            try {
                const payloadAgeMs = Math.max(0, Date.now() - Number(pendingShip.id || 0))
                if (payloadAgeMs > MAX_PENDING_SHIP_AGE_MS) {
                    return
                }

                const shipPath = String(pendingShip.contextPath || '').trim()
                if (shipPath) {
                    controller.setChatProjectPath(shipPath)
                    controller.setWorkflowProjectPath(shipPath)
                    await controller.handleApplyChatProjectPath(shipPath)
                }

                const shipPrompt = String(pendingShip.prompt || '').trim()
                if (shipPrompt && !cancelled) {
                    if (!controller.status.connected) {
                        await controller.handleConnect()
                    }
                    if (!cancelled) {
                        await controller.handleSend(shipPrompt, [])
                    }
                }
            } finally {
                acknowledgeAssistantShip(pendingShip.id)
            }
        }

        void run()
        return () => {
            cancelled = true
        }
    }, [controller, pendingShip])

    return (
        <div className="h-full overflow-hidden">
            <AssistantPageContent controller={controller} layoutMode="dock" />
        </div>
    )
}

export function AssistantDock() {
    const location = useLocation()
    const dock = useAssistantDockState()

    const isAssistantRoute = location.pathname === '/assistant' || location.pathname.startsWith('/assistant/')
    const isProjectsAreaRoute = isProjectsAreaPath(location.pathname)
    const routeContextPath = useMemo(
        () => resolveContextPathFromRoute(location.pathname),
        [location.pathname]
    )

    useEffect(() => {
        if (isAssistantRoute || !routeContextPath) return
        setAssistantDockContextPath(routeContextPath)
    }, [isAssistantRoute, routeContextPath])

    useEffect(() => {
        if (isProjectsAreaRoute || !dock.open) return
        closeAssistantDock()
    }, [isProjectsAreaRoute, dock.open])

    useEffect(() => {
        if (!dock.open) return

        const handleResizeStart = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null
            if (!target?.dataset?.assistantDockResize) return

            event.preventDefault()
            const startX = event.clientX
            const startWidth = dock.width

            const handleMove = (moveEvent: MouseEvent) => {
                const deltaX = startX - moveEvent.clientX
                setAssistantDockWidth(startWidth + deltaX)
            }
            const handleUp = () => {
                window.removeEventListener('mousemove', handleMove)
                window.removeEventListener('mouseup', handleUp)
            }

            window.addEventListener('mousemove', handleMove)
            window.addEventListener('mouseup', handleUp)
        }

        window.addEventListener('mousedown', handleResizeStart)
        return () => {
            window.removeEventListener('mousedown', handleResizeStart)
        }
    }, [dock.open, dock.width])

    if (isAssistantRoute || !isProjectsAreaRoute) return null

    return (
        <>
            <div
                className={cn(
                    'fixed right-0 z-[18] overflow-hidden bg-sparkle-bg/96 backdrop-blur-xl transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                    dock.open
                        ? 'shadow-[0_0_24px_rgba(0,0,0,0.18)]'
                        : 'pointer-events-none shadow-none'
                )}
                style={{
                    top: `${TITLE_BAR_HEIGHT}px`,
                    height: `calc(100vh - ${TITLE_BAR_HEIGHT}px)`,
                    width: dock.open ? `${dock.width}px` : '0px'
                }}
            >
                <div
                    aria-hidden="true"
                    className={cn(
                        'pointer-events-none absolute inset-y-0 left-0 w-px transition-opacity duration-300',
                        dock.open ? 'opacity-100' : 'opacity-0'
                    )}
                    style={{
                        background: 'linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--color-text), transparent 90%) 12%, color-mix(in srgb, var(--color-text), transparent 86%) 50%, color-mix(in srgb, var(--color-text), transparent 90%) 88%, transparent 100%)'
                    }}
                />

                <div
                    data-assistant-dock-resize="true"
                    className={cn(
                        'group absolute -left-0.5 top-0 z-[19] h-full w-2 cursor-col-resize bg-transparent transition-colors',
                        dock.open ? 'hover:bg-white/[0.03]' : 'pointer-events-none'
                    )}
                    title="Resize assistant dock"
                >
                    <div
                        className={cn(
                            'pointer-events-none absolute left-1/2 top-1/2 h-14 w-px -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200',
                            dock.open
                                ? 'bg-white/10 opacity-80 group-hover:h-20 group-hover:bg-[var(--accent-primary)]/50 group-hover:opacity-100'
                                : 'opacity-0'
                        )}
                    />
                </div>

                {dock.open && (
                    <AssistantDockContent
                        routeContextPath={routeContextPath}
                        contextPath={dock.contextPath}
                        pendingShip={dock.pendingShip}
                    />
                )}
            </div>
        </>
    )
}
