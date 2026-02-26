import Editor, { loader } from '@monaco-editor/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { editor as MonacoEditor } from 'monaco-editor'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { useSettings } from '@/lib/settings'
import { parseUnifiedDiffMarkers, type GitLineMarker } from './gitDiff'

const globalWithMonaco = globalThis as typeof globalThis & {
    MonacoEnvironment?: {
        getWorker: (_moduleId: string, label: string) => Worker
    }
}

if (!globalWithMonaco.MonacoEnvironment) {
    globalWithMonaco.MonacoEnvironment = {
        getWorker: (_moduleId: string, label: string) => {
            if (label === 'json') return new jsonWorker()
            if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
            if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
            if (label === 'typescript' || label === 'javascript') return new tsWorker()
            return new editorWorker()
        }
    }
}

loader.config({ monaco })

const MONACO_THEME_ID = 'devscope-preview'

const baseOptions: MonacoEditor.IStandaloneEditorConstructionOptions = {
    readOnly: true,
    domReadOnly: true,
    minimap: {
        enabled: true,
        side: 'right',
        renderCharacters: false,
        showSlider: 'always',
        size: 'proportional',
        scale: 1,
        maxColumn: 140
    },
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    renderLineHighlight: 'none',
    automaticLayout: true,
    smoothScrolling: false,
    contextmenu: true,
    overviewRulerLanes: 3,
    hideCursorInOverviewRuler: true,
    wordWrap: 'off',
    wrappingStrategy: 'advanced',
    cursorBlinking: 'solid',
    occurrencesHighlight: 'off',
    selectionHighlight: false,
    renderValidationDecorations: 'off',
    scrollbar: {
        vertical: 'visible',
        horizontal: 'visible',
        alwaysConsumeMouseWheel: false,
        useShadows: false,
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10
    },
    fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
    fontSize: 13,
    lineHeight: 20,
    padding: { top: 14, bottom: 14 },
    stickyScroll: { enabled: false },
    unicodeHighlight: { ambiguousCharacters: false },
    links: false
}

const largeFileOptions: MonacoEditor.IStandaloneEditorConstructionOptions = {
    ...baseOptions,
    minimap: {
        enabled: true,
        side: 'right',
        renderCharacters: false,
        showSlider: 'always',
        size: 'fit',
        scale: 1,
        maxColumn: 90
    },
    folding: false,
    codeLens: false,
    bracketPairColorization: { enabled: false },
    guides: { bracketPairs: false, indentation: false }
}

interface MonacoPreviewEditorProps {
    value: string
    language: string
    modelPath?: string
    isLargeFile: boolean
    filePath?: string
    projectPath?: string
    gitDiffText?: string
}

function readThemeVariable(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback
    const computed = getComputedStyle(document.body)
    const value = computed.getPropertyValue(name).trim()
    return value || fallback
}

function applyMonacoTheme(theme: string) {
    const isLightTheme = theme === 'light'
    const text = readThemeVariable('--color-text', isLightTheme ? '#1e293b' : '#e2e8f0')
    const textDark = readThemeVariable('--color-text-dark', isLightTheme ? '#475569' : '#cbd5e1')
    const textSecondary = readThemeVariable('--color-text-secondary', isLightTheme ? '#64748b' : '#94a3b8')
    const card = readThemeVariable('--color-card', isLightTheme ? '#ffffff' : '#131c2c')
    const bg = readThemeVariable('--color-bg', isLightTheme ? '#f9fafb' : '#0c121f')
    const border = readThemeVariable('--color-border', isLightTheme ? '#e2e8f0' : '#1f2a3d')
    const accent = readThemeVariable('--accent-primary', isLightTheme ? '#2563eb' : '#60a5fa')

    const themeData: monaco.editor.IStandaloneThemeData = {
        base: isLightTheme ? 'vs' : 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': card,
            'editor.foreground': text,
            'editor.lineHighlightBackground': 'transparent',
            'editorCursor.foreground': accent,
            'editorLineNumber.foreground': textSecondary,
            'editorLineNumber.activeForeground': textDark,
            'editor.selectionBackground': `${accent}33`,
            'editor.inactiveSelectionBackground': `${accent}20`,
            'editorIndentGuide.background1': `${border}99`,
            'editorIndentGuide.activeBackground1': `${textSecondary}aa`,
            'editorRuler.foreground': `${border}99`,
            'editorGutter.background': card,
            'editorOverviewRuler.border': border,
            'editorBracketMatch.border': accent,
            'editorBracketMatch.background': `${accent}1f`,
            'minimap.background': bg,
            'minimapSlider.background': `${accent}33`,
            'minimapSlider.hoverBackground': `${accent}55`,
            'minimapSlider.activeBackground': `${accent}77`,
            'scrollbarSlider.background': `${accent}33`,
            'scrollbarSlider.hoverBackground': `${accent}55`,
            'scrollbarSlider.activeBackground': `${accent}77`
        }
    }

    try {
        monaco.editor.defineTheme(MONACO_THEME_ID, themeData)
        monaco.editor.setTheme(MONACO_THEME_ID)
    } catch (error) {
        console.error('Failed to apply Monaco theme, falling back to built-in theme:', error)
        monaco.editor.setTheme(isLightTheme ? 'vs' : 'vs-dark')
    }
}

