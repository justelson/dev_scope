import { useEffect, useMemo, useRef, useState } from 'react'
import { LEFT_PANEL_MAX_WIDTH, LEFT_PANEL_MIN_WIDTH, RIGHT_PANEL_MAX_WIDTH, RIGHT_PANEL_MIN_WIDTH } from './modalShared'
import { VIEWPORT_PRESETS, type ViewportPreset } from './viewport'

type UseFilePreviewChromeParams = {
    resetKey: string
    defaultStartExpanded: boolean
    defaultLeftPanelOpen: boolean
    defaultRightPanelOpen: boolean
}

export function useFilePreviewChrome({
    resetKey,
    defaultStartExpanded,
    defaultLeftPanelOpen,
    defaultRightPanelOpen
}: UseFilePreviewChromeParams) {
    const [viewport, setViewport] = useState<ViewportPreset>('responsive')
    const [isExpanded, setIsExpanded] = useState(defaultStartExpanded)
    const [leftPanelOpen, setLeftPanelOpen] = useState(defaultLeftPanelOpen)
    const [rightPanelOpen, setRightPanelOpen] = useState(defaultRightPanelOpen)
    const [leftPanelWidth, setLeftPanelWidth] = useState(260)
    const [rightPanelWidth, setRightPanelWidth] = useState(288)
    const [isResizingPanels, setIsResizingPanels] = useState(false)
    const [csvDistinctColorsEnabled, setCsvDistinctColorsEnabled] = useState(true)
    const [editorWordWrap, setEditorWordWrap] = useState<'on' | 'off'>('off')
    const [editorMinimapEnabled, setEditorMinimapEnabled] = useState(true)
    const [editorFontSize, setEditorFontSize] = useState(13)
    const [findRequestToken, setFindRequestToken] = useState(0)
    const [replaceRequestToken, setReplaceRequestToken] = useState(0)
    const [focusLine, setFocusLine] = useState<number | null>(null)

    const previewSurfaceRef = useRef<HTMLDivElement | null>(null)
    const panelResizeRef = useRef<{ side: 'left' | 'right'; startX: number; startWidth: number } | null>(null)

    useEffect(() => {
        setViewport('responsive')
        setIsExpanded(defaultStartExpanded)
        setLeftPanelOpen(defaultLeftPanelOpen)
        setRightPanelOpen(defaultRightPanelOpen)
        setLeftPanelWidth(260)
        setRightPanelWidth(288)
        setIsResizingPanels(false)
        setCsvDistinctColorsEnabled(true)
        setEditorWordWrap('off')
        setEditorMinimapEnabled(true)
        setEditorFontSize(13)
        setFindRequestToken(0)
        setReplaceRequestToken(0)
        setFocusLine(null)
    }, [defaultLeftPanelOpen, defaultRightPanelOpen, defaultStartExpanded, resetKey])

    useEffect(() => {
        if (!isExpanded) return

        const applyBodyDragState = (active: boolean) => {
            if (active) {
                document.body.style.cursor = 'col-resize'
                document.body.style.userSelect = 'none'
                return
            }

            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }

        const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

        const handleMouseMove = (event: MouseEvent) => {
            const resize = panelResizeRef.current
            if (!resize) return

            if (resize.side === 'left') {
                const delta = event.clientX - resize.startX
                setLeftPanelWidth(clamp(resize.startWidth + delta, LEFT_PANEL_MIN_WIDTH, LEFT_PANEL_MAX_WIDTH))
                return
            }

            const delta = resize.startX - event.clientX
            setRightPanelWidth(clamp(resize.startWidth + delta, RIGHT_PANEL_MIN_WIDTH, RIGHT_PANEL_MAX_WIDTH))
        }

        const stopResize = () => {
            panelResizeRef.current = null
            setIsResizingPanels(false)
            applyBodyDragState(false)
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', stopResize)
        }

        const handleMouseDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null
            const side = target?.dataset?.previewResizeSide
            if (side !== 'left' && side !== 'right') return

            event.preventDefault()
            panelResizeRef.current = {
                side,
                startX: event.clientX,
                startWidth: side === 'left' ? leftPanelWidth : rightPanelWidth
            }
            setIsResizingPanels(true)
            applyBodyDragState(true)
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', stopResize)
        }

        window.addEventListener('mousedown', handleMouseDown)
        return () => {
            window.removeEventListener('mousedown', handleMouseDown)
            stopResize()
        }
    }, [isExpanded, leftPanelWidth, rightPanelWidth])

    const modalStyle = useMemo(() => {
        if (isExpanded) {
            return {
                width: '100%',
                maxWidth: 'none',
                maxHeight: '100%',
                height: '100%'
            }
        }

        return {
            animation: 'scaleIn 0.15s ease-out',
            width: 'min(1400px, 95vw)',
            maxWidth: '1400px',
            height: 'min(920px, 90vh)',
            maxHeight: '90vh'
        }
    }, [isExpanded])

    return {
        viewport,
        setViewport,
        isExpanded,
        setIsExpanded,
        leftPanelOpen,
        setLeftPanelOpen,
        rightPanelOpen,
        setRightPanelOpen,
        leftPanelWidth,
        rightPanelWidth,
        isResizingPanels,
        csvDistinctColorsEnabled,
        setCsvDistinctColorsEnabled,
        editorWordWrap,
        setEditorWordWrap,
        editorMinimapEnabled,
        setEditorMinimapEnabled,
        editorFontSize,
        setEditorFontSize,
        findRequestToken,
        setFindRequestToken,
        replaceRequestToken,
        setReplaceRequestToken,
        focusLine,
        setFocusLine,
        previewSurfaceRef,
        modalStyle,
        presetConfig: VIEWPORT_PRESETS[viewport]
    }
}