export default function MonacoPreviewEditor({ value, language, modelPath, isLargeFile, filePath, projectPath, gitDiffText }: MonacoPreviewEditorProps) {
    const { settings } = useSettings()
    const editorTheme = useMemo(() => MONACO_THEME_ID, [])
    const [compactLayout, setCompactLayout] = useState(() => {
        if (typeof window === 'undefined') return false
        return window.innerWidth < 980
    })
    const [lineMarkers, setLineMarkers] = useState<GitLineMarker[]>([])
    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
    const decorationIdsRef = useRef<string[]>([])

    useEffect(() => {
        applyMonacoTheme(settings.theme)
    }, [settings.theme, settings.accentColor.primary, settings.accentColor.secondary])

    useEffect(() => {
        if (typeof window === 'undefined') return

        const updateLayout = () => {
            setCompactLayout(window.innerWidth < 980)
        }

        window.addEventListener('resize', updateLayout)
        return () => window.removeEventListener('resize', updateLayout)
    }, [])

    useEffect(() => {
        let disposed = false

        const loadGitMarkers = async () => {
            if (typeof gitDiffText === 'string') {
                if (!disposed) {
                    setLineMarkers(parseUnifiedDiffMarkers(gitDiffText))
                }
                return
            }

            if (!projectPath || !filePath || isLargeFile) {
                if (!disposed) setLineMarkers([])
                return
            }

            try {
                const response = await window.devscope.getWorkingDiff(projectPath, filePath, 'combined')
                if (disposed || !response?.success) {
                    if (!disposed) setLineMarkers([])
                    return
                }

                const nextMarkers = parseUnifiedDiffMarkers(String(response.diff || ''))
                if (!disposed) setLineMarkers(nextMarkers)
            } catch {
                if (!disposed) setLineMarkers([])
            }
        }

        void loadGitMarkers()
        return () => {
            disposed = true
        }
    }, [gitDiffText, projectPath, filePath, isLargeFile, value])

    useEffect(() => {
        const editor = editorRef.current
        if (!editor) return

        const markerPalette = {
            added: { solid: '#73C991', minimap: '#73C991B3' },
            modified: { solid: '#E2C08D', minimap: '#E2C08DB3' },
            deleted: { solid: '#FF6B6B', minimap: '#FF6B6BB3' }
        } as const

        const nextDecorations = lineMarkers.map((marker) => ({
            range: new monaco.Range(marker.line, 1, marker.line, 1),
            options: {
                isWholeLine: false,
                linesDecorationsClassName:
                    marker.type === 'added'
                        ? 'git-preview-gutter-added'
                        : marker.type === 'modified'
                            ? 'git-preview-gutter-modified'
                            : 'git-preview-gutter-deleted',
                overviewRuler: {
                    color: markerPalette[marker.type].solid,
                    position: monaco.editor.OverviewRulerLane.Full
                },
                minimap: {
                    color: markerPalette[marker.type].minimap,
                    position: monaco.editor.MinimapPosition.Inline
                }
            }
        }))

        decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, nextDecorations)
    }, [lineMarkers])

    useEffect(() => {
        return () => {
            const editor = editorRef.current
            if (editor) {
                editor.deltaDecorations(decorationIdsRef.current, [])
            }
            decorationIdsRef.current = []
            editorRef.current = null
        }
    }, [])

    const editorOptions = useMemo<MonacoEditor.IStandaloneEditorConstructionOptions>(() => {
        const base = isLargeFile ? largeFileOptions : baseOptions
        if (!compactLayout) return base

        return {
            ...base,
            minimap: {
                enabled: true,
                side: 'right',
                renderCharacters: false,
                showSlider: 'always',
                size: 'fit',
                scale: 1,
                maxColumn: 90
            },
            overviewRulerLanes: 3,
            fontSize: 12,
            lineHeight: 18,
            padding: { top: 10, bottom: 10 }
        }
    }, [compactLayout, isLargeFile])

    return (
        <Editor
            value={value}
            language={language}
            path={modelPath}
            theme={editorTheme}
            options={editorOptions}
            onMount={(editor) => {
                editorRef.current = editor
                decorationIdsRef.current = editor.deltaDecorations([], [])
            }}
        />
    )
}
